import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TextSelection } from 'prosemirror-state'
import { EmptyLineMenu } from '../../../src/editor/extensions/EmptyLineMenu.js'
import { DEFAULT_EXTENSIONS, createEditor, setCursor, selectRange, cleanup } from '../../helper.js'

let editor

beforeEach(() => { document.body.innerHTML = '' })
afterEach(() => { cleanup(editor) })

/**
 * Create an editor with EmptyLineMenu added to the default extensions.
 * Optionally pass EmptyLineMenu options to override defaults.
 */
function createEditorWithMenu(options) {
  const ext = options !== undefined
    ? EmptyLineMenu.configure(options)
    : EmptyLineMenu.resolve()
  return createEditor({
    extensions: [...DEFAULT_EXTENSIONS, ext],
  })
}

/**
 * Simulate a keydown event on the editor view.
 */
function simulateKey(editor, key, opts = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  })
  return editor.view.dom.dispatchEvent(event)
}

/**
 * Type a character via keydown event.
 * Uses handleKeyDown detection (does NOT insert into the document).
 */
function typeChar(editor, char) {
  simulateKey(editor, char)
}

// ============================================================================
// 扩展定义
// ============================================================================

describe('EmptyLineMenu 扩展定义', () => {
  it('名称正确', () => {
    expect(EmptyLineMenu.resolve().name).toBe('emptyLineMenu')
  })

  it('类型为 extension', () => {
    expect(EmptyLineMenu.resolve().type).toBe('extension')
  })

  it('可独立解析', () => {
    const resolved = EmptyLineMenu.resolve()
    expect(resolved._addProseMirrorPlugins).toBeDefined()
    expect(resolved._addCommands).toBeDefined()
    expect(resolved._addKeyboardShortcuts).toBeDefined()
  })
})

// ============================================================================
// 命令
// ============================================================================

describe('EmptyLineMenu 命令', () => {
  it('openEmptyLineMenu 命令存在', () => {
    editor = createEditorWithMenu()
    expect(typeof editor.commands.openEmptyLineMenu).toBe('function')
  })

  it('closeEmptyLineMenu 命令存在', () => {
    editor = createEditorWithMenu()
    expect(typeof editor.commands.closeEmptyLineMenu).toBe('function')
  })
})

// ============================================================================
// 触发条件：仅在空行输入 / 时展示菜单
// ============================================================================

describe('EmptyLineMenu 触发条件', () => {
  it('空段落不会自动打开菜单', () => {
    editor = createEditorWithMenu()
    editor.setContent('<p></p>')
    setCursor(editor, 1)
    // Trigger plugin view.update
    editor.view.dispatch(editor.state.tr)
    const menu = document.querySelector('.empty-line-menu')
    expect(menu).toBe(null)
  })

  it('在空行输入 / 打开菜单', () => {
    editor = createEditorWithMenu()
    editor.setContent('<p></p>')
    setCursor(editor, 1)
    // Simulate typing '/'
    typeChar(editor, '/')
    const menu = document.querySelector('.empty-line-menu')
    expect(menu).toBeTruthy()
  })

  it('输入 / 后文档包含斜杠字符', () => {
    editor = createEditorWithMenu()
    editor.setContent('<p></p>')
    setCursor(editor, 1)
    typeChar(editor, '/')
    // The document should contain '/'
    const text = editor.state.doc.textContent
    expect(text).toBe('/')
  })

  it('在非空行输入 / 不打开菜单', () => {
    editor = createEditorWithMenu()
    editor.setContent('<p>hello</p>')
    setCursor(editor, 6) // end of "hello"
    typeChar(editor, '/')
    const menu = document.querySelector('.empty-line-menu')
    expect(menu).toBe(null)
  })

  it('选区非空时输入 / 不打开菜单', () => {
    editor = createEditorWithMenu()
    editor.setContent('<p>hello</p>')
    selectRange(editor, 1, 4)
    typeChar(editor, '/')
    const menu = document.querySelector('.empty-line-menu')
    expect(menu).toBe(null)
  })

  it('禁用后输入 / 不打开菜单', () => {
    editor = createEditorWithMenu({ enabled: false })
    editor.setContent('<p></p>')
    setCursor(editor, 1)
    typeChar(editor, '/')
    const menu = document.querySelector('.empty-line-menu')
    expect(menu).toBe(null)
  })

  it('仅点击空段落不打开菜单', () => {
    editor = createEditorWithMenu()
    editor.setContent('<p></p><p>text</p>')
    // Move cursor to empty paragraph (simulating a click)
    setCursor(editor, 1)
    // Dispatch a no-op transaction to trigger view.update
    editor.view.dispatch(editor.state.tr)
    const menu = document.querySelector('.empty-line-menu')
    expect(menu).toBe(null)
  })

  it('从非空段落移动到空段落不打开菜单', () => {
    editor = createEditorWithMenu()
    editor.setContent('<p>text</p><p></p>')
    setCursor(editor, 1) // non-empty paragraph
    editor.view.dispatch(editor.state.tr)
    expect(document.querySelector('.empty-line-menu')).toBe(null)
    // Move to empty paragraph
    setCursor(editor, 6) // empty paragraph
    editor.view.dispatch(editor.state.tr)
    expect(document.querySelector('.empty-line-menu')).toBe(null)
  })

  it('在 blockquote 内的空段落输入 / 不打开菜单', () => {
    editor = createEditorWithMenu()
    editor.setContent('<blockquote><p></p></blockquote>')
    // Cursor inside the blockquote's paragraph (depth 2)
    setCursor(editor, 2)
    typeChar(editor, '/')
    const menu = document.querySelector('.empty-line-menu')
    expect(menu).toBe(null)
  })

  it('在列表项内的空段落输入 / 不打开菜单', () => {
    editor = createEditorWithMenu()
    editor.setContent('<ul><li><p></p></li></ul>')
    // Cursor inside the list item's paragraph (depth 3)
    setCursor(editor, 3)
    typeChar(editor, '/')
    const menu = document.querySelector('.empty-line-menu')
    expect(menu).toBe(null)
  })
})

// ============================================================================
// 菜单关闭
// ============================================================================

describe('EmptyLineMenu 菜单关闭', () => {
  it('删除 / 后菜单关闭', () => {
    editor = createEditorWithMenu()
    editor.setContent('<p></p>')
    setCursor(editor, 1)
    typeChar(editor, '/')
    expect(document.querySelector('.empty-line-menu')).toBeTruthy()
    // jsdom has no contenteditable — directly delete the '/' via transaction
    const tr = editor.state.tr.delete(1, 2)
    editor.view.dispatch(tr)
    const menu = document.querySelector('.empty-line-menu')
    expect(menu).toBe(null)
  })

  it('按 Escape 关闭菜单', () => {
    editor = createEditorWithMenu()
    editor.setContent('<p></p>')
    setCursor(editor, 1)
    typeChar(editor, '/')
    expect(document.querySelector('.empty-line-menu')).toBeTruthy()
    // Press Escape
    simulateKey(editor, 'Escape')
    const menu = document.querySelector('.empty-line-menu')
    expect(menu).toBe(null)
  })

  it('光标移出段落时菜单关闭', () => {
    editor = createEditorWithMenu()
    editor.setContent('<p></p><p>text</p>')
    setCursor(editor, 1)
    typeChar(editor, '/')
    expect(document.querySelector('.empty-line-menu')).toBeTruthy()
    // Move cursor to second paragraph
    setCursor(editor, 4) // inside "text" paragraph
    expect(document.querySelector('.empty-line-menu')).toBe(null)
  })

  it('输入额外字符后菜单关闭', () => {
    editor = createEditorWithMenu()
    editor.setContent('<p></p>')
    setCursor(editor, 1)
    typeChar(editor, '/')
    expect(document.querySelector('.empty-line-menu')).toBeTruthy()
    // jsdom has no contenteditable — directly insert text via transaction
    const tr = editor.state.tr.insertText('a', 2)
    editor.view.dispatch(tr)
    const menu = document.querySelector('.empty-line-menu')
    expect(menu).toBe(null)
  })
})

// ============================================================================
// 自定义菜单项
// ============================================================================

describe('EmptyLineMenu 自定义菜单项', () => {
  it('支持通过 configure 自定义菜单项', () => {
    const customItems = [
      { key: 'heading-1', label: '自定义标题', icon: 'H1', group: 'custom' },
    ]
    editor = createEditorWithMenu({ items: customItems })
    editor.setContent('<p></p>')
    setCursor(editor, 1)
    typeChar(editor, '/')
    const menu = document.querySelector('.empty-line-menu')
    expect(menu).toBeTruthy()
    const rows = menu.querySelectorAll('.empty-line-menu-item')
    expect(rows.length).toBe(1)
    expect(rows[0].textContent).toContain('自定义标题')
  })

  it('默认菜单包含常用块类型', () => {
    editor = createEditorWithMenu()
    editor.setContent('<p></p>')
    setCursor(editor, 1)
    typeChar(editor, '/')
    const menu = document.querySelector('.empty-line-menu')
    expect(menu).toBeTruthy()
    const labels = Array.from(menu.querySelectorAll('.empty-line-menu-label'))
      .map(el => el.textContent)
    expect(labels).toContain('段落')
    expect(labels).toContain('标题 1')
    expect(labels).toContain('无序列表')
    expect(labels).toContain('引用')
    expect(labels).toContain('代码块')
  })
})
