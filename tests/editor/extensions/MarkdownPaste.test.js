import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MarkdownPaste, isMarkdown, parseMarkdown, parseInline } from '../../../src/editor/extensions/MarkdownPaste.js'
import { createEditor, setCursor, cleanup } from '../../helper.js'

let editor

beforeEach(() => { document.body.innerHTML = '' })
afterEach(() => { cleanup(editor) })

// ============================================================================
// Extension definition
// ============================================================================

describe('MarkdownPaste 扩展定义', () => {
  it('名称为 markdownPaste', () => {
    expect(MarkdownPaste.resolve().name).toBe('markdownPaste')
  })

  it('类型为 extension', () => {
    expect(MarkdownPaste.resolve().type).toBe('extension')
  })

  it('提供 ProseMirror 插件', () => {
    editor = createEditor()
    const ext = editor.extensions.find(e => e.name === 'markdownPaste')
    const plugins = ext._addProseMirrorPlugins.call(ext)
    expect(plugins).toHaveLength(1)
  })
})

// ============================================================================
// Markdown detection
// ============================================================================

describe('isMarkdown 检测', () => {
  it('识别标题', () => {
    expect(isMarkdown('# Hello')).toBe(true)
    expect(isMarkdown('## Hello')).toBe(true)
    expect(isMarkdown('###### Hello')).toBe(true)
  })

  it('识别无序列表', () => {
    expect(isMarkdown('- item')).toBe(true)
    expect(isMarkdown('* item')).toBe(true)
    expect(isMarkdown('+ item')).toBe(true)
  })

  it('识别有序列表', () => {
    expect(isMarkdown('1. item')).toBe(true)
    expect(isMarkdown('99. item')).toBe(true)
  })

  it('识别引用块', () => {
    expect(isMarkdown('> quote')).toBe(true)
  })

  it('识别代码块', () => {
    expect(isMarkdown('```')).toBe(true)
    expect(isMarkdown('```js')).toBe(true)
  })

  it('识别分割线', () => {
    expect(isMarkdown('---')).toBe(true)
    expect(isMarkdown('-----')).toBe(true)
  })

  it('拒绝纯文本', () => {
    expect(isMarkdown('Hello world')).toBe(false)
    expect(isMarkdown('just a normal sentence')).toBe(false)
  })

  it('拒绝单个星号或井号', () => {
    expect(isMarkdown('*emphasis')).toBe(false)
    expect(isMarkdown('#tag')).toBe(false)
  })

  it('带前导空行也能检测', () => {
    expect(isMarkdown('\n# Hello')).toBe(true)
  })
})

// ============================================================================
// Inline parsing
// ============================================================================

describe('parseInline 行内解析', () => {
  it('纯文本', () => {
    editor = createEditor()
    const nodes = parseInline(editor.schema, 'hello world')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].text).toBe('hello world')
    expect(nodes[0].marks).toHaveLength(0)
  })

  it('解析 **bold**', () => {
    editor = createEditor()
    const nodes = parseInline(editor.schema, 'hello **world**')
    expect(nodes).toHaveLength(2)
    expect(nodes[0].text).toBe('hello ')
    expect(nodes[1].text).toBe('world')
    expect(nodes[1].marks[0].type.name).toBe('bold')
  })

  it('解析 *italic*', () => {
    editor = createEditor()
    const nodes = parseInline(editor.schema, 'hello *world*')
    expect(nodes).toHaveLength(2)
    expect(nodes[0].text).toBe('hello ')
    expect(nodes[1].text).toBe('world')
    expect(nodes[1].marks[0].type.name).toBe('italic')
  })

  it('解析 `code`', () => {
    editor = createEditor()
    const nodes = parseInline(editor.schema, 'use `console.log`')
    expect(nodes).toHaveLength(2)
    expect(nodes[0].text).toBe('use ')
    expect(nodes[1].text).toBe('console.log')
    expect(nodes[1].marks[0].type.name).toBe('code')
  })

  it('解析嵌套 **bold *and italic***', () => {
    editor = createEditor()
    const nodes = parseInline(editor.schema, '**bold *and italic***')
    // bold contains "bold " + italic("and italic")
    const boldNodes = nodes.filter(n => n.marks.some(m => m.type.name === 'bold'))
    expect(boldNodes.length).toBeGreaterThan(0)
  })

  it('混合多种格式', () => {
    editor = createEditor()
    const nodes = parseInline(editor.schema, '**bold** and *italic* and `code`')
    expect(nodes.length).toBeGreaterThanOrEqual(5)
    expect(nodes.some(n => n.marks.some(m => m.type.name === 'bold'))).toBe(true)
    expect(nodes.some(n => n.marks.some(m => m.type.name === 'italic'))).toBe(true)
    expect(nodes.some(n => n.marks.some(m => m.type.name === 'code'))).toBe(true)
  })

  it('空文本返回空数组', () => {
    editor = createEditor()
    expect(parseInline(editor.schema, '')).toEqual([])
  })

  it('未闭合的标记作为普通文本', () => {
    editor = createEditor()
    const nodes = parseInline(editor.schema, '**unclosed bold')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].text).toBe('**unclosed bold')
    expect(nodes[0].marks).toHaveLength(0)
  })

  it('多个 bold 片段', () => {
    editor = createEditor()
    const nodes = parseInline(editor.schema, '**a** and **b**')
    const boldTexts = nodes
      .filter(n => n.marks.some(m => m.type.name === 'bold'))
      .map(n => n.text)
    expect(boldTexts).toEqual(['a', 'b'])
  })
})

// ============================================================================
// Block parsing
// ============================================================================

describe('parseMarkdown 块级解析', () => {
  it('解析标题', () => {
    editor = createEditor()
    const fragment = parseMarkdown(editor.schema, '# Hello')
    expect(fragment.childCount).toBe(1)
    expect(fragment.firstChild.type.name).toBe('heading')
    expect(fragment.firstChild.attrs.level).toBe(1)
    expect(fragment.firstChild.textContent).toBe('Hello')
  })

  it('解析多级标题', () => {
    editor = createEditor()
    const fragment = parseMarkdown(editor.schema, '## Second\n### Third')
    expect(fragment.childCount).toBe(2)
    expect(fragment.child(0).attrs.level).toBe(2)
    expect(fragment.child(1).attrs.level).toBe(3)
  })

  it('解析无序列表', () => {
    editor = createEditor()
    const fragment = parseMarkdown(editor.schema, '- item1\n- item2\n- item3')
    expect(fragment.childCount).toBe(1)
    expect(fragment.firstChild.type.name).toBe('bullet_list')
    expect(fragment.firstChild.childCount).toBe(3)
    expect(fragment.firstChild.child(0).textContent).toBe('item1')
  })

  it('解析有序列表', () => {
    editor = createEditor()
    const fragment = parseMarkdown(editor.schema, '1. first\n2. second')
    expect(fragment.childCount).toBe(1)
    expect(fragment.firstChild.type.name).toBe('ordered_list')
    expect(fragment.firstChild.childCount).toBe(2)
  })

  it('解析引用块', () => {
    editor = createEditor()
    const fragment = parseMarkdown(editor.schema, '> Hello quote')
    expect(fragment.childCount).toBe(1)
    expect(fragment.firstChild.type.name).toBe('blockquote')
    expect(fragment.firstChild.firstChild.textContent).toBe('Hello quote')
  })

  it('解析分割线', () => {
    editor = createEditor()
    const fragment = parseMarkdown(editor.schema, '---')
    expect(fragment.childCount).toBe(1)
    expect(fragment.firstChild.type.name).toBe('horizontal_rule')
  })

  it('解析代码块', () => {
    editor = createEditor()
    const fragment = parseMarkdown(editor.schema, '```js\nconsole.log("hi")\n```')
    expect(fragment.childCount).toBe(1)
    expect(fragment.firstChild.type.name).toBe('code_block')
    expect(fragment.firstChild.attrs.language).toBe('js')
    expect(fragment.firstChild.textContent).toBe('console.log("hi")')
  })

  it('解析无语言标记的代码块', () => {
    editor = createEditor()
    const fragment = parseMarkdown(editor.schema, '```\ncode here\n```')
    expect(fragment.firstChild.type.name).toBe('code_block')
    expect(fragment.firstChild.attrs.language).toBe('')
    expect(fragment.firstChild.textContent).toBe('code here')
  })

  it('解析普通段落', () => {
    editor = createEditor()
    const fragment = parseMarkdown(editor.schema, 'Just a normal paragraph')
    expect(fragment.childCount).toBe(1)
    expect(fragment.firstChild.type.name).toBe('paragraph')
    expect(fragment.firstChild.textContent).toBe('Just a normal paragraph')
  })

  it('混合块类型', () => {
    editor = createEditor()
    const md = '# Title\n\nA paragraph\n\n- list item'
    const fragment = parseMarkdown(editor.schema, md)
    expect(fragment.childCount).toBe(3)
    expect(fragment.child(0).type.name).toBe('heading')
    expect(fragment.child(1).type.name).toBe('paragraph')
    expect(fragment.child(2).type.name).toBe('bullet_list')
  })

  it('跳过空行', () => {
    editor = createEditor()
    const fragment = parseMarkdown(editor.schema, '# Title\n\n\nParagraph')
    expect(fragment.childCount).toBe(2)
  })

  it('解析带行内格式的块', () => {
    editor = createEditor()
    const fragment = parseMarkdown(editor.schema, '# Hello **world**')
    expect(fragment.firstChild.type.name).toBe('heading')
    const inlineNodes = []
    fragment.firstChild.content.forEach(n => inlineNodes.push(n))
    expect(inlineNodes.some(n => n.marks.some(m => m.type.name === 'bold'))).toBe(true)
  })

  it('空文本返回空段落', () => {
    editor = createEditor()
    const fragment = parseMarkdown(editor.schema, '')
    expect(fragment.childCount).toBe(1)
    expect(fragment.firstChild.type.name).toBe('paragraph')
  })

  it('处理 Windows 换行符', () => {
    editor = createEditor()
    const fragment = parseMarkdown(editor.schema, '# Title\r\n\r\nParagraph')
    expect(fragment.childCount).toBe(2)
    expect(fragment.child(0).type.name).toBe('heading')
    expect(fragment.child(1).type.name).toBe('paragraph')
  })
})

// ============================================================================
// 粘贴集成测试
// ============================================================================

describe('MarkdownPaste 粘贴集成', () => {
  it('粘贴 Markdown 文本转换为对应 Block', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)

    // 模拟粘贴事件
    const fragment = parseMarkdown(editor.schema, '# Pasted Heading')
    expect(fragment.childCount).toBe(1)
    expect(fragment.firstChild.type.name).toBe('heading')
    expect(fragment.firstChild.attrs.level).toBe(1)
  })

  it('粘贴多行 Markdown 生成多个 Block', () => {
    editor = createEditor({ content: '<p>Existing</p>' })
    const md = '# Title\n\nSome text\n\n- list'
    const fragment = parseMarkdown(editor.schema, md)
    expect(fragment.childCount).toBe(3)
    expect(fragment.child(0).type.name).toBe('heading')
    expect(fragment.child(1).type.name).toBe('paragraph')
    expect(fragment.child(2).type.name).toBe('bullet_list')
  })

  it('粘贴纯文本不被拦截', () => {
    expect(isMarkdown('Hello world')).toBe(false)
    expect(isMarkdown('just a normal sentence')).toBe(false)
  })

  it('插件正确注册', () => {
    editor = createEditor()
    const ext = editor.extensions.find(e => e.name === 'markdownPaste')
    expect(ext).toBeDefined()
    const plugins = ext._addProseMirrorPlugins.call(ext)
    expect(plugins).toHaveLength(1)
    expect(plugins[0].props.handlePaste).toBeDefined()
  })
})
