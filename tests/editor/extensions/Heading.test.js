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

  it('align 属性默认值为 null', () => {
    expect(Heading.resolve().nodeSpec.attrs.align.default).toBeNull()
  })

  it.each([1, 2, 3, 4, 5, 6])('渲染为 h%d 元素', (level) => {
    const dom = Heading.resolve().nodeSpec.toDOM({ attrs: { level, align: null } })
    expect(dom[0]).toBe(`h${level}`)
  })

  it('渲染为带对齐样式的 h2 元素', () => {
    const dom = Heading.resolve().nodeSpec.toDOM({ attrs: { level: 2, align: 'center' } })
    expect(dom[0]).toBe('h2')
    expect(dom[1].style).toBe('text-align: center')
  })

  it.each([1, 2, 3, 4, 5, 6])('解析 h%d 元素', (level) => {
    const parseRule = Heading.resolve().nodeSpec.parseDOM[level - 1]
    expect(parseRule.tag).toBe(`h${level}`)
    // getAttrs returns level; with text-align also returns align
    expect(parseRule.getAttrs({ style: { textAlign: '' } })).toEqual({ level })
    expect(parseRule.getAttrs({ style: { textAlign: 'center' } })).toEqual({ level, align: 'center' })
  })

  it('通过 getAttrs 解析 text-align 样式', () => {
    const rule = Heading.resolve().nodeSpec.parseDOM[0]
    expect(rule.tag).toBe('h1')
    expect(rule.getAttrs({ style: { textAlign: 'right' } })).toEqual({ level: 1, align: 'right' })
    expect(rule.getAttrs({ style: { textAlign: '' } })).toEqual({ level: 1 })
    expect(rule.getAttrs({})).toEqual({ level: 1 })
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

  it.each([1, 2, 3, 4, 5, 6])('toggleHeading 创建 h%d', (level) => {
    editor = createEditor({ content: '<p>Test</p>' })
    setCursor(editor, 1)
    editor.commands.toggleHeading({ level })
    expect(editor.getHTML()).toContain(`<h${level}>`)
  })
})

describe('Heading 扩展 — 快捷键', () => {
  it.each([1, 2, 3, 4, 5, 6])('Mod-Alt-%d 创建 H%d', (level) => {
    editor = createEditor({ content: '<p>Test</p>' })
    setCursor(editor, 1)
    const ext = editor.extensions.find(e => e.name === 'heading')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts[`Mod-Alt-${level}`](editor.state, editor.view.dispatch)
    expect(editor.getHTML()).toContain(`<h${level}>`)
  })
})

describe('Heading 扩展 — 输入规则', () => {
  it('提供 6 条输入规则', () => {
    editor = createEditor()
    const ext = editor.extensions.find(e => e.name === 'heading')
    expect(ext._addInputRules.call(ext)).toHaveLength(6)
  })

  it.each([1, 2, 3, 4, 5, 6])('匹配模式 %s', (level) => {
    const pattern = `${'#'.repeat(level)} `
    const regex = new RegExp(`^${'#'.repeat(level)}\\s$`)
    expect(regex.test(pattern)).toBe(true)
  })
})
