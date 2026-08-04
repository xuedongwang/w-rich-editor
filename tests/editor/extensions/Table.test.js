import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Table, TableRow, TableCell, TableHeader } from '../../../src/editor/extensions/Table.js'
import { createEditor, setCursor, cleanup } from '../../helper.js'

let editor

beforeEach(() => { document.body.innerHTML = '' })
afterEach(() => { cleanup(editor) })

// ============================================================================
// Extension definition
// ============================================================================

describe('Table 扩展定义', () => {
  it('Table 名称为 table', () => {
    expect(Table.resolve().name).toBe('table')
  })

  it('Table 是 block group', () => {
    expect(Table.resolve().nodeSpec.group).toBe('block')
  })

  it('Table 内容为 table_row+', () => {
    expect(Table.resolve().nodeSpec.content).toBe('table_row+')
  })

  it('Table 有 tableRole: table', () => {
    expect(Table.resolve().nodeSpec.tableRole).toBe('table')
  })

  it('Table 是 isolating', () => {
    expect(Table.resolve().nodeSpec.isolating).toBe(true)
  })

  it('Table 渲染为 table > tbody', () => {
    const dom = Table.resolve().nodeSpec.toDOM()
    expect(dom[0]).toBe('table')
    expect(dom[1][0]).toBe('tbody')
  })

  it('Table 解析 table 元素', () => {
    expect(Table.resolve().nodeSpec.parseDOM[0].tag).toBe('table')
  })
})

describe('TableRow 扩展定义', () => {
  it('名称为 table_row', () => {
    expect(TableRow.resolve().name).toBe('table_row')
  })

  it('内容为 (table_cell | table_header)*', () => {
    expect(TableRow.resolve().nodeSpec.content).toBe('(table_cell | table_header)*')
  })

  it('有 tableRole: row', () => {
    expect(TableRow.resolve().nodeSpec.tableRole).toBe('row')
  })

  it('渲染为 tr', () => {
    const dom = TableRow.resolve().nodeSpec.toDOM()
    expect(dom[0]).toBe('tr')
  })
})

describe('TableCell 扩展定义', () => {
  it('名称为 table_cell', () => {
    expect(TableCell.resolve().name).toBe('table_cell')
  })

  it('内容为 block+', () => {
    expect(TableCell.resolve().nodeSpec.content).toBe('block+')
  })

  it('有 tableRole: cell', () => {
    expect(TableCell.resolve().nodeSpec.tableRole).toBe('cell')
  })

  it('有 colspan/rowspan/colwidth 属性', () => {
    const attrs = TableCell.resolve().nodeSpec.attrs
    expect(attrs.colspan.default).toBe(1)
    expect(attrs.rowspan.default).toBe(1)
    expect(attrs.colwidth.default).toBe(null)
  })

  it('默认属性渲染为 td', () => {
    const dom = TableCell.resolve().nodeSpec.toDOM({ attrs: { colspan: 1, rowspan: 1, colwidth: null } })
    expect(dom[0]).toBe('td')
    expect(dom[1]).toEqual({})
  })

  it('colspan > 1 时渲染 colspan 属性', () => {
    const dom = TableCell.resolve().nodeSpec.toDOM({ attrs: { colspan: 2, rowspan: 1, colwidth: null } })
    expect(dom[1].colspan).toBe(2)
  })

  it('colwidth 时渲染 style', () => {
    const dom = TableCell.resolve().nodeSpec.toDOM({ attrs: { colspan: 1, rowspan: 1, colwidth: [200] } })
    expect(dom[1].style).toBe('width:200px')
  })

  it('解析 td 元素', () => {
    const rule = TableCell.resolve().nodeSpec.parseDOM[0]
    expect(rule.tag).toBe('td')
    const dom = document.createElement('td')
    dom.setAttribute('colspan', '3')
    dom.setAttribute('rowspan', '2')
    const attrs = rule.getAttrs(dom)
    expect(attrs.colspan).toBe(3)
    expect(attrs.rowspan).toBe(2)
  })
})

describe('TableHeader 扩展定义', () => {
  it('名称为 table_header', () => {
    expect(TableHeader.resolve().name).toBe('table_header')
  })

  it('有 tableRole: header_cell', () => {
    expect(TableHeader.resolve().nodeSpec.tableRole).toBe('header_cell')
  })

  it('渲染为 th', () => {
    const dom = TableHeader.resolve().nodeSpec.toDOM({ attrs: { colspan: 1, rowspan: 1, colwidth: null } })
    expect(dom[0]).toBe('th')
  })

  it('解析 th 元素', () => {
    const rule = TableHeader.resolve().nodeSpec.parseDOM[0]
    expect(rule.tag).toBe('th')
  })
})

// ============================================================================
// Commands
// ============================================================================

describe('Table 命令', () => {
  it('insertTable 插入默认 3x3 表格', () => {
    editor = createEditor({ content: '<p>text</p>' })
    setCursor(editor, 1)
    editor.commands.insertTable()
    const html = editor.getHTML()
    expect(html).toContain('<table>')
    expect(html).toContain('<tbody>')
    // Count rows
    const matches = html.match(/<tr>/g)
    expect(matches).toHaveLength(3)
    // Count cells per row
    const cellMatches = html.match(/<td>/g)
    expect(cellMatches).toHaveLength(9)
  })

  it('insertTable 支持自定义行列数', () => {
    editor = createEditor({ content: '<p>text</p>' })
    setCursor(editor, 1)
    editor.commands.insertTable({ rows: 2, cols: 4 })
    const html = editor.getHTML()
    const rowMatches = html.match(/<tr>/g)
    expect(rowMatches).toHaveLength(2)
    const cellMatches = html.match(/<td>/g)
    expect(cellMatches).toHaveLength(8)
  })

  it('insertTable 每个单元格包含一个空段落', () => {
    editor = createEditor({ content: '<p>text</p>' })
    setCursor(editor, 1)
    editor.commands.insertTable({ rows: 1, cols: 1 })
    const html = editor.getHTML()
    expect(html).toContain('<td><p>')
  })

  it('addColumnAfter 在光标所在列后添加列', () => {
    editor = createEditor({
      content: '<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>',
    })
    // Place cursor inside first cell
    setCursor(editor, 4)
    editor.commands.addColumnAfter()
    const html = editor.getHTML()
    const cellMatches = html.match(/<td>/g)
    expect(cellMatches).toHaveLength(3) // was 2, now 3
  })

  it('addColumnBefore 在光标所在列前添加列', () => {
    editor = createEditor({
      content: '<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>',
    })
    setCursor(editor, 4)
    editor.commands.addColumnBefore()
    const html = editor.getHTML()
    const cellMatches = html.match(/<td>/g)
    expect(cellMatches).toHaveLength(3)
  })

  it('deleteColumn 删除光标所在列', () => {
    editor = createEditor({
      content: '<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>',
    })
    setCursor(editor, 4)
    editor.commands.deleteColumn()
    const html = editor.getHTML()
    const cellMatches = html.match(/<td>/g)
    expect(cellMatches).toHaveLength(1)
  })

  it('addRowAfter 在光标所在行后添加行', () => {
    editor = createEditor({
      content: '<table><tbody><tr><td><p>a</p></td></tr></tbody></table>',
    })
    setCursor(editor, 4)
    editor.commands.addRowAfter()
    const html = editor.getHTML()
    const rowMatches = html.match(/<tr>/g)
    expect(rowMatches).toHaveLength(2)
  })

  it('addRowBefore 在光标所在行前添加行', () => {
    editor = createEditor({
      content: '<table><tbody><tr><td><p>a</p></td></tr></tbody></table>',
    })
    setCursor(editor, 4)
    editor.commands.addRowBefore()
    const html = editor.getHTML()
    const rowMatches = html.match(/<tr>/g)
    expect(rowMatches).toHaveLength(2)
  })

  it('deleteRow 删除光标所在行', () => {
    editor = createEditor({
      content: '<table><tbody><tr><td><p>a</p></td></tr><tr><td><p>b</p></td></tr></tbody></table>',
    })
    setCursor(editor, 4)
    editor.commands.deleteRow()
    const html = editor.getHTML()
    const rowMatches = html.match(/<tr>/g)
    expect(rowMatches).toHaveLength(1)
  })

  it('deleteTable 删除整个表格', () => {
    editor = createEditor({
      content: '<p>before</p><table><tbody><tr><td><p>a</p></td></tr></tbody></table><p>after</p>',
    })
    setCursor(editor, 12) // inside table
    editor.commands.deleteTable()
    const html = editor.getHTML()
    expect(html).not.toContain('<table>')
    expect(html).toContain('<p>before</p>')
    expect(html).toContain('<p>after</p>')
  })

  it('toggleHeaderRow 切换行首', () => {
    editor = createEditor({
      content: '<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr><tr><td><p>c</p></td><td><p>d</p></td></tr></tbody></table>',
    })
    setCursor(editor, 4)
    editor.commands.toggleHeaderRow()
    const html = editor.getHTML()
    expect(html).toContain('<th>')
  })

  it('toggleHeaderColumn 切换列首', () => {
    editor = createEditor({
      content: '<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr><tr><td><p>c</p></td><td><p>d</p></td></tr></tbody></table>',
    })
    setCursor(editor, 4)
    editor.commands.toggleHeaderColumn()
    const html = editor.getHTML()
    expect(html).toContain('<th>')
  })
})

// ============================================================================
// HTML serialization / parsing
// ============================================================================

describe('Table HTML 序列化与解析', () => {
  it('正确序列化表格结构', () => {
    editor = createEditor({
      content: '<table><tbody><tr><td><p>hello</p></td></tr></tbody></table>',
    })
    const html = editor.getHTML()
    expect(html).toContain('<table>')
    expect(html).toContain('<tbody>')
    expect(html).toContain('<tr>')
    expect(html).toContain('<td>')
    expect(html).toContain('hello')
  })

  it('正确解析带有 colspan 的表格', () => {
    editor = createEditor({
      content: '<table><tbody><tr><td colspan="2"><p>wide</p></td></tr></tbody></table>',
    })
    const html = editor.getHTML()
    expect(html).toContain('colspan="2"')
  })

  it('正确解析表头单元格', () => {
    editor = createEditor({
      content: '<table><tbody><tr><th><p>Header</p></th></tr></tbody></table>',
    })
    const html = editor.getHTML()
    expect(html).toContain('<th>')
    expect(html).toContain('Header')
  })
})
