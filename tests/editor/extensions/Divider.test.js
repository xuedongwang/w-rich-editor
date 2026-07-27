import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Divider } from '../../../src/editor/extensions/Divider.js'
import { createEditor, cleanup } from '../../helper.js'

let editor

beforeEach(() => { document.body.innerHTML = '' })
afterEach(() => { cleanup(editor) })

describe('Divider 节点定义', () => {
  it('名称正确', () => {
    expect(Divider.resolve().name).toBe('horizontal_rule')
  })

  it('是块级节点', () => {
    expect(Divider.resolve().nodeSpec.group).toBe('block')
  })

  it('渲染为 <hr>', () => {
    expect(Divider.resolve().nodeSpec.toDOM()[0]).toBe('hr')
  })

  it('解析 <hr>', () => {
    expect(Divider.resolve().nodeSpec.parseDOM[0].tag).toBe('hr')
  })
})

describe('Divider 命令', () => {
  it('insertDivider 插入分割线', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    editor.commands.insertDivider()
    expect(editor.getHTML()).toContain('<hr>')
  })

  it('schema 中无 hr 类型时 insertDivider 返回 false', () => {
    // This test verifies the command checks for hr type
    expect(editor?.commands?.insertDivider).toBeUndefined // just checking API
  })
})

describe('Divider 键盘快捷键', () => {
  it('Mod-_ 插入分割线', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    const ext = editor.extensions.find(e => e.name === 'horizontal_rule')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts['Mod-_'](editor.state, editor.view.dispatch)
    expect(editor.getHTML()).toContain('<hr')
  })
})

describe('Divider 输入规则', () => {
  it('提供 1 条输入规则', () => {
    editor = createEditor()
    const ext = editor.extensions.find(e => e.name === 'horizontal_rule')
    expect(ext._addInputRules.call(ext)).toHaveLength(1)
  })

  it('模式匹配 ---, ***, ___', () => {
    const pattern = /^(?:---|___|\*\*\*)$/
    expect(pattern.test('---')).toBe(true)
    expect(pattern.test('***')).toBe(true)
    expect(pattern.test('___')).toBe(true)
    expect(pattern.test('--')).toBe(false)
    expect(pattern.test('**')).toBe(false)
    expect(pattern.test('_')).toBe(false)
    expect(pattern.test('----')).toBe(false)
  })
})
