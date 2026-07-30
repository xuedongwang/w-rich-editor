import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Blockquote } from '../../../src/editor/extensions/Blockquote.js'
import { createEditor, setCursor, cleanup } from '../../helper.js'

let editor

beforeEach(() => { document.body.innerHTML = '' })
afterEach(() => { cleanup(editor) })

describe('Blockquote 节点定义', () => {
  it('名称正确', () => {
    expect(Blockquote.resolve().name).toBe('blockquote')
  })

  it('是块级节点', () => {
    expect(Blockquote.resolve().nodeSpec.group).toBe('block')
  })

  it('要求 paragraph+ 内容', () => {
    expect(Blockquote.resolve().nodeSpec.content).toBe('paragraph+')
  })

  it('具有 defining 属性', () => {
    expect(Blockquote.resolve().nodeSpec.defining).toBe(true)
  })

  it('渲染为 <blockquote> 元素', () => {
    expect(Blockquote.resolve().nodeSpec.toDOM()[0]).toBe('blockquote')
  })

  it('解析 <blockquote> 元素', () => {
    expect(Blockquote.resolve().nodeSpec.parseDOM[0].tag).toBe('blockquote')
  })
})

describe('Blockquote 命令', () => {
  it('toggleBlockquote 将段落包裹在 blockquote 中', () => {
    editor = createEditor({ content: '<p>Quoted</p>' })
    setCursor(editor, 1)
    editor.commands.toggleBlockquote()
    expect(editor.getHTML()).toContain('<blockquote>')
  })

  it('toggleBlockquote 解除 blockquote 包裹', () => {
    editor = createEditor({ content: '<blockquote><p>Quoted</p></blockquote>' })
    setCursor(editor, 2)
    editor.commands.toggleBlockquote()
    expect(editor.getHTML()).not.toContain('<blockquote>')
    expect(editor.getHTML()).toContain('<p>')
  })

  it('toggleBlockquote 反复切换', () => {
    editor = createEditor({ content: '<p>Text</p>' })
    setCursor(editor, 1)
    editor.commands.toggleBlockquote()
    expect(editor.getHTML()).toContain('<blockquote>')
    editor.commands.toggleBlockquote()
    expect(editor.getHTML()).not.toContain('<blockquote>')
  })
})

describe('Blockquote 快捷键', () => {
  it('Mod-Shift-b 包裹为 blockquote', () => {
    editor = createEditor({ content: '<p>Text</p>' })
    setCursor(editor, 1)
    const ext = editor.extensions.find(e => e.name === 'blockquote')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts['Mod-Shift-b'](editor.state, editor.view.dispatch)
    expect(editor.getHTML()).toContain('<blockquote>')
  })

  it('Mod-Shift-b 解除 blockquote 包裹', () => {
    editor = createEditor({ content: '<blockquote><p>Text</p></blockquote>' })
    setCursor(editor, 2)
    const ext = editor.extensions.find(e => e.name === 'blockquote')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts['Mod-Shift-b'](editor.state, editor.view.dispatch)
    expect(editor.getHTML()).not.toContain('<blockquote>')
  })
})

describe('Blockquote 内容限制', () => {
  it('在引用块内切换标题会将内容提升出引用块', () => {
    editor = createEditor({ content: '<blockquote><p>Quoted text</p></blockquote>' })
    setCursor(editor, 2)
    editor.commands.toggleHeading({ level: 1 })
    expect(editor.getHTML()).toContain('<h1>')
    expect(editor.getHTML()).not.toContain('<blockquote>')
  })

  it('在引用块内切换代码块会将内容提升出引用块', () => {
    editor = createEditor({ content: '<blockquote><p>Quoted text</p></blockquote>' })
    setCursor(editor, 2)
    editor.commands.toggleCodeBlock({ language: '' })
    expect(editor.getHTML()).toContain('<pre')
    expect(editor.getHTML()).not.toContain('<blockquote>')
  })

  it('在引用块内插入分隔线失败', () => {
    editor = createEditor({ content: '<blockquote><p>Quoted text</p></blockquote>' })
    setCursor(editor, 2)
    const result = editor.commands.insertDivider()
    expect(result).toBe(false)
    expect(editor.getHTML()).toContain('<blockquote>')
  })

  it('在引用块内无法用快捷键插入分隔线', () => {
    editor = createEditor({ content: '<blockquote><p>Quoted text</p></blockquote>' })
    setCursor(editor, 2)
    const ext = editor.extensions.find(e => e.name === 'horizontal_rule')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    const result = shortcuts['Mod-_'](editor.state, editor.view.dispatch)
    expect(result).toBe(false)
    expect(editor.getHTML()).toContain('<blockquote>')
  })

  it('在引用块内列表包裹失败', () => {
    editor = createEditor({ content: '<blockquote><p>Quoted text</p></blockquote>' })
    setCursor(editor, 2)
    const result = editor.commands.toggleBulletList()
    expect(result).toBe(false)
    expect(editor.getHTML()).toContain('<blockquote>')
  })

  it('schema 要求 paragraph+ 内容', () => {
    editor = createEditor()
    const bqType = editor.schema.nodes.blockquote
    expect(bqType.spec.content).toBe('paragraph+')
  })
})

describe('Blockquote 内 Markdown 输入规则不识别', () => {
  // Helper: find the input rule whose regexp matches `pattern` and call its handler.
  function fireInputRule(extName, pattern) {
    const ext = editor.extensions.find(e => e.name === extName)
    const rules = ext._addInputRules.call(ext)
    for (const rule of rules) {
      const match = pattern.match(rule.match)
      if (match) {
        const { $from } = editor.state.selection
        const start = $from.start()
        return rule.handler(editor.state, match, start, start + pattern.length)
      }
    }
    return undefined
  }

  it('在引用块内输入 # + 空格不创建标题', () => {
    editor = createEditor({ content: '<blockquote><p># </p></blockquote>' })
    setCursor(editor, 4) // after "# "
    const result = fireInputRule('heading', '# ')
    expect(result).toBeNull()
    expect(editor.getHTML()).not.toContain('<h1>')
    expect(editor.getHTML()).toContain('<blockquote>')
  })

  it('在引用块内输入 ``` 不创建代码块', () => {
    editor = createEditor({ content: '<blockquote><p>```</p></blockquote>' })
    setCursor(editor, 4)
    const result = fireInputRule('code_block', '```')
    expect(result).toBeNull()
    expect(editor.getHTML()).not.toContain('<pre')
    expect(editor.getHTML()).toContain('<blockquote>')
  })
})

describe('Blockquote 输入规则', () => {
  it('提供 1 条输入规则', () => {
    editor = createEditor()
    const ext = editor.extensions.find(e => e.name === 'blockquote')
    expect(ext._addInputRules.call(ext)).toHaveLength(1)
  })

  it('> + 空格 模式匹配', () => {
    expect(/^>\s$/.test('> ')).toBe(true)
    expect(/^>\s$/.test('>')).toBe(false)
    expect(/^>\s$/.test('>> ')).toBe(false)
  })
})
