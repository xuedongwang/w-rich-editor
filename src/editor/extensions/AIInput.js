import { Extension } from '../Extension.js'
import { Plugin, TextSelection } from 'prosemirror-state'
import { DOMParser as PMDOMParser, Slice } from 'prosemirror-model'
import { callDeepSeek } from './AIAssistant.js'
import {
  createFloatingElement,
  getCaretRect,
  onOutsideClick,
  onEscape,
} from '../utils/floating.js'
import { sparklesIcon, loadingIcon } from '../utils/icons.js'

// ============================================================================
// Default system prompt
// ============================================================================

const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful writing assistant. Process, refine, or answer based on the user\'s input. ' +
  'Return ONLY the processed content — no explanations, no preamble, no markdown fences. ' +
  'Preserve the original language.'

// ============================================================================
// Helpers
// ============================================================================

function isEmptyTopLevelParagraph(state) {
  const { selection } = state
  if (!selection.empty) return false
  const { $from } = selection
  return $from.depth === 1
    && $from.parent.type.name === 'paragraph'
    && $from.parent.content.size === 0
}

/**
 * Check if the space character still exists at the recorded position.
 * `pos` is the cursor position right AFTER the space.
 */
function hasSpaceAtPos(state, pos) {
  if (pos == null || pos <= 0) return false
  try {
    const resolved = state.doc.resolve(pos)
    const spaceOffset = resolved.parentOffset - 1
    if (spaceOffset < 0) return false
    const result = resolved.parent.childAfter(spaceOffset)
    return !!(result.node && result.node.isText && result.node.text === ' ')
  } catch {
    return false
  }
}

function isEmptyParagraphWithSpace(state, spacePos) {
  const { selection } = state
  if (!selection.empty) return false
  const { $from } = selection
  if ($from.depth !== 1) return false
  if ($from.parent.type.name !== 'paragraph') return false
  if ($from.parent.content.size !== 1) return false
  if (spacePos == null) return false
  return hasSpaceAtPos(state, spacePos)
}

// ============================================================================
// DOM builders
// ============================================================================

function buildInputBoxDOM({ onSubmit, onCancel }) {
  const box = document.createElement('div')
  box.className = 'ai-input-box'

  // Icon
  const iconEl = document.createElement('span')
  iconEl.className = 'ai-input-icon'
  iconEl.appendChild(sparklesIcon())
  box.appendChild(iconEl)

  // Input field
  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'ai-input-field'
  input.placeholder = '问 AI 任何问题…'
  input.setAttribute('autocomplete', 'off')
  box.appendChild(input)

  // Loading indicator (hidden by default)
  const loading = document.createElement('span')
  loading.className = 'ai-input-loading'
  loading.style.display = 'none'
  loading.appendChild(loadingIcon())
  box.appendChild(loading)

  // Error message (hidden by default)
  const error = document.createElement('span')
  error.className = 'ai-input-error'
  error.style.display = 'none'
  box.appendChild(error)

  // Handle Enter key in the input
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      onSubmit(input.value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onCancel()
    }
  })

  // Prevent mousedown inside the box from triggering outside-click
  box.addEventListener('mousedown', (e) => {
    e.stopPropagation()
  })

  box._input = input
  box._loading = loading
  box._error = error
  return box
}

function setLoading(box, isLoading) {
  if (!box) return
  box._loading.style.display = isLoading ? '' : 'none'
  box._input.disabled = isLoading
  if (isLoading) {
    box.classList.add('is-loading')
  } else {
    box.classList.remove('is-loading')
  }
}

function setError(box, message) {
  if (!box) return
  box._error.textContent = message || ''
  box._error.style.display = message ? '' : 'none'
  if (message) {
    box.classList.add('is-error')
    // Auto-clear error after 3s
    setTimeout(() => {
      if (box._error) {
        box._error.style.display = 'none'
        box.classList.remove('is-error')
      }
    }, 3000)
  } else {
    box.classList.remove('is-error')
  }
}

// ============================================================================
// AI result → ProseMirror content
// ============================================================================

/**
 * Parse AI response text into a ProseMirror Slice.
 * The response may contain multiple paragraphs (separated by blank lines).
 */
function parseAIResponse(schema, text) {
  const tempDiv = document.createElement('div')
  // Split on blank lines to create paragraphs. Single newlines become <br>.
  const paragraphs = text.split(/\n\s*\n/)
  for (const p of paragraphs) {
    const trimmed = p.trim()
    if (!trimmed) continue
    const el = document.createElement('p')
    // Convert single newlines to <br>
    el.innerHTML = trimmed.replace(/\n/g, '<br>')
    tempDiv.appendChild(el)
  }
  if (tempDiv.children.length === 0) {
    // Fallback: wrap entire text in a single paragraph
    const el = document.createElement('p')
    el.textContent = text
    tempDiv.appendChild(el)
  }
  return PMDOMParser.fromSchema(schema).parseSlice(tempDiv)
}

// ============================================================================
// Resolve API key
// ============================================================================

function resolveApiKey(options) {
  if (options?.apiKey) return options.apiKey
  const stored = typeof localStorage !== 'undefined'
    ? localStorage.getItem('ai-api-key')
    : null
  if (stored) return stored
  // Prompt user (only in browser environment, not in tests)
  if (typeof prompt === 'function' && typeof window !== 'undefined' && window.document) {
    const key = prompt('请输入 DeepSeek API Key 以使用 AI 输入功能')
    if (key) {
      try { localStorage.setItem('ai-api-key', key) } catch { /* ignore */ }
      return key
    }
  }
  return null
}

// ============================================================================
// Extension
// ============================================================================

export const AIInput = Extension.create({
  name: 'aiInput',

  addCommands() {
    return {
      openAIInput: () => (_state, _dispatch, view) => {
        const ext = this
        openInputBox(ext, view)
        return true
      },
      closeAIInput: () => () => {
        const ext = this
        closeInputBox(ext, /* cleanupSpace */ true)
        return true
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      Escape: () => {
        const ext = this
        if (!ext._input) return false
        closeInputBox(ext, /* cleanupSpace */ true)
        return true
      },
    }
  },

  addProseMirrorPlugins() {
    const ext = this
    const options = this.options || {}
    const enabled = options.enabled !== false

    return [
      new Plugin({
        props: {
          handleKeyDown(view, event) {
            if (!enabled) return false
            if (event.key !== ' ') return false
            if (!isEmptyTopLevelParagraph(view.state)) return false

            // Set flag BEFORE dispatch so appendTransaction and view.update see it
            ext._pendingOpen = true
            const pos = view.state.selection.$from.pos
            view.dispatch(view.state.tr.insertText(' ', pos))
            return true
          },
        },

        appendTransaction(transactions, oldState, newState) {
          // Record space position when space is just typed
          if (ext._pendingOpen) {
            ext._spacePos = newState.selection.from
            return null
          }

          // If input box is open, check if space still exists
          if (ext._input && ext._spacePos != null) {
            if (!hasSpaceAtPos(newState, ext._spacePos)) {
              closeInputBox(ext, /* cleanupSpace */ false)
            }
          }

          return null
        },

        view(editorView) {
          ext._view = editorView

          let initialized = false
          let lastDoc = editorView.state.doc
          let lastSelection = editorView.state.selection

          return {
            update(view) {
              if (!enabled) return
              if (ext._isClosing) return

              // Reset _pendingOpen — see EmptyLineMenu.js for rationale
              const pendingOpen = ext._pendingOpen === true
              ext._pendingOpen = false

              const state = view.state
              const changed = !initialized
                || state.doc !== lastDoc
                || !state.selection.eq(lastSelection)

              lastDoc = state.doc
              lastSelection = state.selection
              initialized = true

              if (!changed) return

              // Input box is open — check if it should close
              if (ext._input) {
                if (!isEmptyParagraphWithSpace(state, ext._spacePos)) {
                  closeInputBox(ext, /* cleanupSpace */ false)
                }
                return
              }

              // Open input box if space was just typed
              if (pendingOpen && isEmptyParagraphWithSpace(state, ext._spacePos)) {
                openInputBox(ext, view)
              }
            },

            destroy() {
              closeInputBox(ext, /* cleanupSpace */ false)
            },
          }
        },
      }),
    ]
  },
})

// ============================================================================
// Input box lifecycle
// ============================================================================

function openInputBox(ext, view) {
  if (ext._input) return

  const boxDOM = buildInputBoxDOM({
    onSubmit: (text) => submitInput(ext, view, text),
    onCancel: () => closeInputBox(ext, /* cleanupSpace */ true),
  })

  // Position at the space character
  let anchorRect
  if (view && ext._spacePos != null) {
    try {
      const coords = view.coordsAtPos(ext._spacePos)
      if (coords) {
        anchorRect = new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top)
      }
    } catch { /* ignore layout errors in test envs */ }
  }
  if (!anchorRect) {
    try {
      const caretRect = view ? getCaretRect(view) : null
      anchorRect = caretRect || new DOMRect(0, 0, 0, 0)
    } catch {
      anchorRect = new DOMRect(0, 0, 0, 0)
    }
  }

  const floating = createFloatingElement(boxDOM, { type: 'rect', rect: anchorRect }, {
    zIndex: 40,
    placement: 'below',
    offset: 6,
  })

  const cleanupOutside = onOutsideClick(floating.el, () => {
    closeInputBox(ext, /* cleanupSpace */ true)
  })
  const cleanupEscape = onEscape(() => {
    closeInputBox(ext, /* cleanupSpace */ true)
  })

  ext._input = {
    floating,
    cleanupOutside,
    cleanupEscape,
    boxDOM,
  }

  // Focus the input field
  requestAnimationFrame(() => {
    boxDOM._input?.focus()
  })
}

function closeInputBox(ext, cleanupSpace) {
  if (!ext._input) return

  const shouldCleanup = ext._isClosing !== true
  ext._isClosing = true

  const { floating, cleanupOutside, cleanupEscape } = ext._input
  cleanupOutside()
  cleanupEscape()
  floating.destroy()
  ext._input = null

  const view = ext._view
  const spacePos = ext._spacePos
  ext._spacePos = null
  ext._isClosing = false

  // Delete the trigger space if requested and still present
  // `spacePos` is the cursor position right AFTER the space. The space
  // itself occupies [spacePos-1, spacePos].
  if (shouldCleanup && cleanupSpace && view && spacePos != null) {
    try {
      if (hasSpaceAtPos(view.state, spacePos)) {
        let tr = view.state.tr.delete(spacePos - 1, spacePos)
        const mapped = tr.mapping.map(view.state.selection.from)
        tr = tr.setSelection(TextSelection.near(tr.doc.resolve(mapped)))
        view.dispatch(tr)
      }
    } catch { /* ignore invalid positions */ }
  }
}

// ============================================================================
// AI processing
// ============================================================================

async function submitInput(ext, view, text) {
  if (!ext._input) return
  const trimmed = (text || '').trim()
  if (!trimmed) {
    // Empty input — just close without AI call
    closeInputBox(ext, /* cleanupSpace */ true)
    return
  }

  const boxDOM = ext._input.boxDOM
  const spacePos = ext._spacePos

  // Resolve API key
  const apiKey = ext._apiKey || resolveApiKey(ext.options)
  if (!apiKey) {
    setError(boxDOM, '需要 API Key')
    return
  }
  ext._apiKey = apiKey

  // Show loading state
  setLoading(boxDOM, true)
  setError(boxDOM, null)

  try {
    const result = await callDeepSeek({
      apiKey,
      endpoint: ext.options?.endpoint || 'https://api.deepseek.com/v1/chat/completions',
      model: ext.options?.model || 'deepseek-chat',
      systemPrompt: ext.options?.systemPrompt || DEFAULT_SYSTEM_PROMPT,
      userContent: trimmed,
    })

    // Replace space with AI result (if still valid)
    if (ext._input && spacePos != null) {
      replaceSpaceWithResult(ext, view, spacePos, result)
    }
  } catch (err) {
    if (ext._input) {
      setLoading(boxDOM, false)
      setError(boxDOM, err.message || 'AI 调用失败')
    }
  }
}

function replaceSpaceWithResult(ext, view, spacePos, text) {
  // `spacePos` is the cursor position right AFTER the space.
  // The space occupies [spacePos-1, spacePos].
  const from = spacePos - 1
  const to = spacePos
  try {
    const state = view.state
    if (from < 0 || to > state.doc.content.size) {
      closeInputBox(ext, /* cleanupSpace */ false)
      return
    }

    // Try structured replacement first (preserves block types from AI)
    const slice = parseAIResponse(state.schema, text)
    if (slice.content.size > 0) {
      try {
        let tr = state.tr
        tr = tr.delete(from, to)
        const insertPos = tr.mapping.map(from)
        // Insert slice content at the cleared position
        const insertSlice = new Slice(slice.content, slice.openStart, slice.openEnd)
        tr = tr.replace(insertPos, insertPos, insertSlice)
        const endPos = insertPos + slice.content.size
        try {
          const clamped = Math.min(endPos, tr.doc.content.size)
          tr = tr.setSelection(TextSelection.near(tr.doc.resolve(clamped)))
        } catch {
          tr = tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos)))
        }
        view.dispatch(tr)
        closeInputBox(ext, /* cleanupSpace */ false)
        view.focus()
        return
      } catch { /* fall through to plain text */ }
    }

    // Fallback: insert as plain text
    let tr = state.tr
    tr = tr.delete(from, to)
    tr = tr.insertText(text, tr.mapping.map(from))
    const mapped = tr.mapping.map(from) + text.length
    tr = tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(mapped, tr.doc.content.size))))
    view.dispatch(tr)
  } catch { /* ignore */ }

  closeInputBox(ext, /* cleanupSpace */ false)
  view.focus()
}
