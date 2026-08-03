import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TextSelection } from 'prosemirror-state'
import { AIInput } from '../../../src/editor/extensions/AIInput.js'
import { DEFAULT_EXTENSIONS, createEditor, setCursor, cleanup } from '../../helper.js'

let editor

beforeEach(() => {
  document.body.innerHTML = ''
  // Mock localStorage
  vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {})
})

afterEach(() => {
  cleanup(editor)
  vi.restoreAllMocks()
})

/**
 * Create an editor with AIInput added.
 */
function createEditorWithAIInput(options) {
  const ext = options !== undefined
    ? AIInput.configure(options)
    : AIInput.resolve()
  return createEditor({
    extensions: [...DEFAULT_EXTENSIONS, ext],
  })
}

/**
 * Simulate a keydown event on the editor view.
 */
function simulateKey(ed, key, opts = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  })
  return ed.view.dom.dispatchEvent(event)
}

/**
 * Type a space character via keydown event.
 */
function typeSpace(ed) {
  simulateKey(ed, ' ')
}

// ============================================================================
// 扩展定义
// ============================================================================

describe('AIInput 扩展定义', () => {
  it('名称正确', () => {
    expect(AIInput.resolve().name).toBe('aiInput')
  })

  it('类型为 extension', () => {
    expect(AIInput.resolve().type).toBe('extension')
  })
})

// ============================================================================
// 触发条件
// ============================================================================

describe('AIInput 触发条件', () => {
  it('在顶层空段落按空格打开输入框', () => {
    editor = createEditorWithAIInput({ apiKey: 'test-key' })
    editor.setContent('<p></p>')
    setCursor(editor, 1)
    typeSpace(editor)

    const box = document.querySelector('.ai-input-box')
    expect(box).toBeTruthy()
  })

  it('在顶层空段落按空格后文档包含空格', () => {
    editor = createEditorWithAIInput({ apiKey: 'test-key' })
    editor.setContent('<p></p>')
    setCursor(editor, 1)
    typeSpace(editor)

    expect(editor.state.doc.textContent).toBe(' ')
  })

  it('在非空段落按空格不打开输入框', () => {
    editor = createEditorWithAIInput({ apiKey: 'test-key' })
    editor.setContent('<p>hello</p>')
    setCursor(editor, 6)
    typeSpace(editor)

    const box = document.querySelector('.ai-input-box')
    expect(box).toBe(null)
  })

  it('在 blockquote 内的空段落按空格不打开输入框', () => {
    editor = createEditorWithAIInput({ apiKey: 'test-key' })
    editor.setContent('<blockquote><p></p></blockquote>')
    setCursor(editor, 2)
    typeSpace(editor)

    const box = document.querySelector('.ai-input-box')
    expect(box).toBe(null)
  })

  it('在列表项内按空格不打开输入框', () => {
    editor = createEditorWithAIInput({ apiKey: 'test-key' })
    editor.setContent('<ul><li><p></p></li></ul>')
    setCursor(editor, 3)
    typeSpace(editor)

    const box = document.querySelector('.ai-input-box')
    expect(box).toBe(null)
  })

  it('禁用后按空格不打开输入框', () => {
    editor = createEditorWithAIInput({ enabled: false })
    editor.setContent('<p></p>')
    setCursor(editor, 1)
    typeSpace(editor)

    const box = document.querySelector('.ai-input-box')
    expect(box).toBe(null)
  })
})

// ============================================================================
// 关闭
// ============================================================================

describe('AIInput 关闭', () => {
  it('按 Escape 关闭输入框并删除空格', () => {
    editor = createEditorWithAIInput({ apiKey: 'test-key' })
    editor.setContent('<p></p>')
    setCursor(editor, 1)
    typeSpace(editor)
    expect(document.querySelector('.ai-input-box')).toBeTruthy()

    simulateKey(editor, 'Escape')
    expect(document.querySelector('.ai-input-box')).toBe(null)
    // Space should be removed
    expect(editor.state.doc.textContent).toBe('')
  })

  it('命令 closeAIInput 关闭输入框', () => {
    editor = createEditorWithAIInput({ apiKey: 'test-key' })
    editor.setContent('<p></p>')
    setCursor(editor, 1)
    typeSpace(editor)
    expect(document.querySelector('.ai-input-box')).toBeTruthy()

    editor.commands.closeAIInput()
    expect(document.querySelector('.ai-input-box')).toBe(null)
  })
})

// ============================================================================
// AI 提交
// ============================================================================

describe('AIInput AI 提交', () => {
  it('提交空输入直接关闭（不调用 AI）', async () => {
    const fetchSpy = vi.fn()
    global.fetch = fetchSpy

    editor = createEditorWithAIInput({ apiKey: 'test-key' })
    editor.setContent('<p></p>')
    setCursor(editor, 1)
    typeSpace(editor)
    expect(document.querySelector('.ai-input-box')).toBeTruthy()

    // Simulate pressing Enter on empty input
    const input = document.querySelector('.ai-input-field')
    input.value = ''
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', bubbles: true, cancelable: true,
    }))

    // Wait a tick for any async operations
    await new Promise(r => setTimeout(r, 0))
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(document.querySelector('.ai-input-box')).toBe(null)
  })

  it('提交文本调用 AI 并插入结果', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'AI生成的内容' } }],
      }),
    })
    global.fetch = fetchSpy

    editor = createEditorWithAIInput({ apiKey: 'test-key' })
    editor.setContent('<p></p>')
    setCursor(editor, 1)
    typeSpace(editor)
    expect(document.querySelector('.ai-input-box')).toBeTruthy()

    // Simulate pressing Enter with text
    const input = document.querySelector('.ai-input-field')
    input.value = '测试输入'
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', bubbles: true, cancelable: true,
    }))

    // Wait for AI call to complete
    await new Promise(r => setTimeout(r, 50))

    expect(fetchSpy).toHaveBeenCalled()
    // Input box should close after success
    expect(document.querySelector('.ai-input-box')).toBe(null)
    // The space should be replaced with the AI result
    const text = editor.state.doc.textContent
    expect(text).toContain('AI生成的内容')
    // Trigger space should be removed
    expect(text).not.toBe(' ')
  })

  it('AI 调用失败显示错误', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Server Error',
    })
    global.fetch = fetchSpy

    editor = createEditorWithAIInput({ apiKey: 'test-key' })
    editor.setContent('<p></p>')
    setCursor(editor, 1)
    typeSpace(editor)

    const input = document.querySelector('.ai-input-field')
    input.value = '测试'
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', bubbles: true, cancelable: true,
    }))

    await new Promise(r => setTimeout(r, 50))

    // Box should still be open with error
    const box = document.querySelector('.ai-input-box')
    expect(box).toBeTruthy()
    expect(box.classList.contains('is-error')).toBe(true)
  })
})
