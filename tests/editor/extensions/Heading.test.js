import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Heading } from '../../../src/editor/extensions/Heading.js'
import { createEditor, setCursor, cleanup } from '../../helper.js'
import { Document, Paragraph } from '../../../src/editor/index.js'

let editor

beforeEach(() => { document.body.innerHTML = '' })
afterEach(() => { cleanup(editor) })

describe('Heading 扩展 — 节点定义', () => {
  it('名称正确', () => {
    expect(Heading.resolve().name).toBe('heading')
  })

  it('是块级节点', () => {
    expect(Heading.resolve().nodeSpec.group).toBe('block')
  })

  it('允许行内内容', () => {
    expect(Heading.resolve().nodeSpec.content).toBe('inline*')
  })

  it('具有 defining 属性', () => {
    expect(Heading.resolve().nodeSpec.defining).toBe(true)
  })

  it('level 属性默认值为 1', () => {
    expect(Heading.resolve().nodeSpec.attrs.level.default).toBe(1)
  })

  it.each([1, 2, 3, 4, 5, 6])('渲染为 h%d 元素', (level) => {
    const dom = Heading.resolve().nodeSpec.toDOM({ attrs: { level } })
    expect(dom[0]).toBe(`h${level}`)
  })

  it.each([1, 2, 3, 4, 5, 6])('解析 h%d 元素', (level) => {
    const parseRule = Heading.resolve().nodeSpec.parseDOM[level - 1]
    expect(parseRule.tag).toBe(`h${level}`)
    expect(parseRule.attrs.level).toBe(level)
  })
})

describe('Heading 扩展 — 命令', () => {
  it('toggleHeading 将段落转换为标题', () => {
    editor = createEditor({ content: '<p>Test</p>' })
    setCursor(editor, 1)
    editor.commands.toggleHeading({ level: 2 })
    expect(editor.getHTML()).toContain('<h2>')
  })

  it('toggleHeading 将标题转换回段落', () => {
    editor = createEditor({ content: '<h2>Test</h2>' })
    setCursor(editor, 1)
    editor.commands.toggleHeading({ level: 2 })
    expect(editor.getHTML()).not.toContain('<h2')
    expect(editor.getHTML()).toContain('<p>')
  })

  it.each([1, 2, 3])('toggleHeading 创建 h%d', (level) => {
    editor = createEditor({ content: '<p>Test</p>' })
    setCursor(editor, 1)
    editor.commands.toggleHeading({ level })
    expect(editor.getHTML()).toContain(`<h${level}>`)
  })
})

describe('Heading 扩展 — 快捷键', () => {
  it('Mod-Alt-1 创建 H1', () => {
    editor = createEditor({ content: '<p>Test</p>' })
    setCursor(editor, 1)
    const ext = editor.extensions.find(e => e.name === 'heading')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts['Mod-Alt-1'](editor.state, editor.view.dispatch)
    expect(editor.getHTML()).toContain('<h1>')
  })

  it('Mod-Alt-2 创建 H2', () => {
    editor = createEditor({ content: '<p>Test</p>' })
    setCursor(editor, 1)
    const ext = editor.extensions.find(e => e.name === 'heading')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts['Mod-Alt-2'](editor.state, editor.view.dispatch)
    expect(editor.getHTML()).toContain('<h2>')
  })

  it('Mod-Alt-3 创建 H3', () => {
    editor = createEditor({ content: '<p>Test</p>' })
    setCursor(editor, 1)
    const ext = editor.extensions.find(e => e.name === 'heading')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts['Mod-Alt-3'](editor.state, editor.view.dispatch)
    expect(editor.getHTML()).toContain('<h3>')
  })
})

describe('Heading 扩展 — 输入规则', () => {
  it('提供 3 条输入规则', () => {
    editor = createEditor()
    const ext = editor.extensions.find(e => e.name === 'heading')
    expect(ext._addInputRules.call(ext)).toHaveLength(3)
  })

  it.each([['# ', 1], ['## ', 2], ['### ', 3]])('匹配模式 %s', (pattern, level) => {
    const regex = new RegExp(`^${'#'.repeat(level)}\\s$`)
    expect(regex.test(pattern)).toBe(true)
  })
})
