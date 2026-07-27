import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { OrderedList } from '../../../src/editor/extensions/BulletList.js'

describe('OrderedList（来自 BulletList 模块）', () => {
  it('名称正确', () => {
    expect(OrderedList.resolve().name).toBe('ordered_list')
  })

  it('作为独立扩展导出', () => {
    expect(OrderedList.resolve).toBeTypeOf('function')
    expect(OrderedList.configure).toBeTypeOf('function')
  })

  it('可独立解析', () => {
    const resolved = OrderedList.resolve()
    expect(resolved.type).toBe('node')
    expect(resolved.nodeSpec.group).toBe('block')
    expect(resolved.nodeSpec.content).toBe('list_item+')
  })
})
