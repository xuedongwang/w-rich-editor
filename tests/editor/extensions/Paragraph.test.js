import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Paragraph } from '../../../src/editor/extensions/Paragraph.js'

let resolved

beforeEach(() => {
  resolved = Paragraph.resolve()
})

describe('Paragraph 扩展', () => {
  it('名称正确', () => {
    expect(resolved.name).toBe('paragraph')
  })

  it('是块级节点', () => {
    expect(resolved.nodeSpec.group).toBe('block')
  })

  it('允许行内内容', () => {
    expect(resolved.nodeSpec.content).toBe('inline*')
  })

  it('渲染为 <p> 元素', () => {
    const dom = resolved.nodeSpec.toDOM({ attrs: { align: null } })
    expect(dom[0]).toBe('p')
  })

  it('具有 align 属性，默认值为 null', () => {
    expect(resolved.nodeSpec.attrs.align.default).toBeNull()
  })

  it('解析 <p> 元素', () => {
    expect(resolved.nodeSpec.parseDOM[0].tag).toBe('p')
  })

  it('通过 getAttrs 解析 text-align 样式', () => {
    const rule = resolved.nodeSpec.parseDOM[0]
    expect(rule.tag).toBe('p')
    // Simulate a DOM element with text-align style
    expect(rule.getAttrs({ style: { textAlign: 'center' } })).toEqual({ align: 'center' })
    expect(rule.getAttrs({ style: { textAlign: 'right' } })).toEqual({ align: 'right' })
    expect(rule.getAttrs({ style: { textAlign: 'justify' } })).toEqual({ align: 'justify' })
    // No alignment → empty attrs (use defaults)
    expect(rule.getAttrs({ style: { textAlign: '' } })).toEqual({})
    expect(rule.getAttrs({})).toEqual({})
  })

  it('无命令', () => {
    expect(resolved._addCommands).toBeUndefined()
  })

  it('无键盘快捷键', () => {
    expect(resolved._addKeyboardShortcuts).toBeUndefined()
  })
})
