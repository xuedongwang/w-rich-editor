import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TaskList, TaskItem } from '../../../src/editor/extensions/TaskList.js'
import { createEditor, setCursor, cleanup } from '../../helper.js'

let editor

beforeEach(() => { document.body.innerHTML = '' })
afterEach(() => { cleanup(editor) })

// ============================================================================
// 扩展定义
// ============================================================================

describe('TaskList 扩展定义', () => {
  it('名称正确', () => {
    expect(TaskList.resolve().name).toBe('task_list')
  })

  it('是块级节点', () => {
    expect(TaskList.resolve().nodeSpec.group).toBe('block')
  })

  it('要求 task_item+ 内容', () => {
    expect(TaskList.resolve().nodeSpec.content).toBe('task_item+')
  })

  it('渲染为带 data-task-list 的 <ul>', () => {
    const dom = TaskList.resolve().nodeSpec.toDOM()
    expect(dom[0]).toBe('ul')
    expect(dom[1]['data-task-list']).toBe('')
  })

  it('解析 ul[data-task-list] 元素', () => {
    expect(TaskList.resolve().nodeSpec.parseDOM[0].tag).toBe('ul[data-task-list]')
  })
})

describe('TaskItem 扩展定义', () => {
  it('名称正确', () => {
    expect(TaskItem.resolve().name).toBe('task_item')
  })

  it('具有 defining 属性', () => {
    expect(TaskItem.resolve().nodeSpec.defining).toBe(true)
  })

  it('checked 属性默认为 false', () => {
    expect(TaskItem.resolve().nodeSpec.attrs.checked.default).toBe(false)
  })

  it('未选中时渲染为 data-checked="false"', () => {
    const dom = TaskItem.resolve().nodeSpec.toDOM({ attrs: { checked: false } })
    expect(dom[0]).toBe('li')
    expect(dom[1]['data-checked']).toBe('false')
    expect(dom[1].class).toBe('task-item')
  })

  it('选中时渲染为 data-checked="true"', () => {
    const dom = TaskItem.resolve().nodeSpec.toDOM({ attrs: { checked: true } })
    expect(dom[1]['data-checked']).toBe('true')
  })

  it('解析 li[data-checked] 元素', () => {
    const rule = TaskItem.resolve().nodeSpec.parseDOM[0]
    expect(rule.tag).toBe('li[data-checked]')
    expect(rule.getAttrs({ getAttribute: () => 'true' })).toEqual({ checked: true })
    expect(rule.getAttrs({ getAttribute: () => 'false' })).toEqual({ checked: false })
  })
})

// ============================================================================
// 命令
// ============================================================================

describe('TaskList 命令', () => {
  it('toggleTaskList 将段落转换为 task_list', () => {
    editor = createEditor({ content: '<p>Task</p>' })
    setCursor(editor, 2)
    editor.commands.toggleTaskList()
    expect(editor.getHTML()).toContain('data-task-list')
    expect(editor.getHTML()).toContain('task-item')
    expect(editor.getHTML()).toContain('Task')
  })

  it('toggleTaskList 在 task_list 中解除列表', () => {
    editor = createEditor({
      content: '<ul data-task-list><li class="task-item" data-checked="false"><p>Task</p></li></ul>',
    })
    setCursor(editor, 3)
    editor.commands.toggleTaskList()
    expect(editor.getHTML()).not.toContain('data-task-list')
  })

  it('toggleTaskList 将 bullet_list 转换为 task_list', () => {
    editor = createEditor({ content: '<ul><li><p>Item</p></li></ul>' })
    setCursor(editor, 3)
    editor.commands.toggleTaskList()
    expect(editor.getHTML()).toContain('data-task-list')
  })

  it('toggleTaskList 将 ordered_list 转换为 task_list', () => {
    editor = createEditor({ content: '<ol><li><p>Item</p></li></ol>' })
    setCursor(editor, 3)
    editor.commands.toggleTaskList()
    expect(editor.getHTML()).toContain('data-task-list')
  })

  it('toggleBulletList 将 task_list 转换为 bullet_list', () => {
    editor = createEditor({
      content: '<ul data-task-list><li class="task-item" data-checked="false"><p>Task</p></li></ul>',
    })
    setCursor(editor, 3)
    editor.commands.toggleBulletList()
    const html = editor.getHTML()
    expect(html).not.toContain('data-task-list')
    expect(html).toContain('<ul>')
  })

  it('toggleOrderedList 将 task_list 转换为 ordered_list', () => {
    editor = createEditor({
      content: '<ul data-task-list><li class="task-item" data-checked="false"><p>Task</p></li></ul>',
    })
    setCursor(editor, 3)
    editor.commands.toggleOrderedList()
    const html = editor.getHTML()
    expect(html).not.toContain('data-task-list')
    expect(html).toContain('<ol')
  })

  it('点击 checkbox 切换 checked 属性', () => {
    editor = createEditor({
      content: '<ul data-task-list><li class="task-item" data-checked="false"><p>Task</p></li></ul>',
    })
    const checkbox = editor.view.dom.querySelector('.task-checkbox')
    expect(checkbox).toBeTruthy()
    checkbox.click()
    expect(editor.getHTML()).toContain('data-checked="true"')
  })

  it('再次点击 checkbox 取消选中', () => {
    editor = createEditor({
      content: '<ul data-task-list><li class="task-item" data-checked="false"><p>Task</p></li></ul>',
    })
    // First click — re-query each time since NodeView may re-render
    editor.view.dom.querySelector('.task-checkbox').click()
    expect(editor.getHTML()).toContain('data-checked="true"')
    // Second click
    editor.view.dom.querySelector('.task-checkbox').click()
    expect(editor.getHTML()).toContain('data-checked="false"')
  })
})

// ============================================================================
// 键盘快捷键
// ============================================================================

describe('TaskList 键盘快捷键', () => {
  it('Enter 在非空 task_item 中分割列表项', () => {
    editor = createEditor({
      content: '<ul data-task-list><li class="task-item" data-checked="false"><p>Hello</p></li></ul>',
    })
    // doc(0) > task_list(1) > task_item(2) > p(3) > "Hello"(4-8)
    setCursor(editor, 7) // inside "Hello"
    const ext = editor.extensions.find(e => e.name === 'task_item')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts.Enter(editor.state, editor.view.dispatch)
    const items = []
    editor.state.doc.descendants(n => { if (n.type.name === 'task_item') items.push(n) })
    expect(items.length).toBe(2)
  })

  it('Enter 在空 task_item 中退出列表', () => {
    editor = createEditor({
      content: '<ul data-task-list><li class="task-item" data-checked="false"><p></p></li></ul>',
    })
    setCursor(editor, 3)
    const ext = editor.extensions.find(e => e.name === 'task_item')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts.Enter(editor.state, editor.view.dispatch)
    expect(editor.getHTML()).not.toContain('task_item')
    expect(editor.getHTML()).not.toContain('data-task-list')
  })

  it('Enter 在多项目列表的空末尾项退出时保留其余项目', () => {
    editor = createEditor({
      content: '<ul data-task-list>' +
        '<li class="task-item" data-checked="true"><p>Done</p></li>' +
        '<li class="task-item" data-checked="false"><p></p></li>' +
        '</ul>',
    })
    // 光标在第二个（空）task_item 的段落内
    let emptyParaPos = 0
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'task_item' && node.firstChild.content.size === 0) {
        emptyParaPos = pos + 1 // inside the empty paragraph
      }
    })
    setCursor(editor, emptyParaPos)
    const ext = editor.extensions.find(e => e.name === 'task_item')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts.Enter(editor.state, editor.view.dispatch)
    const html = editor.getHTML()
    // 原 task_list 保留（含已完成的项）
    expect(html).toContain('data-task-list')
    expect(html).toContain('Done')
    expect(html).toContain('data-checked="true"')
    // 空的末尾项应被去除
    expect(html).not.toContain('data-checked="false"')
    // 在 task_list 后插入了新段落，光标应位于其中
    const { $from } = editor.state.selection
    expect($from.parent.type.name).toBe('paragraph')
  })

  it('不在 task_item 中 Enter 返回 false', () => {
    editor = createEditor({ content: '<p>Not a task</p>' })
    setCursor(editor, 2)
    const ext = editor.extensions.find(e => e.name === 'task_item')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    expect(shortcuts.Enter(editor.state, editor.view.dispatch)).toBe(false)
  })

  it('Tab 嵌套 task_item', () => {
    editor = createEditor({
      content: '<ul data-task-list>' +
        '<li class="task-item" data-checked="false"><p>First</p></li>' +
        '<li class="task-item" data-checked="false"><p>Second</p></li>' +
        '</ul>',
    })
    // Position inside "Second"
    const secondPos = editor.state.doc.textContent.indexOf('Second') + 2
    let absPos = 0
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'Second') absPos = pos + 1
    })
    setCursor(editor, absPos)
    const ext = editor.extensions.find(e => e.name === 'task_item')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts.Tab(editor.state, editor.view.dispatch)
    let nestedTaskLists = 0
    editor.state.doc.descendants(n => { if (n.type.name === 'task_list') nestedTaskLists++ })
    expect(nestedTaskLists).toBeGreaterThanOrEqual(2)
  })

  it('Shift-Tab 解除嵌套', () => {
    editor = createEditor({
      content: '<ul data-task-list>' +
        '<li class="task-item" data-checked="false"><p>Outer</p></li>' +
        '<li class="task-item" data-checked="false"><ul data-task-list>' +
        '<li class="task-item" data-checked="false"><p>Inner</p></li>' +
        '</ul></li></ul>',
    })
    // Position inside "Inner" paragraph
    let innerPos = 0
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'Inner') innerPos = pos + 1
    })
    setCursor(editor, innerPos)
    const ext = editor.extensions.find(e => e.name === 'task_item')
    const shortcuts = ext._addKeyboardShortcuts.call(ext)
    shortcuts['Shift-Tab'](editor.state, editor.view.dispatch)
    // After lift, "Inner" should be at same level as "Outer"
    const text = editor.state.doc.textContent
    expect(text).toContain('Outer')
    expect(text).toContain('Inner')
  })
})

// ============================================================================
// 输入规则
// ============================================================================

describe('TaskList 输入规则', () => {
  it('提供输入规则', () => {
    editor = createEditor()
    const ext = editor.extensions.find(e => e.name === 'task_item')
    expect(ext._addInputRules.call(ext).length).toBeGreaterThan(0)
  })

  it('正则匹配 - [ ] 和 - [x]', () => {
    const pattern = /^(?:[-*+])\s\[([ x])\]\s$/
    expect(pattern.test('- [ ] ')).toBe(true)
    expect(pattern.test('- [x] ')).toBe(true)
    expect(pattern.test('* [x] ')).toBe(true)
    expect(pattern.test('+ [ ] ')).toBe(true)
    expect(pattern.test('- ')).toBe(false)
    expect(pattern.test('1. ')).toBe(false)
  })

  it('捕获组提取 checked 状态', () => {
    const pattern = /^(?:[-*+])\s\[([ x])\]\s$/
    const unchecked = '- [ ] '.match(pattern)
    const checked = '- [x] '.match(pattern)
    expect(unchecked[1]).toBe(' ')
    expect(checked[1]).toBe('x')
  })

  it('创建未选中 task_list 后光标位于段落内', () => {
    editor = createEditor({ content: '<p>- [ ] </p>' })
    setCursor(editor, 7)
    const ext = editor.extensions.find(e => e.name === 'task_item')
    const rules = ext._addInputRules.call(ext)
    const rule = rules.find(r => r.match.test('- [ ] '))
    const tr = rule.handler(editor.state, ['- [ ] ', ' '], 1, 7)
    editor.view.dispatch(tr)
    const { $from } = editor.state.selection
    expect($from.parent.type.name).toBe('paragraph')
    expect($from.node($from.depth - 1).type.name).toBe('task_item')
    expect($from.node($from.depth - 2).type.name).toBe('task_list')
  })

  it('创建已选中 task_list 时 checked=true', () => {
    editor = createEditor({ content: '<p>- [x] </p>' })
    setCursor(editor, 7)
    const ext = editor.extensions.find(e => e.name === 'task_item')
    const rules = ext._addInputRules.call(ext)
    const rule = rules.find(r => r.match.test('- [x] '))
    const tr = rule.handler(editor.state, ['- [x] ', 'x'], 1, 7)
    editor.view.dispatch(tr)
    expect(editor.getHTML()).toContain('data-checked="true"')
  })

  it('在引用块内 - [ ]  空格不创建任务列表', () => {
    editor = createEditor({ content: '<blockquote><p>- [ ] </p></blockquote>' })
    setCursor(editor, 8)
    const ext = editor.extensions.find(e => e.name === 'task_item')
    const rules = ext._addInputRules.call(ext)
    const rule = rules.find(r => r.match.test('- [ ] '))
    const result = rule.handler(editor.state, ['- [ ] ', ' '], 2, 8)
    expect(result).toBeNull()
  })

  it('补救规则：在 bullet_list 中输入 `[] ` 后转换为 task_list', () => {
    // 模拟完整流程：-  触发 BulletList，然后输入 [] 触发补救规则
    editor = createEditor({ content: '<ul><li><p>[] </p></li></ul>' })
    // positions: doc(0) > bullet_list(1) > list_item(2) > paragraph(3) > "[] "(3..6, size 3)
    setCursor(editor, 6) // cursor after the trailing space
    const ext = editor.extensions.find(e => e.name === 'task_item')
    const rules = ext._addInputRules.call(ext)
    const rescueRule = rules.find(r => r.match.test('[] '))
    expect(rescueRule, '应存在 `[] ` 补救规则').toBeTruthy()
    const tr = rescueRule.handler(editor.state, ['[] ', '[]'], 3, 6)
    editor.view.dispatch(tr)
    const html = editor.getHTML()
    expect(html).toContain('data-task-list')
    expect(html).not.toContain('<ul>')
    // `[] ` 前缀应被去除
    expect(editor.state.doc.textContent).not.toContain('[')
  })

  it('补救规则：`[x] ` 创建已选中的 task_list', () => {
    editor = createEditor({ content: '<ul><li><p>[x] </p></li></ul>' })
    // positions: doc(0) > bullet_list(1) > list_item(2) > paragraph(3) > "[x] "(3..6, size 3)
    setCursor(editor, 6) // cursor after the trailing space
    const ext = editor.extensions.find(e => e.name === 'task_item')
    const rules = ext._addInputRules.call(ext)
    const rescueRule = rules.find(r => r.match.test('[x] '))
    const tr = rescueRule.handler(editor.state, ['[x] ', '[x]'], 3, 6)
    editor.view.dispatch(tr)
    expect(editor.getHTML()).toContain('data-checked="true"')
  })
})

// ============================================================================
// 活动状态检测
// ============================================================================

describe('TaskList 活动状态检测', () => {
  it('在 task_list 中 isActive 返回 true', () => {
    editor = createEditor({
      content: '<ul data-task-list><li class="task-item" data-checked="false"><p>Task</p></li></ul>',
    })
    setCursor(editor, 3)
    expect(editor.isActive('task_list')).toBe(true)
    expect(editor.isActive('task_item')).toBe(true)
  })

  it('不在 task_list 中 isActive 返回 false', () => {
    editor = createEditor({ content: '<p>Not a task</p>' })
    setCursor(editor, 2)
    expect(editor.isActive('task_list')).toBe(false)
    expect(editor.isActive('task_item')).toBe(false)
  })

  it('检测特定 checked 状态', () => {
    editor = createEditor({
      content: '<ul data-task-list><li class="task-item" data-checked="true"><p>Done</p></li></ul>',
    })
    setCursor(editor, 3)
    expect(editor.isActive('task_item', { checked: true })).toBe(true)
    expect(editor.isActive('task_item', { checked: false })).toBe(false)
  })
})
