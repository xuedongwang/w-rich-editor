import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Document } from '../../../src/editor/extensions/Document.js'

let resolved

beforeEach(() => {
  resolved = Document.resolve()
})

describe('Document 扩展', () => {
  it('名称正确', () => {
    expect(resolved.name).toBe('doc')
  })

  it('节点类型正确', () => {
    expect(resolved.type).toBe('node')
  })

  it('要求 block+ 内容', () => {
    expect(resolved.nodeSpec.content).toBe('block+')
  })

  it('无 group（顶层节点）', () => {
    expect(resolved.nodeSpec.group).toBeUndefined()
  })
})
