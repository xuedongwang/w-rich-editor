import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { History } from '../../../src/editor/extensions/History.js'
import { createEditor, setCursor, cleanup } from '../../helper.js'

let editor

beforeEach(() => { document.body.innerHTML = '' })
afterEach(() => { cleanup(editor) })

describe('History 扩展', () => {
  it('名称正确', () => {
    expect(History.resolve().name).toBe('history')
  })

  it('提供命令', () => {
    const resolved = History.resolve()
    const cmds = resolved._addCommands.call({ editor: null, options: {} })
    expect(cmds.undo).toBeTypeOf('function')
    expect(cmds.redo).toBeTypeOf('function')
  })

  it('提供键盘快捷键', () => {
    const resolved = History.resolve()
    const shortcuts = resolved._addKeyboardShortcuts.call({ editor: null, options: {} })
    expect(shortcuts['Mod-z']).toBeTypeOf('function')
    expect(shortcuts['Mod-y']).toBeTypeOf('function')
    expect(shortcuts['Mod-Shift-z']).toBeTypeOf('function')
  })

  it('提供 history 插件', () => {
    const resolved = History.resolve()
    const plugins = resolved._addProseMirrorPlugins.call({ editor: null, options: {} })
    expect(plugins).toHaveLength(1)
  })
})

describe('History 撤销/重做', () => {
  it('撤销恢复上一次修改', () => {
    editor = createEditor({ content: '<p>Text</p>' })
    setCursor(editor, 1)
    editor.commands.toggleHeading({ level: 1 })
    expect(editor.getHTML()).toContain('<h1>')
    editor.commands.undo()
    expect(editor.getHTML()).toContain('<p>')
  })

  it('重做重新应用已撤销的修改', () => {
    editor = createEditor({ content: '<p>Text</p>' })
    setCursor(editor, 1)
    editor.commands.toggleHeading({ level: 1 })
    editor.commands.undo()
    editor.commands.redo()
    expect(editor.getHTML()).toContain('<h1>')
  })

  it('连续多次撤销依次生效', () => {
    editor = createEditor({ content: '<p>Text</p>' })
    setCursor(editor, 1)
    editor.commands.toggleHeading({ level: 1 })
    editor.commands.toggleBold()
    // Apply bold to text via stored marks and insert
    editor.view.dispatch(editor.state.tr.insertText('X'))
    const withChanges = editor.getHTML()
    editor.commands.undo()
    // After one undo, should be different from withChanges
    expect(editor.getHTML()).not.toBe(withChanges)
  })

  it('撤销后新修改会清空重做栈', () => {
    editor = createEditor({ content: '<p>Text</p>' })
    setCursor(editor, 1)
    editor.commands.toggleHeading({ level: 1 })
    editor.commands.undo()
    // Make a new change — redo stack should clear
    editor.commands.toggleHeading({ level: 2 })
    expect(editor.getHTML()).toContain('<h2>')
    // Redo should do nothing (stack was cleared)
    editor.commands.redo()
    expect(editor.getHTML()).toContain('<h2>')
  })

  it('无历史时 undo 返回 false', () => {
    editor = createEditor({ content: '<p>Fresh</p>' })
    // No changes made, undo should fail
    expect(editor.commands.undo()).toBe(false)
  })
})

describe('History 键盘快捷键', () => {
  it('Mod-z 触发撤销', () => {
    editor = createEditor({ content: '<p>Text</p>' })
    setCursor(editor, 1)
    editor.commands.toggleHeading({ level: 1 })
    const ext = editor.extensions.find(e => e.name === 'history')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts['Mod-z'](editor.state, editor.view.dispatch)
    expect(editor.getHTML()).toContain('<p>')
  })

  it('Mod-y 触发重做', () => {
    editor = createEditor({ content: '<p>Text</p>' })
    setCursor(editor, 1)
    editor.commands.toggleHeading({ level: 1 })
    editor.commands.undo()
    const ext = editor.extensions.find(e => e.name === 'history')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts['Mod-y'](editor.state, editor.view.dispatch)
    expect(editor.getHTML()).toContain('<h1>')
  })

  it('Mod-Shift-z 触发重做', () => {
    editor = createEditor({ content: '<p>Text</p>' })
    setCursor(editor, 1)
    editor.commands.toggleHeading({ level: 1 })
    editor.commands.undo()
    const ext = editor.extensions.find(e => e.name === 'history')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts['Mod-Shift-z'](editor.state, editor.view.dispatch)
    expect(editor.getHTML()).toContain('<h1>')
  })
})
