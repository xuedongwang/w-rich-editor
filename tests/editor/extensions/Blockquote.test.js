import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Blockquote } from '../../../src/editor/extensions/Blockquote.js'
import { createEditor, setCursor, cleanup } from '../../helper.js'

let editor

beforeEach(() => { document.body.innerHTML = '' })
afterEach(() => { cleanup(editor) })

describe('Blockquote 节点定义', () => {
  it('名称正确', () => {
    expect(Blockquote.resolve().name).toBe('blockquote')
  })

  it('是块级节点', () => {
    expect(Blockquote.resolve().nodeSpec.group).toBe('block')
  })

  it('要求 block+ 内容', () => {
    expect(Blockquote.resolve().nodeSpec.content).toBe('block+')
  })

  it('具有 defining 属性', () => {
    expect(Blockquote.resolve().nodeSpec.defining).toBe(true)
  })

  it('渲染为 <blockquote> 元素', () => {
    expect(Blockquote.resolve().nodeSpec.toDOM()[0]).toBe('blockquote')
  })

  it('解析 <blockquote> 元素', () => {
    expect(Blockquote.resolve().nodeSpec.parseDOM[0].tag).toBe('blockquote')
  })
})

describe('Blockquote 命令', () => {
  it('toggleBlockquote 将段落包裹在 blockquote 中', () => {
    editor = createEditor({ content: '<p>Quoted</p>' })
    setCursor(editor, 1)
    editor.commands.toggleBlockquote()
    expect(editor.getHTML()).toContain('<blockquote>')
  })

  it('toggleBlockquote 解除 blockquote 包裹', () => {
    editor = createEditor({ content: '<blockquote><p>Quoted</p></blockquote>' })
    setCursor(editor, 2)
    editor.commands.toggleBlockquote()
    expect(editor.getHTML()).not.toContain('<blockquote>')
    expect(editor.getHTML()).toContain('<p>')
  })

  it('toggleBlockquote 反复切换', () => {
    editor = createEditor({ content: '<p>Text</p>' })
    setCursor(editor, 1)
    editor.commands.toggleBlockquote()
    expect(editor.getHTML()).toContain('<blockquote>')
    editor.commands.toggleBlockquote()
    expect(editor.getHTML()).not.toContain('<blockquote>')
  })
})

describe('Blockquote 快捷键', () => {
  it('Mod-Shift-b 包裹为 blockquote', () => {
    editor = createEditor({ content: '<p>Text</p>' })
    setCursor(editor, 1)
    const ext = editor.extensions.find(e => e.name === 'blockquote')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts['Mod-Shift-b'](editor.state, editor.view.dispatch)
    expect(editor.getHTML()).toContain('<blockquote>')
  })

  it('Mod-Shift-b 解除 blockquote 包裹', () => {
    editor = createEditor({ content: '<blockquote><p>Text</p></blockquote>' })
    setCursor(editor, 2)
    const ext = editor.extensions.find(e => e.name === 'blockquote')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts['Mod-Shift-b'](editor.state, editor.view.dispatch)
    expect(editor.getHTML()).not.toContain('<blockquote>')
  })
})

describe('Blockquote 输入规则', () => {
  it('提供 1 条输入规则', () => {
    editor = createEditor()
    const ext = editor.extensions.find(e => e.name === 'blockquote')
    expect(ext._addInputRules.call(ext)).toHaveLength(1)
  })

  it('> + 空格 模式匹配', () => {
    expect(/^>\s$/.test('> ')).toBe(true)
    expect(/^>\s$/.test('>')).toBe(false)
    expect(/^>\s$/.test('>> ')).toBe(false)
  })
})
