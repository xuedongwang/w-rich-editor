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
    const dom = resolved.nodeSpec.toDOM()
    expect(dom[0]).toBe('p')
  })

  it('解析 <p> 元素', () => {
    expect(resolved.nodeSpec.parseDOM[0].tag).toBe('p')
  })

  it('无命令', () => {
    expect(resolved._addCommands).toBeUndefined()
  })

  it('无键盘快捷键', () => {
    expect(resolved._addKeyboardShortcuts).toBeUndefined()
  })
})
