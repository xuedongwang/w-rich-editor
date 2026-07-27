import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CodeBlock } from '../../../src/editor/extensions/CodeBlock.js'
import { createEditor, setCursor, selectRange, cleanup } from '../../helper.js'

let editor

beforeEach(() => { document.body.innerHTML = '' })
afterEach(() => { cleanup(editor) })

describe('CodeBlock 节点定义', () => {
  it('名称正确', () => {
    expect(CodeBlock.resolve().name).toBe('code_block')
  })

  it('是块级节点', () => {
    expect(CodeBlock.resolve().nodeSpec.group).toBe('block')
  })

  it('内容为 text*', () => {
    expect(CodeBlock.resolve().nodeSpec.content).toBe('text*')
  })

  it('不允许标记', () => {
    expect(CodeBlock.resolve().nodeSpec.marks).toBe('')
  })

  it('是 defining 且 code', () => {
    expect(CodeBlock.resolve().nodeSpec.defining).toBe(true)
    expect(CodeBlock.resolve().nodeSpec.code).toBe(true)
  })

  it('language 属性默认为空', () => {
    expect(CodeBlock.resolve().nodeSpec.attrs.language.default).toBe('')
  })

  it('渲染为带 language 类的 pre > code', () => {
    const dom = CodeBlock.resolve().nodeSpec.toDOM({ attrs: { language: 'javascript' } })
    expect(dom[0]).toBe('pre')
    expect(dom[1].class).toBe('code-block')
    expect(dom[1].spellcheck).toBe('false')
    expect(dom[2][0]).toBe('code')
    expect(dom[2][1].class).toBe('language-javascript')
  })

  it('无 language 时渲染为空 class 的 code', () => {
    const dom = CodeBlock.resolve().nodeSpec.toDOM({ attrs: { language: '' } })
    expect(dom[2][1].class).toBe('')
  })

  it('解析 <pre> 元素', () => {
    const rule = CodeBlock.resolve().nodeSpec.parseDOM[0]
    expect(rule.tag).toBe('pre')
    expect(rule.preserveWhitespace).toBe('full')
  })

  it('从 code 元素的 class 中提取 language', () => {
    const rule = CodeBlock.resolve().nodeSpec.parseDOM[0]
    const dom = document.createElement('pre')
    const code = document.createElement('code')
    code.className = 'language-python'
    dom.appendChild(code)
    const attrs = rule.getAttrs(dom)
    expect(attrs.language).toBe('python')
  })

  it('无 language class 时返回空 language', () => {
    const rule = CodeBlock.resolve().nodeSpec.parseDOM[0]
    const dom = document.createElement('pre')
    dom.appendChild(document.createElement('code'))
    expect(rule.getAttrs(dom).language).toBe('')
  })
})

describe('CodeBlock 命令', () => {
  it('toggleCodeBlock 将段落转换为代码块', () => {
    editor = createEditor({ content: '<p>Code</p>' })
    setCursor(editor, 1)
    editor.commands.toggleCodeBlock()
    expect(editor.getHTML()).toContain('<pre')
  })

  it('toggleCodeBlock 将代码块转换回段落', () => {
    editor = createEditor({ content: '<pre><code>Code</code></pre>' })
    setCursor(editor, 1)
    editor.commands.toggleCodeBlock()
    expect(editor.getHTML()).not.toContain('<pre')
    expect(editor.getHTML()).toContain('<p>')
  })

  it('toggleCodeBlock 接受 language 属性', () => {
    editor = createEditor({ content: '<p>Code</p>' })
    setCursor(editor, 1)
    editor.commands.toggleCodeBlock({ language: 'javascript' })
    expect(editor.getHTML()).toContain('language-javascript')
  })

  it('setCodeBlockLanguage 更新语言', () => {
    editor = createEditor({ content: '<pre><code>Code</code></pre>' })
    setCursor(editor, 1)
    editor.commands.setCodeBlockLanguage({ language: 'python' })
    expect(editor.getHTML()).toContain('language-python')
  })

  it('setCodeBlockLanguage 不在代码块中时返回 false', () => {
    editor = createEditor({ content: '<p>Not code</p>' })
    setCursor(editor, 1)
    expect(editor.commands.setCodeBlockLanguage({ language: 'python' })).toBe(false)
  })
})

describe('CodeBlock 键盘快捷键', () => {
  it('Mod-Alt-c 切换代码块', () => {
    editor = createEditor({ content: '<p>Text</p>' })
    setCursor(editor, 1)
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts['Mod-Alt-c'](editor.state, editor.view.dispatch)
    expect(editor.getHTML()).toContain('<pre')
  })

  it('Mod-a 选中代码块全部内容', () => {
    editor = createEditor({ content: '<pre><code>line1\nline2\nline3</code></pre>' })
    setCursor(editor, 3)
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts['Mod-a'](editor.state, editor.view.dispatch)
    // Selection should span entire code block content
    const { from, to } = editor.state.selection
    expect(to - from).toBe(17) // "line1\nline2\nline3" = 17 chars
  })

  it('Mod-a 在代码块末尾时透传', () => {
    editor = createEditor({ content: '<pre><code>abc</code></pre>' })
    // Select entire code block
    selectRange(editor, 1, 4)
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    const result = shortcuts['Mod-a'](editor.state, editor.view.dispatch)
    // Should return false to let default handler take over
    expect(result).toBe(false)
  })

  it('Mod-a 在代码块外时透传', () => {
    editor = createEditor({ content: '<p>Not code</p>' })
    setCursor(editor, 1)
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    expect(shortcuts['Mod-a'](editor.state, editor.view.dispatch)).toBe(false)
  })

  it('Tab 在光标处插入 2 个空格', () => {
    editor = createEditor({ content: '<pre><code>abc</code></pre>' })
    setCursor(editor, 2) // after 'a'
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts.Tab(editor.state, editor.view.dispatch)
    expect(editor.getText()).toBe('a  bc')
  })

  it('Tab 缩进多个选中行', () => {
    editor = createEditor({ content: '<pre><code>line1\nline2\nline3</code></pre>' })
    selectRange(editor, 1, 12) // selects "line1\nline2"
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts.Tab(editor.state, editor.view.dispatch)
    const text = editor.getText()
    expect(text).toContain('  line1')
    expect(text).toContain('  line2')
  })

  it('Tab 在代码块外时返回 false', () => {
    editor = createEditor({ content: '<p>Not code</p>' })
    setCursor(editor, 1)
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    expect(shortcuts.Tab(editor.state, editor.view.dispatch)).toBe(false)
  })

  it('Shift-Tab 移除前导空格', () => {
    editor = createEditor({ content: '<pre><code>  indented</code></pre>' })
    setCursor(editor, 3) // after the spaces
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts['Shift-Tab'](editor.state, editor.view.dispatch)
    expect(editor.getText()).toBe('indented')
  })

  it('Shift-Tab 移除 1-2 个空格', () => {
    editor = createEditor({ content: '<pre><code>   triple</code></pre>' })
    setCursor(editor, 4) // after 3 spaces
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts['Shift-Tab'](editor.state, editor.view.dispatch)
    expect(editor.getText()).toBe(' triple') // removed 2, left 1
  })

  it('Enter 保持缩进', () => {
    editor = createEditor({ content: '<pre><code>  indented</code></pre>' })
    // doc(0) code_block(1) "  indented"(2-11)
    setCursor(editor, 11) // inside text, at the end
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts.Enter(editor.state, editor.view.dispatch)
    expect(editor.getText()).toContain('\n  ')
  })

  it('无缩进时 Enter 仅添加换行', () => {
    editor = createEditor({ content: '<pre><code>no indent</code></pre>' })
    setCursor(editor, 10)
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts.Enter(editor.state, editor.view.dispatch)
    expect(editor.getText()).toBe('no indent\n')
  })

  it('Enter 在代码块外时返回 false', () => {
    editor = createEditor({ content: '<p>Not code</p>' })
    setCursor(editor, 1)
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    expect(shortcuts.Enter(editor.state, editor.view.dispatch)).toBe(false)
  })
})

describe('CodeBlock 输入规则', () => {
  it('提供 1 条输入规则', () => {
    editor = createEditor()
    const ext = editor.extensions.find(e => e.name === 'code_block')
    expect(ext._addInputRules.call(ext)).toHaveLength(1)
  })

  it('模式匹配 ```', () => {
    expect(/^```$/.test('```')).toBe(true)
    expect(/^```$/.test('``')).toBe(false)
    expect(/^```$/.test('````')).toBe(false)
  })
})

describe('CodeBlock 语法高亮', () => {
  it('提供高亮插件', () => {
    editor = createEditor()
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const plugins = ext._addProseMirrorPlugins.call(ext)
    expect(plugins.length).toBeGreaterThan(0)
  })

  it('为 JavaScript 生成 token 装饰', () => {
    editor = createEditor({ content: '<pre><code class="language-javascript">const x = 1</code></pre>' })
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const plugins = ext._addProseMirrorPlugins.call(ext)
    const plugin = plugins[0]
    const decorations = plugin.spec.state.init(null, editor.state)
    // Should have some decorations for tokens
    expect(decorations.find().length).toBeGreaterThan(0)
  })

  it('未知语言返回空装饰', () => {
    editor = createEditor({ content: '<pre><code class="language-unknown-lang">text</code></pre>' })
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const plugins = ext._addProseMirrorPlugins.call(ext)
    const plugin = plugins[0]
    const decorations = plugin.spec.state.init(null, editor.state)
    // Only line decorations, no token decorations (but we removed line decorations)
    expect(decorations.find().length).toBe(0)
  })

  it('空代码块返回空装饰', () => {
    editor = createEditor({ content: '<pre><code></code></pre>' })
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const plugins = ext._addProseMirrorPlugins.call(ext)
    const plugin = plugins[0]
    const decorations = plugin.spec.state.init(null, editor.state)
    expect(decorations.find().length).toBe(0)
  })

  it('文档变更时重建装饰', () => {
    editor = createEditor({ content: '<pre><code class="language-javascript">x</code></pre>' })
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const plugins = ext._addProseMirrorPlugins.call(ext)
    const plugin = plugins[0]
    const prev = plugin.spec.state.init(null, editor.state)
    const tr = editor.state.tr.insertText(' const y = 2', 2, 2)
    const newState = editor.state.apply(tr)
    const next = plugin.spec.state.apply(tr, prev, editor.state, newState)
    expect(next).not.toBe(prev)
  })
})
