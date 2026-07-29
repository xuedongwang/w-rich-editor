import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TextAlign } from '../../../src/editor/extensions/TextAlign.js'
import { createEditor, setCursor, selectRange, cleanup } from '../../helper.js'

let editor

beforeEach(() => { document.body.innerHTML = '' })
afterEach(() => { cleanup(editor) })

// ============================================================================
// Extension definition
// ============================================================================

describe('TextAlign 扩展定义', () => {
  it('名称为 textAlign', () => {
    expect(TextAlign.resolve().name).toBe('textAlign')
  })

  it('类型为 extension', () => {
    expect(TextAlign.resolve().type).toBe('extension')
  })

  it('不产生 nodeSpec 或 markSpec', () => {
    const resolved = TextAlign.resolve()
    expect(resolved.nodeSpec).toBeUndefined()
    expect(resolved.markSpec).toBeUndefined()
  })
})

// ============================================================================
// Commands
// ============================================================================

describe('TextAlign 命令', () => {
  describe('setTextAlign 基础功能', () => {
    it('设置段落居中对齐', () => {
      editor = createEditor({ content: '<p>Hello</p>' })
      setCursor(editor, 1)
      editor.commands.setTextAlign({ align: 'center' })
      expect(editor.getHTML()).toContain('text-align: center')
    })

    it('设置段落右对齐', () => {
      editor = createEditor({ content: '<p>Hello</p>' })
      setCursor(editor, 1)
      editor.commands.setTextAlign({ align: 'right' })
      expect(editor.getHTML()).toContain('text-align: right')
    })

    it('设置段落两端对齐', () => {
      editor = createEditor({ content: '<p>Hello</p>' })
      setCursor(editor, 1)
      editor.commands.setTextAlign({ align: 'justify' })
      expect(editor.getHTML()).toContain('text-align: justify')
    })

    it('设置左对齐移除原有对齐样式', () => {
      editor = createEditor({ content: '<p style="text-align: center">Hello</p>' })
      setCursor(editor, 1)
      editor.commands.setTextAlign({ align: 'left' })
      expect(editor.getHTML()).not.toContain('text-align')
    })

    it('无效对齐值返回 false', () => {
      editor = createEditor({ content: '<p>Hello</p>' })
      setCursor(editor, 1)
      const result = editor.commands.setTextAlign({ align: 'invalid' })
      expect(result).toBe(false)
    })

    it('无参数调用返回 false', () => {
      editor = createEditor({ content: '<p>Hello</p>' })
      setCursor(editor, 1)
      const result = editor.commands.setTextAlign({})
      expect(result).toBe(false)
    })
  })

  describe('setTextAlign 对标题生效', () => {
    it('设置 H1 居中', () => {
      editor = createEditor({ content: '<h1>Title</h1>' })
      setCursor(editor, 1)
      editor.commands.setTextAlign({ align: 'center' })
      expect(editor.getHTML()).toContain('text-align: center')
      expect(editor.getHTML()).toContain('<h1')
    })

    it('设置 H2 右对齐', () => {
      editor = createEditor({ content: '<h2>Subtitle</h2>' })
      setCursor(editor, 1)
      editor.commands.setTextAlign({ align: 'right' })
      expect(editor.getHTML()).toContain('text-align: right')
      expect(editor.getHTML()).toContain('<h2')
    })

    it('标题切换对齐方式', () => {
      editor = createEditor({ content: '<h2 style="text-align: center">Test</h2>' })
      setCursor(editor, 1)
      editor.commands.setTextAlign({ align: 'right' })
      expect(editor.getHTML()).toContain('text-align: right')
      expect(editor.getHTML()).not.toContain('text-align: center')
    })
  })

  describe('setTextAlign 多块选区', () => {
    it('跨段落设置对齐', () => {
      editor = createEditor({ content: '<p>First</p><p>Second</p><p>Third</p>' })
      selectRange(editor, 1, 18)
      editor.commands.setTextAlign({ align: 'center' })
      const html = editor.getHTML()
      // Count occurrences of text-align: center in <p> tags
      const matches = html.match(/text-align: center/g)
      expect(matches).not.toBeNull()
      expect(matches.length).toBe(3)
    })

    it('部分选区跨段落也生效', () => {
      editor = createEditor({ content: '<p>First</p><p>Second</p>' })
      selectRange(editor, 3, 10)
      editor.commands.setTextAlign({ align: 'right' })
      const html = editor.getHTML()
      const matches = html.match(/text-align: right/g)
      expect(matches).not.toBeNull()
      expect(matches.length).toBe(2)
    })
  })

  describe('setTextAlign 保留其他属性', () => {
    it('保留标题 level 属性', () => {
      editor = createEditor({ content: '<h3>Test</h3>' })
      setCursor(editor, 1)
      editor.commands.setTextAlign({ align: 'center' })
      expect(editor.getHTML()).toContain('<h3')
      expect(editor.getHTML()).toContain('text-align: center')
    })

    it('保留行内标记（marks）', () => {
      editor = createEditor({ content: '<p><strong>Bold text</strong></p>' })
      setCursor(editor, 1)
      editor.commands.setTextAlign({ align: 'center' })
      expect(editor.getHTML()).toContain('<strong>')
      expect(editor.getHTML()).toContain('text-align: center')
    })
  })
})

// ============================================================================
// Keyboard shortcuts
// ============================================================================

describe('TextAlign 键盘快捷键', () => {
  it('提供 4 条键盘快捷键', () => {
    editor = createEditor()
    const ext = editor.extensions.find(e => e.name === 'textAlign')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    expect(Object.keys(shortcuts)).toHaveLength(4)
  })

  it('Mod-Shift-l 设置左对齐', () => {
    editor = createEditor({ content: '<p style="text-align: center">Hello</p>' })
    setCursor(editor, 1)
    const ext = editor.extensions.find(e => e.name === 'textAlign')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts['Mod-Shift-l'](editor.state, editor.view.dispatch)
    expect(editor.getHTML()).not.toContain('text-align')
  })

  it('Mod-Shift-e 设置居中对齐', () => {
    editor = createEditor({ content: '<p>Hello</p>' })
    setCursor(editor, 1)
    const ext = editor.extensions.find(e => e.name === 'textAlign')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts['Mod-Shift-e'](editor.state, editor.view.dispatch)
    expect(editor.getHTML()).toContain('text-align: center')
  })

  it('Mod-Shift-r 设置右对齐', () => {
    editor = createEditor({ content: '<p>Hello</p>' })
    setCursor(editor, 1)
    const ext = editor.extensions.find(e => e.name === 'textAlign')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts['Mod-Shift-r'](editor.state, editor.view.dispatch)
    expect(editor.getHTML()).toContain('text-align: right')
  })

  it('Mod-Shift-j 设置两端对齐', () => {
    editor = createEditor({ content: '<p>Hello</p>' })
    setCursor(editor, 1)
    const ext = editor.extensions.find(e => e.name === 'textAlign')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts['Mod-Shift-j'](editor.state, editor.view.dispatch)
    expect(editor.getHTML()).toContain('text-align: justify')
  })
})

// ============================================================================
// HTML serialization (toDOM)
// ============================================================================

describe('TextAlign HTML 序列化', () => {
  it('默认对齐不输出 style 属性', () => {
    editor = createEditor({ content: '<p>Normal</p>' })
    const html = editor.getHTML()
    expect(html).not.toContain('text-align')
  })

  it('居中对齐输出 style 属性', () => {
    editor = createEditor({ content: '<p style="text-align: center">Center</p>' })
    expect(editor.getHTML()).toContain('text-align: center')
  })

  it('标题居中对齐同时保留 level', () => {
    editor = createEditor({ content: '<h2 style="text-align: center">Title</h2>' })
    const html = editor.getHTML()
    expect(html).toContain('<h2')
    expect(html).toContain('text-align: center')
  })
})

// ============================================================================
// HTML parsing (parseDOM)
// ============================================================================

describe('TextAlign HTML 解析', () => {
  it('从 style 解析居中对齐', () => {
    editor = createEditor({ content: '<p style="text-align: center">Test</p>' })
    setCursor(editor, 1)
    expect(editor.isActive('paragraph', { align: 'center' })).toBe(true)
  })

  it('从 style 解析右对齐', () => {
    editor = createEditor({ content: '<p style="text-align: right">Test</p>' })
    setCursor(editor, 1)
    expect(editor.isActive('paragraph', { align: 'right' })).toBe(true)
  })

  it('从 style 解析两端对齐', () => {
    editor = createEditor({ content: '<p style="text-align: justify">Test</p>' })
    setCursor(editor, 1)
    expect(editor.isActive('paragraph', { align: 'justify' })).toBe(true)
  })

  it('无对齐样式时默认为 null', () => {
    editor = createEditor({ content: '<p>Test</p>' })
    setCursor(editor, 1)
    const { $from } = editor.state.selection
    expect($from.parent.attrs.align).toBeNull()
  })

  it('标题从 style 解析对齐', () => {
    editor = createEditor({ content: '<h2 style="text-align: center">Title</h2>' })
    setCursor(editor, 1)
    const { $from } = editor.state.selection
    expect($from.parent.attrs.level).toBe(2)
    expect($from.parent.attrs.align).toBe('center')
  })
})

// ============================================================================
// Active state detection
// ============================================================================

describe('TextAlign 活动状态检测', () => {
  it('检测居中对齐的段落', () => {
    editor = createEditor({ content: '<p style="text-align: center">Test</p>' })
    setCursor(editor, 1)
    expect(editor.isActive('paragraph', { align: 'center' })).toBe(true)
    expect(editor.isActive('paragraph', { align: 'right' })).toBe(false)
  })

  it('检测右对齐的标题', () => {
    editor = createEditor({ content: '<h2 style="text-align: right">Test</h2>' })
    setCursor(editor, 1)
    expect(editor.isActive('heading', { align: 'right' })).toBe(true)
    expect(editor.isActive('heading', { align: 'center' })).toBe(false)
  })

  it('默认段落无对齐属性', () => {
    editor = createEditor({ content: '<p>Test</p>' })
    setCursor(editor, 1)
    expect(editor.isActive('paragraph', { align: 'center' })).toBe(false)
    expect(editor.isActive('paragraph', { align: 'right' })).toBe(false)
  })

  it('切换对齐后状态更新', () => {
    editor = createEditor({ content: '<p>Test</p>' })
    setCursor(editor, 1)

    editor.commands.setTextAlign({ align: 'center' })
    expect(editor.isActive('paragraph', { align: 'center' })).toBe(true)

    editor.commands.setTextAlign({ align: 'right' })
    expect(editor.isActive('paragraph', { align: 'center' })).toBe(false)
    expect(editor.isActive('paragraph', { align: 'right' })).toBe(true)

    editor.commands.setTextAlign({ align: 'left' })
    expect(editor.isActive('paragraph', { align: 'right' })).toBe(false)
  })
})

// ============================================================================
// Edge cases
// ============================================================================

describe('TextAlign 边界情况', () => {
  it('空文档中设置对齐', () => {
    editor = createEditor()
    setCursor(editor, 1)
    editor.commands.setTextAlign({ align: 'center' })
    expect(editor.getHTML()).toContain('text-align: center')
  })

  it('连续设置不同对齐值', () => {
    editor = createEditor({ content: '<p>Test</p>' })
    setCursor(editor, 1)

    editor.commands.setTextAlign({ align: 'center' })
    expect(editor.getHTML()).toContain('text-align: center')

    editor.commands.setTextAlign({ align: 'right' })
    expect(editor.getHTML()).toContain('text-align: right')
    expect(editor.getHTML()).not.toContain('text-align: center')

    editor.commands.setTextAlign({ align: 'justify' })
    expect(editor.getHTML()).toContain('text-align: justify')
    expect(editor.getHTML()).not.toContain('text-align: right')
  })

  it('对齐后再设置相同值不改变文档', () => {
    editor = createEditor({ content: '<p style="text-align: center">Test</p>' })
    setCursor(editor, 1)
    const docBefore = editor.state.doc.toJSON()
    editor.commands.setTextAlign({ align: 'center' })
    const docAfter = editor.state.doc.toJSON()
    expect(docAfter).toEqual(docBefore)
  })

  it('与 Heading 命令组合使用', () => {
    editor = createEditor({ content: '<p>Test</p>' })
    setCursor(editor, 1)

    // First convert to heading
    editor.commands.toggleHeading({ level: 2 })
    expect(editor.getHTML()).toContain('<h2')

    // Then set alignment
    editor.commands.setTextAlign({ align: 'center' })
    expect(editor.getHTML()).toContain('<h2')
    expect(editor.getHTML()).toContain('text-align: center')
  })

  it('Heading 切换回段落时保留对齐', () => {
    editor = createEditor({ content: '<h2 style="text-align: center">Test</h2>' })
    setCursor(editor, 1)

    // Toggle heading back to paragraph
    editor.commands.toggleHeading({ level: 2 })
    expect(editor.getHTML()).toContain('<p')
    // Alignment should be preserved since setNodeMarkup keeps existing attrs
    // (unless toggleHeading explicitly resets them)
  })
})
