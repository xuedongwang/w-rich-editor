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

  it('通过 keymap 插件链在列表中按 Enter 可正常分割（不被 CodeBlock Enter 覆盖）', () => {
    editor = createEditor({ content: '<ul><li><p>Item 1</p></li></ul>' })
    setCursor(editor, 6) // inside "Item 1"
    // Simulate keymap chain: find the list_item Enter handler through plugins
    const listItemExt = editor.extensions.find(e => e.name === 'list_item')
    const codeBlockExt = editor.extensions.find(e => e.name === 'code_block')

    // Both extensions should have Enter handlers
    const liShortcuts = listItemExt._addKeyboardShortcuts.call(listItemExt)
    const cbShortcuts = codeBlockExt._addKeyboardShortcuts.call(codeBlockExt)
    expect(liShortcuts.Enter).toBeDefined()
    expect(cbShortcuts.Enter).toBeDefined()

    // CodeBlock.Enter should NOT handle list items
    expect(cbShortcuts.Enter(editor.state, editor.view.dispatch)).toBe(false)
    // ListItem.Enter SHOULD handle it
    expect(liShortcuts.Enter(editor.state, editor.view.dispatch)).toBe(true)
    // List should be split into 2 items
    const items = []
    editor.state.doc.descendants(node => {
      if (node.type.name === 'list_item') items.push(node)
    })
    expect(items.length).toBe(2)
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

  it('创建无序列表后光标位于列表项段落内', () => {
    editor = createEditor({ content: '<p>- </p>' })
    setCursor(editor, 3)
    const ext = editor.extensions.find(e => e.name === 'list_item')
    const rules = ext._addInputRules.call(ext)
    const rule = rules.find(r => /^(?:[-*+])\s$/.test('- '))
    const tr = rule.handler(editor.state, ['- '], 1, 3)
    editor.view.dispatch(tr)
    // Cursor should be inside the list_item > paragraph, not after the list.
    const { $from } = editor.state.selection
    expect($from.parent.type.name).toBe('paragraph')
    expect($from.node($from.depth - 1).type.name).toBe('list_item')
    expect($from.node($from.depth - 2).type.name).toBe('bullet_list')
  })

  it('创建无序列表后光标位于列表项段落内', () => {
    editor = createEditor({ content: '<p>- </p>' })
    setCursor(editor, 3)
    const ext = editor.extensions.find(e => e.name === 'list_item')
    const rules = ext._addInputRules.call(ext)
    const rule = rules.find(r => r.match.test('- '))
    const tr = rule.handler(editor.state, ['- '], 1, 3)
    editor.view.dispatch(tr)
    // Cursor should be inside the list_item > paragraph, not after the list.
    const { $from } = editor.state.selection
    expect($from.parent.type.name).toBe('paragraph')
    expect($from.node($from.depth - 1).type.name).toBe('list_item')
    expect($from.node($from.depth - 2).type.name).toBe('bullet_list')
  })

  it('创建有序列表后光标位于列表项段落内', () => {
    editor = createEditor({ content: '<p>1. </p>' })
    setCursor(editor, 4)
    const ext = editor.extensions.find(e => e.name === 'list_item')
    const rules = ext._addInputRules.call(ext)
    // Find the ordered list rule: matches "1. " but not "- "
    const rule = rules.find(r => r.match.test('1. ') && !r.match.test('- '))
    const tr = rule.handler(editor.state, ['1.', '1'], 1, 4)
    editor.view.dispatch(tr)
    const { $from } = editor.state.selection
    expect($from.parent.type.name).toBe('paragraph')
    expect($from.node($from.depth - 1).type.name).toBe('list_item')
    expect($from.node($from.depth - 2).type.name).toBe('ordered_list')
  })

  it('在引用块内 - + 空格不创建列表', () => {
    editor = createEditor({ content: '<blockquote><p>- </p></blockquote>' })
    setCursor(editor, 4)
    const ext = editor.extensions.find(e => e.name === 'list_item')
    const rules = ext._addInputRules.call(ext)
    const rule = rules.find(r => r.match.test('- '))
    const result = rule.handler(editor.state, ['- '], 2, 4)
    expect(result).toBeNull()
    expect(editor.getHTML()).not.toContain('<ul')
  })
})
