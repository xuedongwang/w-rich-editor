import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Extension, NodeExtension, MarkExtension } from '../../src/editor/Extension.js'
import { createEditor, cleanup } from '../helper.js'
import { Document, Paragraph } from '../../src/editor/index.js'

let editor

beforeEach(() => { document.body.innerHTML = '' })
afterEach(() => { cleanup(editor) })

describe('Extension.create', () => {
  it('创建通用扩展', () => {
    const MyExt = Extension.create({ name: 'myExt' })
    expect(MyExt.resolve).toBeTypeOf('function')
    expect(MyExt.configure).toBeTypeOf('function')
  })

  it('resolve() 返回解析后的扩展对象', () => {
    const MyExt = Extension.create({ name: 'test' })
    const resolved = MyExt.resolve()
    expect(resolved.type).toBe('extension')
    expect(resolved.name).toBe('test')
    expect(resolved.options).toEqual({})
  })

  it('configure() 传递选项', () => {
    const MyExt = Extension.create({ name: 'configured' })
    const resolved = MyExt.configure({ foo: 'bar' })
    expect(resolved.options).toEqual({ foo: 'bar' })
  })

  it('存储原始钩子函数', () => {
    const MyExt = Extension.create({
      name: 'hooks',
      addCommands() { return {} },
      addKeyboardShortcuts() { return {} },
      addInputRules() { return [] },
      addProseMirrorPlugins() { return [] },
    })
    const resolved = MyExt.resolve()
    expect(resolved._addCommands).toBeTypeOf('function')
    expect(resolved._addKeyboardShortcuts).toBeTypeOf('function')
    expect(resolved._addInputRules).toBeTypeOf('function')
    expect(resolved._addProseMirrorPlugins).toBeTypeOf('function')
  })

  it('存储生命周期钩子', () => {
    const MyExt = Extension.create({
      name: 'lifecycle',
      onCreate() {},
      onUpdate() {},
      onDestroy() {},
    })
    const resolved = MyExt.resolve()
    expect(resolved._onCreate).toBeTypeOf('function')
    expect(resolved._onUpdate).toBeTypeOf('function')
    expect(resolved._onDestroy).toBeTypeOf('function')
  })
})

describe('NodeExtension.create', () => {
  it('创建节点扩展', () => {
    const MyNode = NodeExtension.create({
      name: 'myNode',
      group: 'block',
      content: 'inline*',
    })
    const resolved = MyNode.resolve()
    expect(resolved.type).toBe('node')
    expect(resolved.name).toBe('myNode')
    expect(resolved.nodeSpec.group).toBe('block')
    expect(resolved.nodeSpec.content).toBe('inline*')
  })

  it('传递所有 nodeSpec 属性', () => {
    const MyNode = NodeExtension.create({
      name: 'full',
      group: 'block',
      content: 'text*',
      inline: false,
      atom: true,
      defining: true,
      isolating: true,
      code: true,
      marks: '',
      attrs: { level: { default: 1 } },
      toDOM: () => ['div', 0],
      parseDOM: [{ tag: 'div' }],
    })
    const resolved = MyNode.resolve()
    expect(resolved.nodeSpec.atom).toBe(true)
    expect(resolved.nodeSpec.defining).toBe(true)
    expect(resolved.nodeSpec.isolating).toBe(true)
    expect(resolved.nodeSpec.code).toBe(true)
    expect(resolved.nodeSpec.marks).toBe('')
    expect(resolved.nodeSpec.attrs).toEqual({ level: { default: 1 } })
    expect(resolved.nodeSpec.toDOM).toBeTypeOf('function')
    expect(resolved.nodeSpec.parseDOM).toHaveLength(1)
  })

  it('configure() 创建带选项的实例', () => {
    const MyNode = NodeExtension.create({
      name: 'custom',
      group: 'block',
      content: 'inline*',
    })
    const resolved = MyNode.configure({ custom: true })
    expect(resolved.options).toEqual({ custom: true })
    expect(resolved.type).toBe('node')
  })
})

describe('MarkExtension.create', () => {
  it('创建标记扩展', () => {
    const MyMark = MarkExtension.create({
      name: 'myMark',
      inclusive: false,
      excludes: '_',
    })
    const resolved = MyMark.resolve()
    expect(resolved.type).toBe('mark')
    expect(resolved.name).toBe('myMark')
    expect(resolved.markSpec.inclusive).toBe(false)
    expect(resolved.markSpec.excludes).toBe('_')
  })

  it('传递 attrs、toDOM、parseDOM', () => {
    const MyMark = MarkExtension.create({
      name: 'styled',
      attrs: { color: { default: 'red' } },
      toDOM: () => ['span', { style: 'color: red' }, 0],
      parseDOM: [{ style: 'color' }],
    })
    const resolved = MyMark.resolve()
    expect(resolved.markSpec.attrs).toEqual({ color: { default: 'red' } })
    expect(resolved.markSpec.toDOM).toBeTypeOf('function')
    expect(resolved.markSpec.parseDOM).toHaveLength(1)
  })
})

describe('扩展钩子上下文 (this.editor)', () => {
  it('addCommands 接收 this.editor', () => {
    let ref
    const MyExt = Extension.create({
      name: 'ctx',
      addCommands() { ref = this.editor; return {} },
    })
    editor = createEditor({ extensions: [Document.resolve(), Paragraph.resolve(), MyExt.resolve()] })
    expect(ref).toBe(editor)
  })

  it('addKeyboardShortcuts 接收 this.editor', () => {
    let ref
    const MyExt = Extension.create({
      name: 'ctx2',
      addKeyboardShortcuts() { ref = this.editor; return {} },
    })
    editor = createEditor({ extensions: [Document.resolve(), Paragraph.resolve(), MyExt.resolve()] })
    expect(ref).toBe(editor)
  })

  it('addInputRules 接收 this.editor', () => {
    let ref
    const MyExt = Extension.create({
      name: 'ctx3',
      addInputRules() { ref = this.editor; return [] },
    })
    editor = createEditor({ extensions: [Document.resolve(), Paragraph.resolve(), MyExt.resolve()] })
    expect(ref).toBe(editor)
  })

  it('addProseMirrorPlugins 接收 this.editor', () => {
    let ref
    const MyExt = Extension.create({
      name: 'ctx4',
      addProseMirrorPlugins() { ref = this.editor; return [] },
    })
    editor = createEditor({ extensions: [Document.resolve(), Paragraph.resolve(), MyExt.resolve()] })
    expect(ref).toBe(editor)
  })

  it('可通过 this.options 获取选项', () => {
    let captured
    const MyExt = Extension.create({
      name: 'opts',
      addCommands() { captured = this.options; return {} },
    })
    editor = createEditor({
      extensions: [Document.resolve(), Paragraph.resolve(), MyExt.configure({ key: 'value' })],
    })
    expect(captured).toEqual({ key: 'value' })
  })
})
