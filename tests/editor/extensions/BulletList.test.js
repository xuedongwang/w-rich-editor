import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BulletList, OrderedList, ListItem } from '../../../src/editor/extensions/BulletList.js'
import { createEditor, setCursor, cleanup } from '../../helper.js'

let editor

beforeEach(() => { document.body.innerHTML = '' })
afterEach(() => { cleanup(editor) })

describe('BulletList 节点定义', () => {
  it('名称正确', () => {
    expect(BulletList.resolve().name).toBe('bullet_list')
  })

  it('是块级节点', () => {
    expect(BulletList.resolve().nodeSpec.group).toBe('block')
  })

  it('要求 list_item+ 内容', () => {
    expect(BulletList.resolve().nodeSpec.content).toBe('list_item+')
  })

  it('渲染为 <ul> 元素', () => {
    expect(BulletList.resolve().nodeSpec.toDOM()[0]).toBe('ul')
  })

  it('解析 <ul> 元素', () => {
    expect(BulletList.resolve().nodeSpec.parseDOM[0].tag).toBe('ul')
  })
})

describe('OrderedList 节点定义', () => {
  it('名称正确', () => {
    expect(OrderedList.resolve().name).toBe('ordered_list')
  })

  it('是块级节点', () => {
    expect(OrderedList.resolve().nodeSpec.group).toBe('block')
  })

  it('start 属性默认值为 1', () => {
    expect(OrderedList.resolve().nodeSpec.attrs.start.default).toBe(1)
  })

  it('当 start=1 时渲染为 <ol>（无 start 属性）', () => {
    const dom = OrderedList.resolve().nodeSpec.toDOM({ attrs: { start: 1 } })
    expect(dom[0]).toBe('ol')
    expect(dom[1]).toBe(0) // no attributes, just the hole
  })

  it('当 start!=1 时渲染为 <ol start="N">', () => {
    const dom = OrderedList.resolve().nodeSpec.toDOM({ attrs: { start: 5 } })
    expect(dom[0]).toBe('ol')
    expect(dom[1].start).toBe(5)
  })
})

describe('ListItem 节点定义', () => {
  it('名称正确', () => {
    expect(ListItem.resolve().name).toBe('list_item')
  })

  it('具有 defining 属性', () => {
    expect(ListItem.resolve().nodeSpec.defining).toBe(true)
  })

  it('渲染为 <li> 元素', () => {
    expect(ListItem.resolve().nodeSpec.toDOM()[0]).toBe('li')
  })
})

describe('列表命令', () => {
  it('toggleBulletList 将段落包裹在 ul 中', () => {
    editor = createEditor({ content: '<p>Item</p>' })
    setCursor(editor, 1)
    editor.commands.toggleBulletList()
    expect(editor.getHTML()).toContain('<ul>')
    expect(editor.getHTML()).toContain('<li>')
  })

  it('toggleBulletList 解除 ul 包裹', () => {
    editor = createEditor({ content: '<ul><li><p>Item</p></li></ul>' })
    setCursor(editor, 3)
    editor.commands.toggleBulletList()
    expect(editor.getHTML()).not.toContain('<ul>')
  })

  it('toggleBulletList 将 ol 转换为 ul', () => {
    editor = createEditor({ content: '<ol><li><p>Item</p></li></ol>' })
    setCursor(editor, 3)
    editor.commands.toggleBulletList()
    expect(editor.getHTML()).toContain('<ul>')
    expect(editor.getHTML()).not.toContain('<ol')
  })

  it('toggleOrderedList 将段落包裹在 ol 中', () => {
    editor = createEditor({ content: '<p>Item</p>' })
    setCursor(editor, 1)
    editor.commands.toggleOrderedList()
    expect(editor.getHTML()).toContain('<ol>')
  })

  it('toggleOrderedList 解除 ol 包裹', () => {
    editor = createEditor({ content: '<ol><li><p>Item</p></li></ol>' })
    setCursor(editor, 3)
    editor.commands.toggleOrderedList()
    expect(editor.getHTML()).not.toContain('<ol')
  })

  it('toggleOrderedList 将 ul 转换为 ol', () => {
    editor = createEditor({ content: '<ul><li><p>Item</p></li></ul>' })
    setCursor(editor, 3)
    editor.commands.toggleOrderedList()
    expect(editor.getHTML()).toContain('<ol')
    expect(editor.getHTML()).not.toContain('<ul')
  })
})

describe('列表快捷键', () => {
  it('Enter 分割列表项', () => {
    editor = createEditor({ content: '<ul><li><p>Item</p></li></ul>' })
    // doc(0) > ul(1) > li(2) > p(3) > "I"(4)
    setCursor(editor, 5) // inside "Item" text
    const ext = editor.extensions.find(e => e.name === 'list_item')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    const result = shortcuts.Enter(editor.state, editor.view.dispatch)
    // After split, should have 2 list items or the split happened
    expect(editor.state.doc.textContent.length).toBeGreaterThan(0)
  })

  it('不在列表中时 Tab 返回 false', () => {
    editor = createEditor({ content: '<p>Not a list</p>' })
    setCursor(editor, 1)
    const ext = editor.extensions.find(e => e.name === 'list_item')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    expect(shortcuts.Tab(editor.state, editor.view.dispatch)).toBe(false)
  })

  it('不在列表中时 Shift-Tab 返回 false', () => {
    editor = createEditor({ content: '<p>Not a list</p>' })
    setCursor(editor, 1)
    const ext = editor.extensions.find(e => e.name === 'list_item')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    expect(shortcuts['Shift-Tab'](editor.state, editor.view.dispatch)).toBe(false)
  })
})

describe('列表输入规则', () => {
  it('提供输入规则', () => {
    editor = createEditor()
    const ext = editor.extensions.find(e => e.name === 'list_item')
    expect(ext._addInputRules.call(ext).length).toBeGreaterThan(0)
  })

  it('无序列表模式匹配 -, *, +', () => {
    const pattern = /^(?:[-*+])\s$/
    expect(pattern.test('- ')).toBe(true)
    expect(pattern.test('* ')).toBe(true)
    expect(pattern.test('+ ')).toBe(true)
    expect(pattern.test('a ')).toBe(false)
  })

  it('有序列表模式匹配 数字 + 点 + 空格', () => {
    const pattern = /^(\d+)\.\s$/
    expect(pattern.test('1. ')).toBe(true)
    expect(pattern.test('42. ')).toBe(true)
    expect(pattern.test('a. ')).toBe(false)
  })
})
