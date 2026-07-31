import { Extension } from '../Extension.js'
import { Plugin } from 'prosemirror-state'
import { TextSelection } from 'prosemirror-state'
import {
  createFloatingElement,
  getSelectionRect,
  onOutsideClick,
  onEscape,
} from '../utils/floating.js'
import {
  sparklesIcon,
  improveIcon,
  summarizeIcon,
  translateIcon,
  toneIcon,
  loadingIcon,
} from '../utils/icons.js'

// ============================================================================
// Default AI actions
// ============================================================================

const DEFAULT_ACTIONS = [
  {
    key: 'improve',
    label: '改进写作',
    icon: improveIcon,
    prompt: 'You are a professional editor. Please improve the following text by refining its grammar, clarity, and flow. Keep the original meaning and language. Return only the improved text, no explanations.',
  },
  {
    key: 'summarize',
    label: '缩写/总结',
    icon: summarizeIcon,
    prompt: 'You are a summarization expert. Please condense the following text into a shorter version that preserves the key points. Keep the same language. Return only the summarized text, no explanations.',
  },
  {
    key: 'translate',
    label: '翻译',
    icon: translateIcon,
    prompt: 'You are a professional translator. If the text is in Chinese, translate it to English. If the text is in English, translate it to Chinese. Keep the same tone and style. Return only the translated text, no explanations.',
  },
  {
    key: 'tone',
    label: '调整语气',
    icon: toneIcon,
    prompt: 'You are a tone specialist. Please rewrite the following text to sound more professional and formal, while keeping the original meaning. Keep the same language. Return only the rewritten text, no explanations.',
  },
]

// ============================================================================
// DOM builders
// ============================================================================

function buildTriggerButton() {
  const btn = document.createElement('button')
  btn.className = 'ai-trigger-btn'
  btn.type = 'button'
  btn.setAttribute('aria-label', 'AI 辅助写作')
  btn.appendChild(sparklesIcon())
  return btn
}

function buildDropdown(actions, { onSelect }) {
  const menu = document.createElement('div')
  menu.className = 'ai-dropdown'
  menu.setAttribute('role', 'menu')

  actions.forEach((action) => {
    const item = document.createElement('div')
    item.className = 'ai-dropdown-item'
    item.setAttribute('role', 'menuitem')
    item.dataset.key = action.key

    const icon = document.createElement('span')
    icon.className = 'ai-dropdown-icon'
    // action.icon is a function that returns an SVG element
    if (typeof action.icon === 'function') {
      icon.appendChild(action.icon())
    } else if (action.icon) {
      icon.textContent = action.icon
    }

    const label = document.createElement('span')
    label.className = 'ai-dropdown-label'
    label.textContent = action.label

    item.append(icon, label)

    item.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      onSelect(action)
    })

    menu.appendChild(item)
  })

  return menu
}

function buildLoadingIndicator() {
  const el = document.createElement('div')
  el.className = 'ai-loading'
  el.appendChild(loadingIcon())
  const text = document.createElement('span')
  text.className = 'ai-loading-text'
  text.textContent = 'AI 处理中...'
  el.appendChild(text)
  return el
}

// ============================================================================
// DeepSeek API call (streaming)
// ============================================================================

/**
 * Call DeepSeek API with streaming. Calls onChunk(partialResult) as text
 * arrives incrementally. Returns the full result when complete.
 *
 * @param {object} options
 * @param {(partial: string) => void} onChunk - Called with each new chunk
 * @returns {Promise<string>} Full result text
 */
async function callDeepSeekStream(options, onChunk) {
  const { apiKey, endpoint, model, systemPrompt, userContent } = options

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      stream: true,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`AI API error ${response.status}: ${errorText}`)
  }

  if (!response.body) {
    throw new Error('AI response has no body for streaming')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // SSE lines are separated by newlines
    const lines = buffer.split('\n')
    // Keep the last (potentially incomplete) line in the buffer
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data)
        const delta = parsed?.choices?.[0]?.delta?.content
        if (delta) {
          fullText += delta
          onChunk(fullText)
        }
      } catch {
        // Ignore malformed JSON chunks
      }
    }
  }

  return fullText.trim()
}

/**
 * Non-streaming fallback for APIs that don't support streaming.
 */
async function callDeepSeek(options) {
  const { apiKey, endpoint, model, systemPrompt, userContent } = options

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      stream: false,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`AI API error ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('AI returned empty response')
  }
  return content.trim()
}

// ============================================================================
// Extension
// ============================================================================

export const AIAssistant = Extension.create({
  name: 'aiAssistant',

  addCommands() {
    return {
      runAIAction: (attrs) => (state, dispatch, view) => {
        const ext = this
        const action = (ext.options?.actions || DEFAULT_ACTIONS).find(
          (a) => a.key === attrs?.action,
        )
        if (!action) return false
        if (state.selection.empty) return false
        triggerAction(ext, view, action)
        return true
      },
    }
  },

  addProseMirrorPlugins() {
    const ext = this
    const options = this.options || {}
    const enabled = options.enabled !== false
    const hasApiKey = !!options.apiKey
    const actions = options.actions || DEFAULT_ACTIONS

    return [
      new Plugin({
        view(editorView) {
          if (!enabled || !hasApiKey) return {}

          return {
            update(view, prevState) {
              const state = view.state
              const hasSelection = !state.selection.empty
              const isTextSelection = state.selection.constructor.name === 'TextSelection'
                || (typeof state.selection.from === 'number' && typeof state.selection.to === 'number')

              // Show trigger button when text is selected
              if (hasSelection && isTextSelection) {
                if (!ext._trigger) {
                  showTrigger(ext, view, actions)
                } else {
                  updateTriggerPosition(ext, view)
                }
              } else {
                hideTrigger(ext)
              }
            },
            destroy() {
              hideTrigger(ext)
              hideDropdown(ext)
              hideLoading(ext)
            },
          }
        },
      }),
    ]
  },
})

// ============================================================================
// Trigger button lifecycle
// ============================================================================

function showTrigger(ext, view, actions) {
  const btn = buildTriggerButton()
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    showDropdown(ext, view, actions)
  })

  const rect = getSelectionRect(view)
  const anchorRect = rect || new DOMRect(0, 0, 0, 0)

  const floating = createFloatingElement(btn, { type: 'rect', rect: anchorRect }, {
    zIndex: 40,
    placement: 'above',
    offset: 8,
  })

  ext._trigger = { floating, btn }
}

function updateTriggerPosition(ext, view) {
  if (!ext._trigger) return
  const rect = getSelectionRect(view)
  if (rect) ext._trigger.floating.update({ type: 'rect', rect })
}

function hideTrigger(ext) {
  if (!ext._trigger) return
  ext._trigger.floating.destroy()
  ext._trigger = null
  hideDropdown(ext)
}

// ============================================================================
// Dropdown lifecycle
// ============================================================================

function showDropdown(ext, view, actions) {
  hideDropdown(ext)

  const menuDOM = buildDropdown(actions, {
    onSelect: (action) => {
      hideDropdown(ext)
      triggerAction(ext, view, action)
    },
  })

  const rect = getSelectionRect(view)
  const anchorRect = rect || new DOMRect(0, 0, 0, 0)

  const floating = createFloatingElement(menuDOM, { type: 'rect', rect: anchorRect }, {
    zIndex: 41,
    placement: 'below',
    offset: 8,
  })

  const cleanupOutside = onOutsideClick(floating.el, () => hideDropdown(ext))
  const cleanupEscape = onEscape(() => hideDropdown(ext))

  ext._dropdown = { floating, cleanupOutside, cleanupEscape }
}

function hideDropdown(ext) {
  if (!ext._dropdown) return
  const { floating, cleanupOutside, cleanupEscape } = ext._dropdown
  cleanupOutside()
  cleanupEscape()
  floating.destroy()
  ext._dropdown = null
}

// ============================================================================
// Block structure analysis (for type-preserving translation)
// ============================================================================

/**
 * Analyze the selection to determine the block structure. Returns a list of
 * { type, attrs, pos, nodeSize, text } for each textblock intersecting the
 * selection. `text` is the portion of the textblock that falls inside the
 * selection range (not the entire textblock).
 */
function analyzeSelection(doc, from, to) {
  const pieces = []
  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return

    // Compute the intersection of the selection [from, to] with this
    // textblock's content range [pos+1, pos+nodeSize-1].
    const contentStart = pos + 1
    const contentEnd = pos + node.nodeSize - 1
    const sliceStart = Math.max(from, contentStart)
    const sliceEnd = Math.min(to, contentEnd)
    const text = sliceEnd > sliceStart
      ? doc.textBetween(sliceStart, sliceEnd, ' ')
      : ''

    pieces.push({
      type: node.type.name,
      attrs: { ...node.attrs },
      pos,
      nodeSize: node.nodeSize,
      text,
    })
  })
  return pieces
}

/**
 * Check if the selection is entirely within a list container. Returns the
 * list node info or null.
 */
function findParentList(doc, from) {
  const $pos = doc.resolve(from)
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d)
    const name = node.type.name
    if (name === 'bullet_list' || name === 'ordered_list' || name === 'task_list') {
      return { type: name, depth: d, pos: $pos.before(d) }
    }
  }
  return null
}

// ============================================================================
// Action execution (streaming, block-preserving)
// ============================================================================

async function triggerAction(ext, view, action) {
  const options = ext.options || {}
  const { state } = view
  const { selection } = state

  if (selection.empty) return

  const from = selection.from
  const to = selection.to

  // Analyze the block structure so we can preserve it
  const pieces = analyzeSelection(state.doc, from, to)
  const parentList = findParentList(state.doc, from)

  // Build prompt hint for structure preservation
  let structureHint = ''
  if (pieces.length > 1) {
    structureHint = `\n\nIMPORTANT: The text contains ${pieces.length} separate items/paragraphs. ` +
      `Return exactly ${pieces.length} items separated by newlines, matching the original structure. ` +
      `Do not merge or split items.`
  }

  // Hide trigger and dropdown
  hideTrigger(ext)
  hideDropdown(ext)

  // Show streaming indicator at selection position
  const loadingEl = buildStreamingIndicator()
  const rect = getSelectionRect(view) || new DOMRect(0, 0, 0, 0)
  const floating = createFloatingElement(loadingEl, { type: 'rect', rect }, {
    zIndex: 42,
    placement: 'above',
    offset: 8,
  })
  ext._loading = { floating, el: loadingEl }

  try {
    const fullResult = await callDeepSeekStream(
      {
        apiKey: options.apiKey,
        endpoint: options.endpoint || 'https://api.deepseek.com/v1/chat/completions',
        model: options.model || 'deepseek-chat',
        systemPrompt: action.prompt + structureHint,
        userContent: pieces.map(p => p.text).join('\n'),
      },
      (partial) => updateStreamingIndicator(ext, partial),
    )

    // Replace selection with AI result, preserving block structure
    const { state: currentState } = view

    if (pieces.length === 1) {
      // Single block — simple text replacement
      const mappedFrom = from
      const mappedTo = to
      if (mappedTo > currentState.doc.content.size) return

      let tr = currentState.tr.replaceWith(
        mappedFrom,
        mappedTo,
        currentState.schema.text(fullResult),
      )
      const endPos = mappedFrom + fullResult.length
      const $end = tr.doc.resolve(Math.min(endPos, tr.doc.content.size))
      tr = tr.setSelection(TextSelection.near($end))
      view.dispatch(tr)
    } else if (parentList && pieces.every(p => p.type === 'paragraph')) {
      // Multiple paragraphs inside a list — split by newline and replace
      // each list_item's paragraph content with the corresponding piece
      replaceMultiBlockInList(view, currentState, parentList, from, to, fullResult, pieces)
    } else {
      // Mixed content — split by newline and replace inline
      const resultLines = splitResultLines(fullResult, pieces.length)
      replaceMultiBlockInline(view, currentState, from, to, resultLines, pieces)
    }

    view.focus()
  } catch (error) {
    console.error('AI Assistant error:', error)
    showToast(error.message || 'AI 处理失败，请稍后再试')
  } finally {
    hideLoading(ext)
  }
}

/**
 * Split AI result into lines matching the expected piece count.
 */
function splitResultLines(text, expectedCount) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  // If AI didn't produce enough lines, pad with empty
  while (lines.length < expectedCount) lines.push('')
  // If too many, merge extras into the last line
  if (lines.length > expectedCount) {
    const merged = lines.slice(0, expectedCount - 1)
    merged.push(lines.slice(expectedCount - 1).join(' '))
    return merged
  }
  return lines
}

/**
 * Replace content inside a list with AI result, preserving list_item structure.
 */
function replaceMultiBlockInList(view, state, parentList, from, to, fullResult, pieces) {
  const resultLines = splitResultLines(fullResult, pieces.length)
  let tr = state.tr

  // Walk backwards through pieces so positions remain valid as we modify
  for (let i = pieces.length - 1; i >= 0; i--) {
    const piece = pieces[i]
    const line = resultLines[i]
    if (!line) continue

    // Find the paragraph's content range
    const pFrom = piece.pos + 1 // +1 for the paragraph's opening boundary
    const pTo = piece.pos + piece.nodeSize - 1 // -1 for the closing boundary
    const mappedFrom = tr.mapping.map(pFrom)
    const mappedTo = tr.mapping.map(pTo)

    // Replace the paragraph's inline content with the new text
    tr = tr.replaceWith(
      mappedFrom,
      mappedTo,
      state.schema.text(line),
    )
  }

  view.dispatch(tr)
}

/**
 * Replace content across multiple blocks inline.
 */
function replaceMultiBlockInline(view, state, from, to, resultLines, pieces) {
  let tr = state.tr

  for (let i = pieces.length - 1; i >= 0; i--) {
    const piece = pieces[i]
    const line = resultLines[i] || ''

    const pFrom = piece.pos + 1
    const pTo = piece.pos + piece.nodeSize - 1
    const mappedFrom = tr.mapping.map(pFrom)
    const mappedTo = tr.mapping.map(pTo)

    tr = tr.replaceWith(mappedFrom, mappedTo, state.schema.text(line))
  }

  view.dispatch(tr)
}

// ============================================================================
// Streaming indicator UI
// ============================================================================

function buildStreamingIndicator() {
  const el = document.createElement('div')
  el.className = 'ai-loading'
  el.appendChild(loadingIcon())
  const text = document.createElement('span')
  text.className = 'ai-streaming-text'
  text.textContent = 'AI 处理中...'
  el.appendChild(text)
  return el
}

function updateStreamingIndicator(ext, partial) {
  if (!ext._loading) return
  const textEl = ext._loading.el?.querySelector('.ai-streaming-text')
  if (textEl) {
    // Show first ~80 chars of the partial result
    const preview = partial.length > 80 ? partial.slice(0, 80) + '…' : partial
    textEl.textContent = preview
  }
}

function hideLoading(ext) {
  if (!ext._loading) return
  ext._loading.floating.destroy()
  ext._loading = null
}

// ============================================================================
// Toast (simple error notification)
// ============================================================================

function showToast(message) {
  const toast = document.createElement('div')
  toast.className = 'ai-toast'
  toast.textContent = message
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #ef4444;
    color: white;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    z-index: 100;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    transition: opacity 0.3s;
  `
  document.body.appendChild(toast)
  setTimeout(() => {
    toast.style.opacity = '0'
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast)
    }, 300)
  }, 3000)
}
