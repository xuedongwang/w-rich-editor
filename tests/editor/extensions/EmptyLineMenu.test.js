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
// 自动显示
// ============================================================================

describe('EmptyLineMenu 自动显示', () => {
  it('空段落触发时创建菜单 DOM', () => {
    editor = createEditorWithMenu({ content: '<p></p>' })
    // 触发 plugin view.update — 编辑器初始状态不会自动调用 update
    editor.view.dispatch(editor.state.tr)
    const menu = document.querySelector('.empty-line-menu')
    expect(menu).toBeTruthy()
    cleanup(editor)
    editor = null
  })

  it('非空段落不显示菜单', () => {
    editor = createEditorWithMenu()
    editor.setContent('<p>Hello</p>')
    setCursor(editor, 3)
    const menu = document.querySelector('.empty-line-menu')
    expect(menu).toBe(null)
  })

  it('选区非空时不显示菜单', () => {
    editor = createEditorWithMenu()
    editor.setContent('<p>Hello</p>')
    selectRange(editor, 1, 4)
    const menu = document.querySelector('.empty-line-menu')
    expect(menu).toBe(null)
  })

  it('禁用后不显示菜单', () => {
    editor = createEditorWithMenu({ content: '<p></p>', enabled: false })
    const menu = document.querySelector('.empty-line-menu')
    expect(menu).toBe(null)
  })

  it('切换到非空段落时菜单关闭', () => {
    editor = createEditorWithMenu()
    editor.setContent('<p></p><p>text</p>')
    setCursor(editor, 1) // 第一个段落（空）→ 菜单出现
    expect(document.querySelector('.empty-line-menu')).toBeTruthy()
    // 移动到非空段落 → 菜单应关闭
    setCursor(editor, 7) // 在 "text" 段落内
    expect(document.querySelector('.empty-line-menu')).toBe(null)
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
    editor = createEditorWithMenu({ content: '<p></p>', items: customItems })
    setCursor(editor, 1)
    const menu = document.querySelector('.empty-line-menu')
    expect(menu).toBeTruthy()
    const rows = menu.querySelectorAll('.empty-line-menu-item')
    expect(rows.length).toBe(1)
    expect(rows[0].textContent).toContain('自定义标题')
  })

  it('默认菜单包含常用块类型', () => {
    editor = createEditorWithMenu({ content: '<p></p>' })
    setCursor(editor, 1)
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
