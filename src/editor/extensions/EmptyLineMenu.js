import { Extension } from '../Extension.js'
import { Plugin, TextSelection } from 'prosemirror-state'
import {
  createFloatingElement,
  getCaretRect,
  onOutsideClick,
  onEscape,
} from '../utils/floating.js'
import {
  paragraphIcon,
  headingIcon,
  bulletListIcon,
  orderedListIcon,
  taskListIcon,
  quoteIcon,
  codeIcon,
  dividerIcon,
} from '../utils/icons.js'

// ============================================================================
// Default menu items
// ============================================================================

const DEFAULT_ITEMS = [
  // — 文本 —
  { key: 'paragraph', label: '段落', icon: paragraphIcon, group: 'text' },
  { key: 'heading-1', label: '标题 1', icon: () => headingIcon(1), group: 'text' },
  { key: 'heading-2', label: '标题 2', icon: () => headingIcon(2), group: 'text' },
  { key: 'heading-3', label: '标题 3', icon: () => headingIcon(3), group: 'text' },
  { type: 'separator', group: 'text' },

  // — 列表 —
  { key: 'bullet-list', label: '无序列表', icon: bulletListIcon, group: 'list' },
  { key: 'ordered-list', label: '有序列表', icon: orderedListIcon, group: 'list' },
  { key: 'task-list', label: '任务列表', icon: taskListIcon, group: 'list' },
  { type: 'separator', group: 'list' },

  // — 嵌入 —
  { key: 'blockquote', label: '引用', icon: quoteIcon, group: 'embed' },
  { key: 'code-block', label: '代码块', icon: codeIcon, group: 'embed' },
  { key: 'divider', label: '分割线', icon: dividerIcon, group: 'embed' },
]

// ============================================================================
// Action dispatch (maps menu item key → editor command)
// ============================================================================

function runItemAction(key, editor) {
  const commands = editor.commands
  switch (key) {
    case 'paragraph':
      // 确保当前块是段落（若已是段落则 no-op）
      if (commands.setParagraph) return commands.setParagraph()
      // 回退：若当前已是段落，返回 true 代表操作成功（不做任何变更）
      return true
    case 'heading-1':
      return commands.toggleHeading?.({ level: 1 })
    case 'heading-2':
      return commands.toggleHeading?.({ level: 2 })
    case 'heading-3':
      return commands.toggleHeading?.({ level: 3 })
    case 'bullet-list':
      return commands.toggleBulletList?.()
    case 'ordered-list':
      return commands.toggleOrderedList?.()
    case 'task-list':
      return commands.toggleTaskList?.()
    case 'blockquote':
      return commands.toggleBlockquote?.()
    case 'code-block':
      return commands.toggleCodeBlock?.()
    case 'divider':
      return commands.insertDivider?.()
    default:
      return false
  }
}

// ============================================================================
// Menu DOM builder
// ============================================================================

function buildMenuDOM(items, { onSelect, onHighlight }) {
  const menu = document.createElement('div')
  menu.className = 'empty-line-menu'
  menu.setAttribute('role', 'listbox')

  // Track highlightable (non-separator) items for keyboard nav
  const navigableItems = []

  items.forEach((item, index) => {
    if (item.type === 'separator') {
      const sep = document.createElement('div')
      sep.className = 'empty-line-menu-separator'
      menu.appendChild(sep)
      return
    }

    const row = document.createElement('div')
    row.className = 'empty-line-menu-item'
    row.setAttribute('role', 'option')
    row.dataset.key = item.key
    row.dataset.index = String(navigableItems.length)

    const iconEl = document.createElement('span')
    iconEl.className = 'empty-line-menu-icon'
    // item.icon can be a function (returns SVG element) or a string
    if (typeof item.icon === 'function') {
      iconEl.appendChild(item.icon())
    } else if (item.icon) {
      iconEl.textContent = item.icon
    }

    const labelEl = document.createElement('span')
    labelEl.className = 'empty-line-menu-label'
    labelEl.textContent = item.label

    row.append(iconEl, labelEl)

    row.addEventListener('mouseenter', () => {
      highlight(menu, navigableItems.length)
    })
    row.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      onSelect(item)
    })

    menu.appendChild(row)
    navigableItems.push({ item, row })
  })

  // Highlight first item by default
  if (navigableItems.length > 0) {
    highlight(menu, 0)
  }

  // Expose the navigable list for keyboard navigation
  menu._navigableItems = navigableItems
  menu._highlightedIndex = 0

  return menu
}

function highlight(menu, index) {
  const items = menu._navigableItems
  if (!items || items.length === 0) return
  const clamped = Math.max(0, Math.min(index, items.length - 1))
  items.forEach(({ row }) => row.classList.remove('is-highlighted'))
  items[clamped].row.classList.add('is-highlighted')
  menu._highlightedIndex = clamped
}

// ============================================================================
// Extension
// ============================================================================

export const EmptyLineMenu = Extension.create({
  name: 'emptyLineMenu',

  addCommands() {
    return {
      openEmptyLineMenu: () => (_state, _dispatch, view) => {
        const ext = this
        openMenu(ext, view)
        return true
      },
      closeEmptyLineMenu: () => () => {
        const ext = this
        closeMenu(ext)
        return true
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      // Let the plugin handle ArrowUp/Down/Enter when menu is open
      ArrowUp: (state, dispatch, view) => {
        const ext = this
        if (!ext._menu) return false
        moveHighlight(ext, -1)
        return true
      },
      ArrowDown: (state, dispatch, view) => {
        const ext = this
        if (!ext._menu) return false
        moveHighlight(ext, 1)
        return true
      },
      Enter: (state, dispatch, view) => {
        const ext = this
        if (!ext._menu) return false
        activateHighlighted(ext, view)
        return true
      },
      Escape: () => {
        const ext = this
        if (!ext._menu) return false
        closeMenu(ext)
        return true
      },
    }
  },

  addProseMirrorPlugins() {
    const ext = this
    const options = this.options || {}
    const items = options.items || DEFAULT_ITEMS
    const enabled = options.enabled !== false

    return [
      new Plugin({
        props: {
          handleKeyDown(view, event) {
            if (!enabled) return false
            // Only intercept '/' on an empty paragraph
            if (event.key !== '/' && event.key !== 'U+002F') return false
            if (!isEmptyParagraph(view.state)) return false

            // Insert '/' into the document.
            // Set _pendingOpen BEFORE dispatch so that appendTransaction and
            // view.update() (both called during dispatch) see it as true.
            const { $from } = view.state.selection
            const pos = $from.pos
            ext._pendingOpen = true
            const tr = view.state.tr.insertText('/', pos)
            view.dispatch(tr)

            return true
          },
        },

        appendTransaction(transactions, oldState, newState) {
          // If '/' was just typed on an empty line, record the slash position
          // so view.update() can open the menu (after the DOM has been updated).
          // NOTE: we do NOT reset _pendingOpen here — view.update() handles that,
          // because it runs AFTER appendTransaction (during view.updateState).
          if (ext._pendingOpen) {
            ext._slashPos = newState.selection.from
            return null
          }

          // If the menu is open, check whether the '/' has been deleted
          if (ext._menu && ext._slashPos != null) {
            if (!hasSlashAtPos(newState, ext._slashPos)) {
              // '/' was deleted → close the menu (cleanup deferred to view.update)
              closeMenu(ext)
              return null
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
              // Skip processing during closeMenu's own slash-deletion dispatch
              // to avoid double-cleanup or re-opening the menu.
              if (ext._isClosing) return

              // Reset _pendingOpen: if appendTransaction already handled it
              // (by setting _slashPos), it's safe to clear the flag here.
              // If the flag was set by handleKeyDown but appendTransaction
              // hasn't run yet (shouldn't happen, but defensive), we clear
              // it to prevent stale state.
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

              // ——— Menu is open ———
              if (ext._menu) {
                // Close if cursor left the textblock containing '/'
                if (ext._slashPos != null) {
                  try {
                    const $pos = state.doc.resolve(ext._slashPos)
                    if (!$pos.parent.isTextblock) {
                      closeMenu(ext)
                      return
                    }
                  } catch {
                    closeMenu(ext)
                    return
                  }
                }
                // Close if the paragraph is no longer exactly "/"
                if (!isEmptyParagraphWithSlash(state, ext._slashPos)) {
                  closeMenu(ext)
                }
                return
              }

              // ——— Menu is closed — open if '/' was just typed ———
              if (pendingOpen && isEmptyParagraphWithSlash(state, ext._slashPos)) {
                openMenu(ext, view, items)
              }
            },

            destroy() {
              closeMenu(ext)
            },
          }
        },
      }),
    ]
  },
})

// ============================================================================
// Menu lifecycle helpers
// ============================================================================

function isEmptyParagraph(state) {
  const { selection } = state
  if (!selection.empty) return false
  const { $from } = selection
  // 必须是 doc 直接子节点（深度 1），blockquote/list 内的段落深度 ≥ 2
  // 支持任何空的顶层文本块（段落、标题、引用等），让用户在删除内容后仍能触发菜单
  return $from.depth === 1
    && $from.parent.isTextblock
    && $from.parent.content.size === 0
}

function hasSlashAtPos(state, pos) {
  // `pos` is the cursor position right AFTER the slash. The slash itself
  // sits at parentOffset = (pos's parentOffset) - 1 within its parent.
  if (pos == null || pos <= 0) return false
  try {
    const resolved = state.doc.resolve(pos)
    const slashOffset = resolved.parentOffset - 1
    if (slashOffset < 0) return false
    const result = resolved.parent.childAfter(slashOffset)
    return !!(result.node && result.node.isText && result.node.text === '/')
  } catch {
    return false
  }
}

function isEmptyParagraphWithSlash(state, slashPos) {
  const { selection } = state
  if (!selection.empty) return false
  const { $from } = selection
  if ($from.depth !== 1) return false
  if (!$from.parent.isTextblock) return false
  if ($from.parent.content.size !== 1) return false
  if (slashPos == null) return false
  return hasSlashAtPos(state, slashPos)
}

function openMenu(ext, view, items) {
  // Avoid duplicate menus
  if (ext._menu) return

  const effectiveItems = items || ext.options?.items || DEFAULT_ITEMS
  const editor = ext.editor

  const menuDOM = buildMenuDOM(effectiveItems, {
    onSelect: (item) => {
      if (item.type === 'separator') return
      // ① 先把文档里的 '/' 触发符删干净，保证后续动作在干净的文档上执行
      cleanupSlash(ext, view)
      // ② 执行菜单动作（转标题/列表/引用等）
      runItemAction(item.key, editor)
      // ③ 关闭菜单浮层（不再做 slash 清理）
      closeMenu(ext)
      view.focus()
    },
    onHighlight: () => {},
  })

  // Position the menu at the slash character when available, otherwise at caret
  let anchorRect
  if (view && ext._slashPos != null) {
    try {
      const coords = view.coordsAtPos(ext._slashPos)
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

  const floating = createFloatingElement(menuDOM, { type: 'rect', rect: anchorRect }, {
    zIndex: 30,
    placement: 'below',
    offset: 6,
  })

  const cleanupOutside = onOutsideClick(floating.el, () => closeMenu(ext))
  const cleanupEscape = onEscape(() => closeMenu(ext))

  ext._menu = {
    floating,
    cleanupOutside,
    cleanupEscape,
    menuDOM,
  }
}

function closeMenu(ext) {
  if (!ext._menu) return

  // Prevent re-entrant processing when closeMenu dispatches a transaction
  // (the resulting view.update would otherwise try to close again).
  const shouldCleanup = ext._isClosing !== true
  ext._isClosing = true

  const { floating, cleanupOutside, cleanupEscape } = ext._menu
  cleanupOutside()
  cleanupEscape()
  floating.destroy()
  ext._menu = null

  ext._slashPos = null
  ext._isClosing = false
}

/**
 * Remove the '/' trigger character from the document.
 * Called BEFORE the menu action so the action operates on a clean document.
 * Also sweeps for any extra '/' characters that may have been typed before
 * the menu intercepted (e.g. user typed "//" quickly).
 */
function cleanupSlash(ext, view) {
  const slashPos = ext._slashPos
  ext._slashPos = null
  if (!view || slashPos == null) return

  try {
    const from = slashPos - 1
    const to = slashPos
    if (from < 0 || to > view.state.doc.content.size) return

    let tr = view.state.tr
    tr = tr.delete(from, to)

    // Sweep the (now-modified) textblock for any remaining '/'
    const $from = tr.doc.resolve(tr.mapping.map(from))
    if ($from.parent.isTextblock) {
      const start = $from.start()
      const slashes = []
      $from.parent.content.forEach((child, off) => {
        if (child.isText && child.text) {
          for (let i = 0; i < child.text.length; i++) {
            if (child.text[i] === '/') slashes.push(start + off + i)
          }
        }
      })
      // Delete right-to-left so earlier positions stay valid
      for (let i = slashes.length - 1; i >= 0; i--) {
        tr = tr.delete(slashes[i], slashes[i] + 1)
      }
    }

    // Place cursor at a valid position
    const mapped = tr.mapping.map(view.state.selection.from)
    const clamped = Math.max(0, Math.min(mapped, tr.doc.content.size))
    try {
      tr = tr.setSelection(TextSelection.near(tr.doc.resolve(clamped)))
    } catch {
      try {
        tr = tr.setSelection(TextSelection.near(tr.doc.resolve(tr.mapping.map(from))))
      } catch { /* ignore */ }
    }

    view.dispatch(tr)
  } catch { /* ignore invalid positions */ }
}

function moveHighlight(ext, delta) {
  if (!ext._menu) return
  const menuDOM = ext._menu.menuDOM
  const newIndex = menuDOM._highlightedIndex + delta
  highlight(menuDOM, newIndex)
}

function activateHighlighted(ext, view) {
  if (!ext._menu) return
  const menuDOM = ext._menu.menuDOM
  const items = menuDOM._navigableItems
  const index = menuDOM._highlightedIndex
  if (!items || index < 0 || index >= items.length) return
  const { item } = items[index]
  if (item.type === 'separator') return
  cleanupSlash(ext, view)
  runItemAction(item.key, ext.editor)
  closeMenu(ext)
  view.focus()
}
