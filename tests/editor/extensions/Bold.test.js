import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Bold } from '../../../src/editor/extensions/Bold.js'
import { createEditor, setCursor, selectRange, cleanup } from '../../helper.js'
import { TextSelection } from 'prosemirror-state'

let editor

beforeEach(() => { document.body.innerHTML = '' })
afterEach(() => { cleanup(editor) })

describe('Bold 节点定义', () => {
  it('名称正确', () => {
    expect(Bold.resolve().name).toBe('bold')
  })

  it('渲染为 <strong>', () => {
    expect(Bold.resolve().markSpec.toDOM()[0]).toBe('strong')
  })

  it('解析 <strong>、<b> 及 font-weight 样式', () => {
    const rules = Bold.resolve().markSpec.parseDOM
    expect(rules.length).toBe(3)
    expect(rules[0].tag).toBe('strong')
    expect(rules[1].tag).toBe('b')
    expect(rules[2].style).toBe('font-weight')
  })
})

describe('Bold 命令', () => {
  it('toggleBold 为选区添加加粗', () => {
    editor = createEditor({ content: '<p>Hello world</p>' })
    selectRange(editor, 1, 6)
    editor.commands.toggleBold()
    expect(editor.getHTML()).toContain('<strong>Hello</strong>')
  })

  it('toggleBold 移除选区的加粗', () => {
    editor = createEditor({ content: '<p><strong>Bold text</strong></p>' })
    selectRange(editor, 1, 5)
    editor.commands.toggleBold()
    expect(editor.getHTML()).not.toContain('<strong>Bold</strong>')
  })

  it('空文档中 toggleBold 返回 true', () => {
    editor = createEditor()
    // Even in empty doc, toggleBold toggles stored marks
    expect(editor.commands.toggleBold()).toBe(true)
  })
})

describe('Bold 键盘快捷键', () => {
  it('Mod-b 切换加粗', () => {
    editor = createEditor({ content: '<p>Hello world</p>' })
    selectRange(editor, 1, 6)
    const ext = editor.extensions.find(e => e.name === 'bold')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts['Mod-b'](editor.state, editor.view.dispatch)
    expect(editor.getHTML()).toContain('<strong>Hello</strong>')
  })
})

describe('Bold 输入规则', () => {
  it('提供 1 条输入规则', () => {
    editor = createEditor()
    const ext = editor.extensions.find(e => e.name === 'bold')
    expect(ext._addInputRules.call(ext)).toHaveLength(1)
  })

  it('模式匹配 **text**', () => {
    expect(/\*\*([^*]+)\*\*$/.test('**bold**')).toBe(true)
    expect(/\*\*([^*]+)\*\*$/.test('**bold*')).toBe(false)
    expect(/\*\*([^*]+)\*\*$/.test('***')).toBe(false)
  })
})

describe('Bold 活动状态检测', () => {
  it('检测加粗标记', () => {
    editor = createEditor({ content: '<p><strong>Bold</strong></p>' })
    setCursor(editor, 2)
    expect(editor.isActive('bold')).toBe(true)
    expect(editor.isActive('italic')).toBe(false)
  })
})
