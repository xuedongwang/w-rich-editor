import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Italic } from '../../../src/editor/extensions/Italic.js'
import { createEditor, setCursor, selectRange, cleanup } from '../../helper.js'

let editor

beforeEach(() => { document.body.innerHTML = '' })
afterEach(() => { cleanup(editor) })

describe('Italic 节点定义', () => {
  it('名称正确', () => {
    expect(Italic.resolve().name).toBe('italic')
  })

  it('渲染为 <em>', () => {
    expect(Italic.resolve().markSpec.toDOM()[0]).toBe('em')
  })

  it('解析 <em>、<i> 及 font-style 样式', () => {
    const rules = Italic.resolve().markSpec.parseDOM
    expect(rules.length).toBe(3)
    expect(rules[0].tag).toBe('em')
    expect(rules[1].tag).toBe('i')
    expect(rules[2].style).toBe('font-style=italic')
  })
})

describe('Italic 命令', () => {
  it('toggleItalic 为选区添加斜体', () => {
    editor = createEditor({ content: '<p>Hello world</p>' })
    selectRange(editor, 1, 6)
    editor.commands.toggleItalic()
    expect(editor.getHTML()).toContain('<em>Hello</em>')
  })

  it('toggleItalic 移除选区的斜体', () => {
    editor = createEditor({ content: '<p><em>Italic text</em></p>' })
    selectRange(editor, 1, 5)
    editor.commands.toggleItalic()
    expect(editor.getHTML()).not.toContain('<em>Italic</em>')
  })
})

describe('Italic 键盘快捷键', () => {
  it('Mod-i 切换斜体', () => {
    editor = createEditor({ content: '<p>Hello world</p>' })
    selectRange(editor, 1, 6)
    const ext = editor.extensions.find(e => e.name === 'italic')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts['Mod-i'](editor.state, editor.view.dispatch)
    expect(editor.getHTML()).toContain('<em>Hello</em>')
  })
})

describe('Italic 输入规则', () => {
  it('提供 1 条输入规则', () => {
    editor = createEditor()
    const ext = editor.extensions.find(e => e.name === 'italic')
    expect(ext._addInputRules.call(ext)).toHaveLength(1)
  })

  it('模式匹配 *text*', () => {
    expect(/(?:^|\s)\*([^*]+)\*$/.test('*italic*')).toBe(true)
    expect(/(?:^|\s)\*([^*]+)\*$/.test(' *italic*')).toBe(true)
    expect(/(?:^|\s)\*([^*]+)\*$/.test('italic*')).toBe(false)
  })
})
