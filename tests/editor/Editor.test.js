import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Editor } from '../../src/editor/Editor.js'
import { createEditor, setCursor, selectRange, cleanup, DEFAULT_EXTENSIONS } from '../helper.js'
import { Document, Paragraph, Bold, Italic, Code, Heading, History } from '../../src/editor/index.js'

let editor

beforeEach(() => { document.body.innerHTML = '' })
afterEach(() => { cleanup(editor) })

describe('编辑器构造', () => {
  it('创建编辑器实例', () => {
    editor = createEditor()
    expect(editor).toBeInstanceOf(Editor)
    expect(editor.view).toBeDefined()
    expect(editor.state).toBeDefined()
    expect(editor.schema).toBeDefined()
  })

  it('默认创建空文档', () => {
    editor = createEditor()
    expect(editor.isEmpty()).toBe(true)
  })

  it('使用初始 HTML 内容创建', () => {
    editor = createEditor({ content: '<p>Hello</p>' })
    expect(editor.isEmpty()).toBe(false)
    expect(editor.getText()).toBe('Hello')
  })

  it('使用初始 JSON 内容创建', () => {
    editor = createEditor({
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'JSON' }] }] },
    })
    expect(editor.getText()).toBe('JSON')
  })

  it('从 .resolve() 解析扩展', () => {
    const target = document.createElement('div')
    editor = new Editor({
      target,
      extensions: DEFAULT_EXTENSIONS,
    })
    expect(editor.extensions.length).toBe(DEFAULT_EXTENSIONS.length)
  })
})

describe('编辑器生命周期', () => {
  it('触发 onCreate 回调', () => {
    let fired = false
    editor = createEditor({ onCreate: () => { fired = true } })
    expect(fired).toBe(true)
  })

  it('内容变更时触发 onUpdate', () => {
    let fired = false
    editor = createEditor({ onUpdate: () => { fired = true } })
    editor.view.dispatch(editor.state.tr.insertText('x'))
    expect(fired).toBe(true)
  })

  it('选区变更时触发 onSelectionUpdate', () => {
    let fired = false
    editor = createEditor({
      content: '<p>Hello</p>',
      onSelectionUpdate: () => { fired = true },
    })
    setCursor(editor, 3)
    expect(fired).toBe(true)
  })

  it('destroy 无错误清理', () => {
    editor = createEditor()
    expect(() => editor.destroy()).not.toThrow()
  })

  it('destroy 是幂等的', () => {
    editor = createEditor()
    editor.destroy()
    expect(() => editor.destroy()).not.toThrow()
  })
})

describe('编辑器内容 API', () => {
  it('getHTML 返回序列化 HTML', () => {
    editor = createEditor({ content: '<p>Hello <strong>world</strong></p>' })
    expect(editor.getHTML()).toContain('<strong>world</strong>')
  })

  it('getJSON 返回文档 JSON', () => {
    editor = createEditor({ content: '<p>Test</p>' })
    const json = editor.getJSON()
    expect(json.type).toBe('doc')
    expect(json.content[0].type).toBe('paragraph')
  })

  it('getText 返回纯文本', () => {
    editor = createEditor({ content: '<p>Hello <em>world</em></p>' })
    expect(editor.getText()).toBe('Hello world')
  })

  it('setContent 用 HTML 替换内容', () => {
    editor = createEditor({ content: '<p>Old</p>' })
    editor.setContent('<p>New</p>')
    expect(editor.getText()).toBe('New')
  })

  it('setContent 用 JSON 替换内容', () => {
    editor = createEditor({ content: '<p>Old</p>' })
    editor.setContent({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'From JSON' }] }],
    })
    expect(editor.getText()).toBe('From JSON')
  })

  it('isEmpty 对空文档返回 true', () => {
    editor = createEditor()
    expect(editor.isEmpty()).toBe(true)
  })

  it('isEmpty 对非空文档返回 false', () => {
    editor = createEditor({ content: '<p>text</p>' })
    expect(editor.isEmpty()).toBe(false)
  })
})

describe('编辑器可编辑状态', () => {
  it('默认可编辑', () => {
    editor = createEditor()
    expect(editor.isEditable()).toBe(true)
  })

  it('遵循 editable:false 选项', () => {
    editor = createEditor({ editable: false })
    expect(editor.isEditable()).toBe(false)
  })

  it('setEditable 切换状态', () => {
    editor = createEditor()
    editor.setEditable(false)
    expect(editor.isEditable()).toBe(false)
    editor.setEditable(true)
    expect(editor.isEditable()).toBe(true)
  })
})

describe('编辑器 isActive', () => {
  it('检测光标处的活动标记', () => {
    editor = createEditor({ content: '<p><strong>Bold</strong></p>' })
    setCursor(editor, 2)
    expect(editor.isActive('bold')).toBe(true)
    expect(editor.isActive('italic')).toBe(false)
  })

  it('检测选区内的活动标记', () => {
    editor = createEditor({ content: '<p><em>Italic</em> text</p>' })
    selectRange(editor, 1, 4)
    expect(editor.isActive('italic')).toBe(true)
  })

  it('检测活动节点', () => {
    editor = createEditor({ content: '<h1>Heading</h1>' })
    setCursor(editor, 2)
    expect(editor.isActive('heading')).toBe(true)
    expect(editor.isActive('heading', { level: 1 })).toBe(true)
    expect(editor.isActive('heading', { level: 2 })).toBe(false)
  })

  it('未知名称返回 false', () => {
    editor = createEditor()
    expect(editor.isActive('nonexistent')).toBe(false)
  })

  it('检测空光标处的存储标记', () => {
    editor = createEditor({ content: '<p>Text</p>' })
    // Toggle bold with no selection → stored mark
    editor.view.dispatch(editor.state.tr.addStoredMark(editor.schema.marks.bold.create()))
    expect(editor.isActive('bold')).toBe(true)
  })
})

describe('编辑器链式 API', () => {
  it('链式调用多个命令', () => {
    editor = createEditor({ content: '<p>Text</p>' })
    selectRange(editor, 1, 5)
    editor.chain().toggleBold().toggleItalic().run()
    const html = editor.getHTML()
    expect(html).toContain('<strong>')
    expect(html).toContain('<em>')
  })

  it('chain.focus() 聚焦编辑器', () => {
    editor = createEditor()
    editor.chain().focus().run()
    expect(document.activeElement).toBe(editor.view.dom)
  })
})

describe('编辑器命令 API', () => {
  it('以对象形式暴露命令', () => {
    editor = createEditor()
    expect(editor.commands.toggleBold).toBeTypeOf('function')
    expect(editor.commands.toggleItalic).toBeTypeOf('function')
    expect(editor.commands.undo).toBeTypeOf('function')
  })

  it('命令返回表示是否成功的布尔值', () => {
    editor = createEditor({ content: '<p>Text</p>' })
    selectRange(editor, 1, 5)
    expect(editor.commands.toggleBold()).toBe(true)
  })
})

describe('keymap 插件链', () => {
  it('不同扩展的 Enter 快捷键不会互相覆盖', () => {
    // 验证 collectPlugins 为每个扩展创建独立的 keymap 插件
    // (不再用 Object.assign 合并到单个对象)
    editor = createEditor({ content: '<p>Test</p>' })
    const plugins = editor.state.plugins

    // 统计 keymap 插件的数量
    // 每个定义了快捷键的扩展应该有自己的 keymap 插件，加上 baseKeymap
    const keymapPlugins = plugins.filter(p => {
      const props = p.props || p.spec?.props
      return props && props.handleKeyDown
    })
    // 至少有多个 keymap 插件（每个定义快捷键的扩展一个 + baseKeymap）
    expect(keymapPlugins.length).toBeGreaterThan(1)
  })

  it('CodeBlock 和 BulletList 的 Enter 处理器共存', () => {
    // 验证修复：Object.assign 合并 keymaps 导致 BulletList.Enter 被 CodeBlock.Enter 覆盖
    editor = createEditor()

    const codeBlockExt = editor.extensions.find(e => e.name === 'code_block')
    const listItemExt = editor.extensions.find(e => e.name === 'list_item')

    const cbShortcuts = codeBlockExt._addKeyboardShortcuts.call(codeBlockExt)
    const liShortcuts = listItemExt._addKeyboardShortcuts.call(listItemExt)

    // 两个扩展都应该有 Enter 处理器
    expect(cbShortcuts.Enter).toBeDefined()
    expect(liShortcuts.Enter).toBeDefined()
    // 它们是不同的函数
    expect(cbShortcuts.Enter).not.toBe(liShortcuts.Enter)
  })
})
