import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  ImageUpload,
  defaultUpload,
  toBase64,
  processImage,
} from '../../../src/editor/extensions/ImageUpload.js'
import { createEditor, cleanup } from '../../helper.js'

let editor

beforeEach(() => { document.body.innerHTML = '' })
afterEach(() => { cleanup(editor) })

// ============================================================================
// Extension definition
// ============================================================================

describe('ImageUpload 扩展定义', () => {
  it('名称为 imageUpload', () => {
    expect(ImageUpload.resolve().name).toBe('imageUpload')
  })

  it('类型为 extension', () => {
    expect(ImageUpload.resolve().type).toBe('extension')
  })

  it('提供 ProseMirror 插件', () => {
    editor = createEditor()
    const ext = editor.extensions.find(e => e.name === 'imageUpload')
    if (ext) {
      const plugins = ext._addProseMirrorPlugins.call(ext)
      expect(plugins).toHaveLength(1)
    }
  })
})

// ============================================================================
// Configuration
// ============================================================================

describe('ImageUpload 配置', () => {
  it('支持自定义 allowedMimeTypes', () => {
    const ext = ImageUpload.configure({ allowedMimeTypes: ['image/png'] })
    expect(ext.options.allowedMimeTypes).toEqual(['image/png'])
  })

  it('支持自定义 uploader', () => {
    const uploader = async () => ({ src: 'url' })
    const ext = ImageUpload.configure({ uploader })
    expect(ext.options.uploader).toBe(uploader)
  })

  it('支持 uploadUrl 配置', () => {
    const ext = ImageUpload.configure({ uploadUrl: '/api/upload' })
    expect(ext.options.uploadUrl).toBe('/api/upload')
  })

  it('支持 uploadHeaders 配置', () => {
    const ext = ImageUpload.configure({ uploadHeaders: { 'X-Key': 'abc' } })
    expect(ext.options.uploadHeaders).toEqual({ 'X-Key': 'abc' })
  })

  it('支持 useBase64 配置', () => {
    const ext = ImageUpload.configure({ useBase64: true })
    expect(ext.options.useBase64).toBe(true)
  })

  it('支持 onBeforeUpload 钩子', () => {
    const hook = async (file) => file
    const ext = ImageUpload.configure({ onBeforeUpload: hook })
    expect(ext.options.onBeforeUpload).toBe(hook)
  })

  it('支持回调函数', () => {
    const onSuccess = vi.fn()
    const onError = vi.fn()
    const ext = ImageUpload.configure({ onSuccess, onError })
    expect(ext.options.onSuccess).toBe(onSuccess)
    expect(ext.options.onError).toBe(onError)
  })
})

// ============================================================================
// Base64
// ============================================================================

describe('toBase64 转换', () => {
  it('将文件转为 base64 data URL', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' })
    const result = await toBase64(blob)
    expect(result).toMatch(/^data:text\/plain;base64,/)
  })
})

// ============================================================================
// processImage pipeline
// ============================================================================

describe('processImage 上传管线', () => {
  it('使用 uploader 回调', async () => {
    const file = new File(['dummy'], 'test.png', { type: 'image/png' })
    const uploader = vi.fn().mockResolvedValue({ src: 'https://cdn.example.com/test.png' })

    const result = await processImage(file, { uploader })

    expect(uploader).toHaveBeenCalled()
    expect(result.src).toBe('https://cdn.example.com/test.png')
  })

  it('使用 useBase64 模式', async () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' })

    const result = await processImage(file, { useBase64: true })

    expect(result.src).toMatch(/^data:/)
  })

  it('无上传配置时回退到 object URL', async () => {
    const file = new File(['dummy'], 'test.png', { type: 'image/png' })

    const result = await processImage(file, {})

    expect(result.src).toMatch(/^blob:/)
  })

  it('uploader 抛出错误时向上传播', async () => {
    const file = new File(['dummy'], 'test.png', { type: 'image/png' })
    const uploader = vi.fn().mockRejectedValue(new Error('Network error'))

    await expect(processImage(file, { uploader })).rejects.toThrow('Network error')
  })
})

// ============================================================================
// onBeforeUpload 钩子
// ============================================================================

describe('onBeforeUpload 钩子', () => {
  it('返回 File 时替换上传文件', async () => {
    const originalFile = new File(['original'], 'original.png', { type: 'image/png' })
    const compressedFile = new File(['compressed'], 'compressed.png', { type: 'image/png' })
    const uploader = vi.fn().mockResolvedValue({ src: 'https://cdn.com/img.png' })

    await processImage(originalFile, {
      onBeforeUpload: async () => compressedFile,
      uploader,
    })

    expect(uploader).toHaveBeenCalledWith(compressedFile)
  })

  it('返回 Blob 时替换上传文件', async () => {
    const originalFile = new File(['original'], 'test.png', { type: 'image/png' })
    const blob = new Blob(['blob'], { type: 'image/png' })
    const uploader = vi.fn().mockResolvedValue({ src: 'https://cdn.com/img.png' })

    await processImage(originalFile, {
      onBeforeUpload: async () => blob,
      uploader,
    })

    expect(uploader).toHaveBeenCalledWith(blob)
  })

  it('返回 undefined 时使用原始文件', async () => {
    const originalFile = new File(['original'], 'test.png', { type: 'image/png' })
    const uploader = vi.fn().mockResolvedValue({ src: 'https://cdn.com/img.png' })

    await processImage(originalFile, {
      onBeforeUpload: async () => {},
      uploader,
    })

    expect(uploader).toHaveBeenCalledWith(originalFile)
  })

  it('返回非 File/Blob 值时使用原始文件', async () => {
    const originalFile = new File(['original'], 'test.png', { type: 'image/png' })
    const uploader = vi.fn().mockResolvedValue({ src: 'https://cdn.com/img.png' })

    await processImage(originalFile, {
      onBeforeUpload: async () => 'not a file',
      uploader,
    })

    expect(uploader).toHaveBeenCalledWith(originalFile)
  })

  it('同步返回 File 也生效', async () => {
    const originalFile = new File(['original'], 'test.png', { type: 'image/png' })
    const replacement = new File(['new'], 'new.png', { type: 'image/png' })
    const uploader = vi.fn().mockResolvedValue({ src: 'https://cdn.com/img.png' })

    await processImage(originalFile, {
      onBeforeUpload: () => replacement,
      uploader,
    })

    expect(uploader).toHaveBeenCalledWith(replacement)
  })

  it('未配置时直接使用原始文件', async () => {
    const originalFile = new File(['original'], 'test.png', { type: 'image/png' })
    const uploader = vi.fn().mockResolvedValue({ src: 'https://cdn.com/img.png' })

    await processImage(originalFile, { uploader })

    expect(uploader).toHaveBeenCalledWith(originalFile)
  })

  it('钩子抛出错误时向上传播', async () => {
    const file = new File(['data'], 'test.png', { type: 'image/png' })

    await expect(processImage(file, {
      onBeforeUpload: async () => { throw new Error('Hook failed') },
      uploader: vi.fn(),
    })).rejects.toThrow('Hook failed')
  })

  it('钩子可用于压缩场景（模拟）', async () => {
    const file = new File(['large'], 'photo.png', { type: 'image/png' })
    const compressed = new File(['small'], 'photo-compressed.png', { type: 'image/png' })
    const uploader = vi.fn().mockResolvedValue({ src: 'https://cdn.com/photo.png' })

    await processImage(file, {
      onBeforeUpload: async (f) => {
        // User can call any compression library here
        return compressed
      },
      uploader,
    })

    expect(uploader).toHaveBeenCalledWith(compressed)
  })

  it('钩子可用于水印场景（模拟）', async () => {
    const file = new File(['data'], 'photo.png', { type: 'image/png' })
    const watermarked = new File(['wm'], 'photo-watermarked.png', { type: 'image/png' })
    const uploader = vi.fn().mockResolvedValue({ src: 'https://cdn.com/photo.png' })

    await processImage(file, {
      onBeforeUpload: async (f) => {
        // User can use Canvas or any library for watermarking
        return watermarked
      },
      uploader,
    })

    expect(uploader).toHaveBeenCalledWith(watermarked)
  })
})

// ============================================================================
// Plugin handlers
// ============================================================================

describe('ImageUpload 粘贴/拖拽处理', () => {
  it('handlePaste 无图片文件时返回 false', () => {
    editor = createEditor()
    const ext = editor.extensions.find(e => e.name === 'imageUpload')
    if (!ext) return

    const plugins = ext._addProseMirrorPlugins.call(ext)
    const plugin = plugins[0]
    const handlePaste = plugin.spec.props.handlePaste

    const mockEvent = {
      clipboardData: { files: [], types: ['text/plain'] },
    }
    expect(handlePaste(editor.view, mockEvent, null)).toBe(false)
  })

  it('handlePaste 不支持的文件类型时返回 false', () => {
    editor = createEditor()
    const ext = editor.extensions.find(e => e.name === 'imageUpload')
    if (!ext) return

    const plugins = ext._addProseMirrorPlugins.call(ext)
    const plugin = plugins[0]
    const handlePaste = plugin.spec.props.handlePaste

    const file = new File(['data'], 'test.txt', { type: 'text/plain' })
    const mockEvent = {
      clipboardData: { files: [file], types: ['text/plain'] },
    }
    expect(handlePaste(editor.view, mockEvent, null)).toBe(false)
  })

  it('handleDrop moved=true 时返回 false', () => {
    editor = createEditor()
    const ext = editor.extensions.find(e => e.name === 'imageUpload')
    if (!ext) return

    const plugins = ext._addProseMirrorPlugins.call(ext)
    const plugin = plugins[0]
    const handleDrop = plugin.spec.props.handleDrop

    expect(handleDrop(editor.view, {}, null, true)).toBe(false)
  })

  it('handleDrop 无文件时返回 false', () => {
    editor = createEditor()
    const ext = editor.extensions.find(e => e.name === 'imageUpload')
    if (!ext) return

    const plugins = ext._addProseMirrorPlugins.call(ext)
    const plugin = plugins[0]
    const handleDrop = plugin.spec.props.handleDrop

    const mockEvent = { dataTransfer: { files: [] } }
    expect(handleDrop(editor.view, mockEvent, null, false)).toBe(false)
  })
})

// ============================================================================
// defaultUpload
// ============================================================================

describe('defaultUpload HTTP 上传', () => {
  it('构建 FormData 并发送请求', async () => {
    const mockResponse = { url: 'https://cdn.example.com/uploaded.png' }
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    })

    const file = new File(['data'], 'test.png', { type: 'image/png' })
    const result = await defaultUpload(file, '/api/upload', {}, 'file')

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/upload', expect.objectContaining({
      method: 'POST',
    }))
    expect(result.src).toBe('https://cdn.example.com/uploaded.png')
  })

  it('上传失败时抛出错误', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    })

    const file = new File(['data'], 'test.png', { type: 'image/png' })
    await expect(defaultUpload(file, '/api/upload', {}, 'file')).rejects.toThrow('Upload failed: 500')
  })
})
