import { describe, it, expect } from 'vitest'
import { DropCursorExt } from '../../../src/editor/extensions/DropCursor.js'

describe('DropCursor 扩展', () => {
  it('名称正确', () => {
    expect(DropCursorExt.resolve().name).toBe('dropCursor')
  })

  it('扩展类型为 extension', () => {
    expect(DropCursorExt.resolve().type).toBe('extension')
  })

  it('提供 drop cursor 插件', () => {
    const resolved = DropCursorExt.resolve()
    const plugins = resolved._addProseMirrorPlugins.call({ editor: null, options: {} })
    expect(plugins).toHaveLength(1)
    expect(plugins[0]).toBeDefined()
  })

  it('无命令', () => {
    expect(DropCursorExt.resolve()._addCommands).toBeUndefined()
  })

  it('无键盘快捷键', () => {
    expect(DropCursorExt.resolve()._addKeyboardShortcuts).toBeUndefined()
  })

  it('无输入规则', () => {
    expect(DropCursorExt.resolve()._addInputRules).toBeUndefined()
  })
})
