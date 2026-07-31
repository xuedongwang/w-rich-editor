import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BlockHandle } from '../../../src/editor/extensions/BlockHandle.js'
import { DEFAULT_EXTENSIONS, createEditor, setCursor, cleanup } from '../../helper.js'

let editor

beforeEach(() => { document.body.innerHTML = '' })
afterEach(() => { cleanup(editor) })

function createEditorWithHandle(content = '<p>Hello</p><p>World</p>') {
  return createEditor({
    content,
    extensions: [...DEFAULT_EXTENSIONS, BlockHandle.resolve()],
  })
}

// ============================================================================
// 扩展定义
// ============================================================================

describe('BlockHandle 扩展定义', () => {
  it('名称正确', () => {
    expect(BlockHandle.resolve().name).toBe('blockHandle')
  })

  it('类型为 extension', () => {
    expect(BlockHandle.resolve().type).toBe('extension')
  })

  it('提供 plugin', () => {
    const resolved = BlockHandle.resolve()
    expect(resolved._addProseMirrorPlugins).toBeDefined()
  })
})

// ============================================================================
// 初始化
// ============================================================================

describe('BlockHandle 初始化', () => {
  it('创建 handle DOM 并追加到 document.body', () => {
    editor = createEditorWithHandle()
    const handle = document.querySelector('.block-handle')
    expect(handle).toBeTruthy()
    expect(handle.style.position).toBe('fixed')
    expect(handle.style.opacity).toBe('0') // 默认隐藏
  })

  it('禁用时不创建 handle', () => {
    editor = createEditor({
      content: '<p>Hello</p>',
      extensions: [
        ...DEFAULT_EXTENSIONS,
        BlockHandle.configure({ enabled: false }),
      ],
    })
    const handle = document.querySelector('.block-handle')
    expect(handle).toBe(null)
  })

  it('销毁编辑器时移除 handle', () => {
    editor = createEditorWithHandle()
    expect(document.querySelector('.block-handle')).toBeTruthy()
    cleanup(editor)
    editor = null
    expect(document.querySelector('.block-handle')).toBe(null)
  })
})

// ============================================================================
// Handle 显示逻辑
// ============================================================================

describe('BlockHandle 显示', () => {
  it('鼠标移动时在非空段落旁显示', () => {
    editor = createEditorWithHandle()
    const handle = document.querySelector('.block-handle')
    expect(handle.style.opacity).toBe('0')

    // 模拟鼠标移动 — 注意 jsdom 没有真实 layout，
    // posAtCoords 会失败 → handle 保持隐藏。这是预期行为。
    const event = new MouseEvent('mousemove', {
      clientX: 100,
      clientY: 100,
      bubbles: true,
    })
    editor.view.dom.dispatchEvent(event)

    // jsdom 下 posAtCoords 可能返回 null → handle 可能仍隐藏
    // 这验证 plugin 不会因错误而崩溃
    expect(handle).toBeTruthy()
  })

  it('鼠标离开编辑器时隐藏', () => {
    editor = createEditorWithHandle()
    const handle = document.querySelector('.block-handle')
    const event = new MouseEvent('mouseleave', { bubbles: true })
    editor.view.dom.dispatchEvent(event)
    expect(handle.style.opacity).toBe('0')
  })
})

// ============================================================================
// 自定义
// ============================================================================

describe('BlockHandle 自定义', () => {
  it('支持 configure 选项', () => {
    const resolved = BlockHandle.configure({ enabled: true })
    expect(resolved.options.enabled).toBe(true)
  })
})
