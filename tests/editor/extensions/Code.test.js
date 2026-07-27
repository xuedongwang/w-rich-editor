import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Code } from '../../../src/editor/extensions/Code.js'
import { createEditor, setCursor, selectRange, cleanup } from '../../helper.js'

let editor

beforeEach(() => { document.body.innerHTML = '' })
afterEach(() => { cleanup(editor) })

describe('Code 节点定义', () => {
  it('名称正确', () => {
    expect(Code.resolve().name).toBe('code')
  })

  it('非包含型', () => {
    expect(Code.resolve().markSpec.inclusive).toBe(false)
  })

  it('排除所有其他标记', () => {
    expect(Code.resolve().markSpec.excludes).toBe('_')
  })

  it('渲染为 <code>', () => {
    expect(Code.resolve().markSpec.toDOM()[0]).toBe('code')
  })

  it('解析 <code>', () => {
    expect(Code.resolve().markSpec.parseDOM[0].tag).toBe('code')
  })
})

describe('Code 命令', () => {
  it('toggleCode 为选区添加行内代码', () => {
    editor = createEditor({ content: '<p>Hello world</p>' })
    selectRange(editor, 1, 6)
    editor.commands.toggleCode()
    expect(editor.getHTML()).toContain('<code>Hello</code>')
  })

  it('toggleCode 移除选区的行内代码', () => {
    editor = createEditor({ content: '<p><code>code text</code></p>' })
    selectRange(editor, 1, 5)
    editor.commands.toggleCode()
    expect(editor.getHTML()).not.toContain('<code>code</code>')
  })
})

describe('Code 键盘快捷键', () => {
  it('Mod-` 切换行内代码', () => {
    editor = createEditor({ content: '<p>Hello world</p>' })
    selectRange(editor, 1, 6)
    const ext = editor.extensions.find(e => e.name === 'code')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts['Mod-`'](editor.state, editor.view.dispatch)
    expect(editor.getHTML()).toContain('<code>Hello</code>')
  })
})

describe('Code 输入规则', () => {
  it('提供 1 条输入规则', () => {
    editor = createEditor()
    const ext = editor.extensions.find(e => e.name === 'code')
    expect(ext._addInputRules.call(ext)).toHaveLength(1)
  })

  it('模式匹配 `text`', () => {
    expect(/`([^`]+)`$/.test('`code`')).toBe(true)
    expect(/`([^`]+)`$/.test('`code')).toBe(false)
    expect(/`([^`]+)`$/.test('``')).toBe(false)
  })
})
