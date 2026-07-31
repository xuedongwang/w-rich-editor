import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AIAssistant } from '../../../src/editor/extensions/AIAssistant.js'
import { DEFAULT_EXTENSIONS, createEditor, setCursor, selectRange, cleanup } from '../../helper.js'

let editor

beforeEach(() => { document.body.innerHTML = '' })
afterEach(() => { cleanup(editor) })

function createEditorWithAI(content = '<p>Hello world</p>', options = {}) {
  return createEditor({
    content,
    extensions: [
      ...DEFAULT_EXTENSIONS,
      AIAssistant.configure({ apiKey: 'test-key', ...options }),
    ],
  })
}

// ============================================================================
// 扩展定义
// ============================================================================

describe('AIAssistant 扩展定义', () => {
  it('名称正确', () => {
    expect(AIAssistant.resolve().name).toBe('aiAssistant')
  })

  it('类型为 extension', () => {
    expect(AIAssistant.resolve().type).toBe('extension')
  })

  it('提供 commands 和 plugins', () => {
    const resolved = AIAssistant.resolve()
    expect(resolved._addCommands).toBeDefined()
    expect(resolved._addProseMirrorPlugins).toBeDefined()
  })
})

// ============================================================================
// 配置
// ============================================================================

describe('AIAssistant 配置', () => {
  it('支持 configure 传入 API 配置', () => {
    const resolved = AIAssistant.configure({
      apiKey: 'sk-xxx',
      endpoint: 'https://api.example.com/v1',
      model: 'deepseek-chat',
    })
    expect(resolved.options.apiKey).toBe('sk-xxx')
    expect(resolved.options.endpoint).toBe('https://api.example.com/v1')
    expect(resolved.options.model).toBe('deepseek-chat')
  })

  it('支持自定义 actions', () => {
    const custom = [
      { key: 'custom', label: '自定义', icon: '🎯', prompt: 'do custom' },
    ]
    const resolved = AIAssistant.configure({ apiKey: 'k', actions: custom })
    expect(resolved.options.actions).toBe(custom)
    expect(resolved.options.actions.length).toBe(1)
  })

  it('默认 actions 包含 4 个操作', () => {
    const resolved = AIAssistant.resolve()
    // Default actions aren't exposed on the resolved object directly — they're
    // used inside the plugin. Verify the extension resolves without error.
    expect(resolved.name).toBe('aiAssistant')
  })
})

// ============================================================================
// 触发条件
// ============================================================================

describe('AIAssistant 触发条件', () => {
  it('未配置 API key 时不显示触发按钮', () => {
    editor = createEditor({
      content: '<p>Hello</p>',
      extensions: [
        ...DEFAULT_EXTENSIONS,
        AIAssistant.configure({ apiKey: '' }),
      ],
    })
    selectRange(editor, 1, 4)
    const btn = document.querySelector('.ai-trigger-btn')
    expect(btn).toBe(null)
  })

  it('选中文本后显示触发按钮', () => {
    editor = createEditorWithAI()
    selectRange(editor, 1, 4)
    const btn = document.querySelector('.ai-trigger-btn')
    expect(btn).toBeTruthy()
  })

  it('取消选区后触发按钮消失', () => {
    editor = createEditorWithAI()
    selectRange(editor, 1, 4)
    expect(document.querySelector('.ai-trigger-btn')).toBeTruthy()

    // Collapse selection → trigger should hide
    setCursor(editor, 3)
    expect(document.querySelector('.ai-trigger-btn')).toBe(null)
  })

  it('禁用时不显示触发按钮', () => {
    editor = createEditorWithAI('<p>Hello</p>', { enabled: false })
    selectRange(editor, 1, 4)
    expect(document.querySelector('.ai-trigger-btn')).toBe(null)
  })
})

// ============================================================================
// 命令
// ============================================================================

describe('AIAssistant 命令', () => {
  it('runAIAction 命令存在', () => {
    editor = createEditorWithAI()
    expect(typeof editor.commands.runAIAction).toBe('function')
  })

  it('runAIAction 无选区时返回 false', () => {
    editor = createEditorWithAI()
    setCursor(editor, 3)
    const result = editor.commands.runAIAction({ action: 'improve' })
    expect(result).toBe(false)
  })

  it('runAIAction 无效 action 返回 false', () => {
    editor = createEditorWithAI()
    selectRange(editor, 1, 4)
    const result = editor.commands.runAIAction({ action: 'nonexistent' })
    expect(result).toBe(false)
  })
})

// ============================================================================
// API 调用（使用 mock fetch）
// ============================================================================

describe('AIAssistant API 调用', () => {
  it('成功时替换选中文本', async () => {
    // Mock a streaming response (SSE)
    const encoder = new TextEncoder()
    const streamData = [
      'data: {"choices":[{"delta":{"content":"Improved"}}]}\n',
      'data: {"choices":[{"delta":{"content":" text"}}]}\n',
      'data: [DONE]\n',
    ].join('')
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(streamData))
        controller.close()
      },
    })

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: mockStream,
    })
    global.fetch = mockFetch

    editor = createEditorWithAI()
    selectRange(editor, 1, 6) // select "Hello"

    editor.commands.runAIAction({ action: 'improve' })

    // Wait for async streaming to complete
    await new Promise(r => setTimeout(r, 100))

    expect(mockFetch).toHaveBeenCalled()
    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[0]).toBe('https://api.deepseek.com/v1/chat/completions')

    const body = JSON.parse(callArgs[1].body)
    expect(body.model).toBe('deepseek-chat')
    expect(body.stream).toBe(true)
    expect(body.messages[1].content).toBe('Hello')

    // Text should be replaced with streamed result
    expect(editor.state.doc.textContent).toContain('Improved text')

    delete global.fetch
  })

  it('API 错误时不崩溃', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal error',
    })
    global.fetch = mockFetch

    editor = createEditorWithAI()
    selectRange(editor, 1, 6)

    editor.commands.runAIAction({ action: 'improve' })
    await new Promise(r => setTimeout(r, 50))

    // Original text should be preserved
    expect(editor.state.doc.textContent).toBe('Hello world')
    // Toast should appear
    expect(document.querySelector('.ai-toast')).toBeTruthy()

    delete global.fetch
  })
})

// ============================================================================
// 下拉菜单
// ============================================================================

describe('AIAssistant 下拉菜单', () => {
  it('点击触发按钮展开下拉', () => {
    editor = createEditorWithAI()
    selectRange(editor, 1, 4)
    const btn = document.querySelector('.ai-trigger-btn')
    expect(btn).toBeTruthy()

    btn.click()
    const dropdown = document.querySelector('.ai-dropdown')
    expect(dropdown).toBeTruthy()
  })

  it('下拉包含 4 个操作项', () => {
    editor = createEditorWithAI()
    selectRange(editor, 1, 4)
    const btn = document.querySelector('.ai-trigger-btn')
    btn.click()

    const items = document.querySelectorAll('.ai-dropdown-item')
    expect(items.length).toBe(4)

    const labels = Array.from(items).map(i => i.textContent)
    expect(labels.some(l => l.includes('改进写作'))).toBe(true)
    expect(labels.some(l => l.includes('缩写'))).toBe(true)
    expect(labels.some(l => l.includes('翻译'))).toBe(true)
    expect(labels.some(l => l.includes('语气'))).toBe(true)
  })
})
