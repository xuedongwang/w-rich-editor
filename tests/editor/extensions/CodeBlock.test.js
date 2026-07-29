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

  it('Enter 无 dispatch 时返回 false（不吞掉事件）', () => {
    editor = createEditor({ content: '<pre><code>test</code></pre>' })
    setCursor(editor, 2)
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    // dispatch is undefined → should return false
    expect(shortcuts.Enter(editor.state)).toBe(false)
    // Code should be unchanged
    expect(editor.getText()).toBe('test')
  })

  it('Enter 在有选区时返回 false（不丢失选中代码）', () => {
    editor = createEditor({ content: '<pre><code>hello world</code></pre>' })
    selectRange(editor, 2, 8) // select "llo wo"
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    expect(shortcuts.Enter(editor.state, editor.view.dispatch)).toBe(false)
    // Selection should be handled by default, not our handler
  })

  it('Enter 保留光标后的代码', () => {
    editor = createEditor({ content: '<pre><code>beforeAfter</code></pre>' })
    setCursor(editor, 7) // between "before" and "After"
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts.Enter(editor.state, editor.view.dispatch)
    const text = editor.getText()
    expect(text).toContain('before')
    expect(text).toContain('After')
  })

  it('Enter 在行首保持无缩进', () => {
    editor = createEditor({ content: '<pre><code>no indent</code></pre>' })
    setCursor(editor, 1) // at the beginning
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts.Enter(editor.state, editor.view.dispatch)
    expect(editor.getText()).toBe('\nno indent')
  })

  it('Enter 在第二行保持该行的缩进', () => {
    editor = createEditor({ content: '<pre><code>line1\n    line2</code></pre>' })
    // doc(0) code_block(1) text starts at 2, ends at 16
    // After "line2" = position 16
    setCursor(editor, 16)
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts.Enter(editor.state, editor.view.dispatch)
    expect(editor.getText()).toBe('line1\n    line2\n    ')
  })

  it('连续 Enter 每次都保持缩进', () => {
    editor = createEditor({ content: '<pre><code>  indented</code></pre>' })
    setCursor(editor, 11)
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)

    // First Enter
    shortcuts.Enter(editor.state, editor.view.dispatch)
    setCursor(editor, editor.state.doc.content.size - 1)

    // Second Enter — should still have "  " indent
    shortcuts.Enter(editor.state, editor.view.dispatch)
    const text = editor.getText()
    const lines = text.split('\n')
    // Third line should start with "  " (indent from second line)
    expect(lines[2]).toMatch(/^  /)
  })

  it('Enter 后代码块内容完整不丢失', () => {
    editor = createEditor({ content: '<pre><code>aaa\n  bbb\nccc</code></pre>' })
    // "aaa\n  bbb\nccc" = 13 chars, text starts at 2
    // After "  bbb" = 2 + 9 = 11
    setCursor(editor, 11)
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts.Enter(editor.state, editor.view.dispatch)
    const text = editor.getText()
    // All original content should be preserved
    expect(text).toContain('aaa')
    expect(text).toContain('bbb')
    expect(text).toContain('ccc')
  })

  it('Enter 后光标仍在代码块内（不跳到外部）', () => {
    editor = createEditor({ content: '<pre><code>line1</code></pre>' })
    setCursor(editor, 6) // end of "line1" inside code_block
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts.Enter(editor.state, editor.view.dispatch)

    // Cursor must remain inside the code_block
    const sel = editor.state.selection
    expect(sel.$from.parent.type.name).toBe('code_block')

    // DOM content should reflect the inserted newline
    const code = editor.view.dom.querySelector('pre.code-block code')
    expect(code.textContent).toContain('\n')
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

  it('输入 ``` 不抛出 RangeError（start 在 match 起点）', () => {
    // 模拟 readDOMChange 路径：state 尚未包含刚输入的字符
    // state = "<p>``</p>"，用户刚键入第三个 `
    // inputrules.run 计算出 start = 1（旧状态中 match 起点），
    // match[0] = "```"（长度 3）。handler 应替换整个段落为代码块。
    editor = createEditor({ content: '<p>``</p>' })
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const rules = ext._addInputRules.call(ext)
    const handler = rules[0].handler

    const match = ['```']
    // 不应抛出 "Position -2 out of range"
    const tr = handler(editor.state, match, 1, 3)
    expect(tr).toBeTruthy()
    // 事务应将段落替换为代码块
    expect(tr.doc.firstChild.type.name).toBe('code_block')
    // 光标应位于代码块内部
    expect(tr.selection.$from.parent.type.name).toBe('code_block')
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

  it('未知语言无语法高亮装饰', () => {
    editor = createEditor({ content: '<pre><code class="language-unknown-lang">text</code></pre>' })
    const ext = editor.extensions.find(e => e.name === 'code_block')
    const plugins = ext._addProseMirrorPlugins.call(ext)
    const plugin = plugins[0]
    const decorations = plugin.spec.state.init(null, editor.state)
    expect(decorations.find().length).toBe(0)
  })

  it('空代码块无语法高亮装饰', () => {
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

// ============================================================================
// NodeView — Line Numbers Gutter
// ============================================================================

describe('CodeBlock 行号 gutter', () => {
  it('单行代码块渲染 1 个行号', () => {
    editor = createEditor({ content: '<pre><code>hello</code></pre>' })
    const gutter = editor.view.dom.querySelector('.line-numbers-rows')
    expect(gutter).not.toBeNull()
    expect(gutter.children.length).toBe(1)
  })

  it('多行代码块渲染对应数量的行号', () => {
    editor = createEditor({ content: '<pre><code>line1\nline2\nline3</code></pre>' })
    const gutter = editor.view.dom.querySelector('.line-numbers-rows')
    expect(gutter.children.length).toBe(3)
  })

  it('空代码块仍有 1 个行号', () => {
    editor = createEditor({ content: '<pre><code></code></pre>' })
    const gutter = editor.view.dom.querySelector('.line-numbers-rows')
    expect(gutter.children.length).toBe(1)
  })

  it('gutter 有 aria-hidden 属性', () => {
    editor = createEditor({ content: '<pre><code>test</code></pre>' })
    const gutter = editor.view.dom.querySelector('.line-numbers-rows')
    expect(gutter.getAttribute('aria-hidden')).toBe('true')
  })

  it('代码块有 line-numbers class', () => {
    editor = createEditor({ content: '<pre><code>test</code></pre>' })
    const pre = editor.view.dom.querySelector('pre.code-block')
    expect(pre?.classList.contains('line-numbers')).toBe(true)
  })

  it('编辑后行号数量同步更新', () => {
    editor = createEditor({ content: '<pre><code>line1</code></pre>' })
    let gutter = editor.view.dom.querySelector('.line-numbers-rows')
    expect(gutter.children.length).toBe(1)

    // Check NodeView reference
    const pre = editor.view.dom.querySelector('pre.code-block')
    expect(pre._codeBlockView).toBeDefined()

    // Add a newline via transaction — position 6 is end of code_block content
    // (pos 0 = before node, 1 = content start, 2-6 = "line1" chars, 6 = content end)
    const tr = editor.state.tr.insertText('\nline2', 6, 6)
    editor.view.dispatch(tr)

    // Check that the text was updated
    expect(editor.state.doc.textContent).toContain('line2')

    // Directly call sync on the NodeView (verify _syncLineNumbers works)
    const node = editor.state.doc.firstChild
    pre._codeBlockView._syncLineNumbers(node)

    gutter = editor.view.dom.querySelector('.line-numbers-rows')
    expect(gutter.children.length).toBe(2)
  })
})
