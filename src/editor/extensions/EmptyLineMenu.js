import { Extension } from '../Extension.js'
import { Plugin } from 'prosemirror-state'
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
      return commands.toggleHeading?.({ level: 1 })
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
        view(editorView) {
          let initialized = false
          let lastDoc = editorView.state.doc
          let lastSelection = editorView.state.selection
          return {
            update(view) {
              if (!enabled) return

              const state = view.state
              const changed = !initialized
                || state.doc !== lastDoc
                || !state.selection.eq(lastSelection)

              lastDoc = state.doc
              lastSelection = state.selection
              initialized = true

              if (!changed) return

              // If menu is open, only keep it open if still on empty paragraph
              if (ext._menu) {
                if (!isEmptyParagraph(state)) {
                  closeMenu(ext)
                }
                return
              }

              // Open menu on empty paragraph
              if (isEmptyParagraph(state)) {
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
  return $from.parent.type.name === 'paragraph' && $from.parent.content.size === 0
}

function openMenu(ext, view, items) {
  // Avoid duplicate menus
  if (ext._menu) return

  const effectiveItems = items || ext.options?.items || DEFAULT_ITEMS
  const editor = ext.editor

  const menuDOM = buildMenuDOM(effectiveItems, {
    onSelect: (item) => {
      if (item.type === 'separator') return
      runItemAction(item.key, editor)
      closeMenu(ext)
      view.focus()
    },
    onHighlight: () => {},
  })

  const caretRect = getCaretRect(view)
  // In jsdom (test env) layout is unavailable; fall back to a zero-sized rect
  // at the origin so the menu still renders.
  const anchorRect = caretRect || new DOMRect(0, 0, 0, 0)

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
  const { floating, cleanupOutside, cleanupEscape } = ext._menu
  cleanupOutside()
  cleanupEscape()
  floating.destroy()
  ext._menu = null
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
  runItemAction(item.key, ext.editor)
  closeMenu(ext)
  view.focus()
}
