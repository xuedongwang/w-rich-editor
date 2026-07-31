import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  createFloatingElement,
  onOutsideClick,
  onEscape,
  getCaretRect,
  getSelectionRect,
  getBlockRect,
} from '../../../src/editor/utils/floating.js'
import { createEditor, setCursor, selectRange, cleanup } from '../../helper.js'

let editor

beforeEach(() => { document.body.innerHTML = '' })
afterEach(() => { cleanup(editor) })

/**
 * Check if an object has DOMRect-like shape (top, left, right, bottom, width, height).
 * jsdom's getBoundingClientRect returns a plain object, not a DOMRect instance.
 */
function isRectLike(obj) {
  return obj && typeof obj.top === 'number' && typeof obj.left === 'number'
    && typeof obj.right === 'number' && typeof obj.bottom === 'number'
}

// ============================================================================
// createFloatingElement
// ============================================================================

describe('createFloatingElement', () => {
  it('创建浮动元素并追加到 document.body', () => {
    const content = document.createElement('div')
    content.textContent = 'Hello'
    const floating = createFloatingElement(content, {
      type: 'rect',
      rect: new DOMRect(100, 100, 200, 20),
    })
    expect(floating.el).toBeInstanceOf(HTMLElement)
    expect(floating.el.parentNode).toBe(document.body)
    expect(floating.el.textContent).toBe('Hello')
    floating.destroy()
    expect(floating.el.parentNode).toBe(null)
  })

  it('支持 rect 类型锚点', () => {
    const content = document.createElement('div')
    const floating = createFloatingElement(content, {
      type: 'rect',
      rect: new DOMRect(50, 50, 100, 20),
    })
    expect(floating.el.style.position).toBe('fixed')
    expect(floating.el.style.top).toMatch(/^\d+px$/)
    floating.destroy()
  })

  it('update 方法可更新位置', () => {
    const content = document.createElement('div')
    const floating = createFloatingElement(content, {
      type: 'rect',
      rect: new DOMRect(100, 100, 100, 20),
    })
    const topBefore = floating.el.style.top
    floating.update({
      type: 'rect',
      rect: new DOMRect(100, 400, 100, 20),
    })
    const topAfter = floating.el.style.top
    expect(topAfter).not.toBe(topBefore)
    floating.destroy()
  })

  it('支持自定义 z-index', () => {
    const content = document.createElement('div')
    const floating = createFloatingElement(content, {
      type: 'rect',
      rect: new DOMRect(0, 0, 0, 0),
    }, { zIndex: 999 })
    expect(floating.el.style.zIndex).toBe('999')
    floating.destroy()
  })

  it('destroy 幂等（多次调用不报错）', () => {
    const content = document.createElement('div')
    const floating = createFloatingElement(content, {
      type: 'rect',
      rect: new DOMRect(0, 0, 0, 0),
    })
    floating.destroy()
    floating.destroy() // should not throw
  })
})

// ============================================================================
// onOutsideClick
// ============================================================================

describe('onOutsideClick', () => {
  it('点击外部元素时触发回调', async () => {
    const inside = document.createElement('div')
    const outside = document.createElement('div')
    document.body.append(inside, outside)

    let called = false
    const cleanup = onOutsideClick(inside, () => { called = true })

    // Wait for the setTimeout(0) inside onOutsideClick
    await new Promise(r => setTimeout(r, 10))

    const event = new MouseEvent('mousedown', { bubbles: true })
    outside.dispatchEvent(event)
    expect(called).toBe(true)

    cleanup()
  })

  it('点击内部元素不触发回调', async () => {
    const inside = document.createElement('div')
    const child = document.createElement('span')
    inside.appendChild(child)
    document.body.appendChild(inside)

    let called = false
    const cleanup = onOutsideClick(inside, () => { called = true })

    await new Promise(r => setTimeout(r, 10))

    const event = new MouseEvent('mousedown', { bubbles: true })
    child.dispatchEvent(event)
    expect(called).toBe(false)

    cleanup()
  })

  it('返回 cleanup 函数', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const cleanup = onOutsideClick(el, () => {})
    expect(typeof cleanup).toBe('function')
    cleanup()
  })
})

// ============================================================================
// onEscape
// ============================================================================

describe('onEscape', () => {
  it('按下 Escape 触发回调', () => {
    let called = false
    const cleanup = onEscape(() => { called = true })

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    document.dispatchEvent(event)
    expect(called).toBe(true)

    cleanup()
  })

  it('按其他键不触发', () => {
    let called = false
    const cleanup = onEscape(() => { called = true })

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    document.dispatchEvent(event)
    expect(called).toBe(false)

    cleanup()
  })
})

// ============================================================================
// getCaretRect / getSelectionRect / getBlockRect
//
// NOTE: jsdom does not support real layout — view.coordsAtPos() throws
// "target.getClientRects is not a function". These helpers are tested for
// their null-guard logic only; viewport positioning is verified via the
// Playground manually.
// ============================================================================

describe('getCaretRect', () => {
  it('选区非空返回 null', () => {
    editor = createEditor({ content: '<p>Hello</p>' })
    selectRange(editor, 1, 4)
    expect(getCaretRect(editor.view)).toBe(null)
  })
})

describe('getSelectionRect', () => {
  it('空选区返回 null', () => {
    editor = createEditor({ content: '<p>Hello</p>' })
    setCursor(editor, 3)
    expect(getSelectionRect(editor.view)).toBe(null)
  })
})

describe('getBlockRect', () => {
  it('返回块节点引用', () => {
    editor = createEditor({ content: '<p>Hello</p>' })
    setCursor(editor, 3)
    const result = getBlockRect(editor.view, 3)
    expect(result).toBeTruthy()
    // jsdom returns plain object (not DOMRect instance) — check shape
    expect(isRectLike(result.rect)).toBe(true)
    expect(result.node).toBeInstanceOf(HTMLElement)
  })
})
