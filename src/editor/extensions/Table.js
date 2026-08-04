import { NodeExtension } from '../Extension.js'
import {
  tableEditing,
  columnResizing,
  goToNextCell,
  addColumnBefore,
  addColumnAfter,
  deleteColumn,
  addRowBefore,
  addRowAfter,
  deleteRow,
  deleteTable as pmDeleteTable,
  toggleHeaderRow,
  toggleHeaderColumn,
  mergeCells,
  splitCell,
  isInTable,
} from 'prosemirror-tables'

// ============================================================================
// Shared helpers
// ============================================================================

const cellAttrs = {
  colspan: { default: 1 },
  rowspan: { default: 1 },
  colwidth: { default: null },
}

function cellDOMAttrs(node) {
  const attrs = {}
  if (node.attrs.colspan !== 1) attrs.colspan = node.attrs.colspan
  if (node.attrs.rowspan !== 1) attrs.rowspan = node.attrs.rowspan
  if (node.attrs.colwidth) {
    attrs.style = node.attrs.colwidth.map(w => `width:${w}px`).join(';')
  }
  return attrs
}

function parseCellAttrs(dom) {
  const widthStr = dom.getAttribute('style')
  let colwidth = null
  if (widthStr) {
    const widths = widthStr.match(/width:(\d+)px/g)
    if (widths) {
      colwidth = widths.map(s => Number(s.replace(/[^0-9]/g, '')))
    }
  }
  return {
    colspan: Number(dom.getAttribute('colspan') || 1),
    rowspan: Number(dom.getAttribute('rowspan') || 1),
    colwidth,
  }
}

// ============================================================================
// Table
// ============================================================================

export const Table = NodeExtension.create({
  name: 'table',
  group: 'block',
  content: 'table_row+',
  tableRole: 'table',
  isolating: true,

  toDOM() {
    return ['table', ['tbody', 0]]
  },

  parseDOM: [{ tag: 'table' }],

  addCommands() {
    return {
      insertTable: (attrs) => (state, dispatch) => {
        const { rows = 3, cols = 3 } = attrs || {}
        const { table, table_row, table_cell, paragraph } = state.schema.nodes
        if (!table || !table_row || !table_cell || !paragraph) return false

        const tableRows = []
        for (let r = 0; r < rows; r++) {
          const cells = []
          for (let c = 0; c < cols; c++) {
            cells.push(table_cell.create(null, paragraph.create()))
          }
          tableRows.push(table_row.create(null, cells))
        }

        const tableNode = table.create(null, tableRows)
        if (dispatch) {
          dispatch(state.tr.replaceSelectionWith(tableNode).scrollIntoView())
        }
        return true
      },

      addColumnBefore: () => (state, dispatch, view) => {
        return addColumnBefore(state, dispatch, view)
      },

      addColumnAfter: () => (state, dispatch, view) => {
        return addColumnAfter(state, dispatch, view)
      },

      deleteColumn: () => (state, dispatch, view) => {
        return deleteColumn(state, dispatch, view)
      },

      addRowBefore: () => (state, dispatch, view) => {
        return addRowBefore(state, dispatch, view)
      },

      addRowAfter: () => (state, dispatch, view) => {
        return addRowAfter(state, dispatch, view)
      },

      deleteRow: () => (state, dispatch, view) => {
        return deleteRow(state, dispatch, view)
      },

      deleteTable: () => (state, dispatch, view) => {
        return pmDeleteTable(state, dispatch, view)
      },

      toggleHeaderRow: () => (state, dispatch, view) => {
        return toggleHeaderRow(state, dispatch, view)
      },

      toggleHeaderColumn: () => (state, dispatch, view) => {
        return toggleHeaderColumn(state, dispatch, view)
      },

      mergeCells: () => (state, dispatch, view) => {
        return mergeCells(state, dispatch, view)
      },

      splitCell: () => (state, dispatch, view) => {
        return splitCell(state, dispatch, view)
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      Tab: (state, dispatch, view) => {
        return goToNextCell(1)(state, dispatch, view)
      },
      'Shift-Tab': (state, dispatch, view) => {
        return goToNextCell(-1)(state, dispatch, view)
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      columnResizing(),
      tableEditing(),
    ]
  },
})

// ============================================================================
// TableRow
// ============================================================================

export const TableRow = NodeExtension.create({
  name: 'table_row',
  content: '(table_cell | table_header)*',
  tableRole: 'row',

  toDOM() {
    return ['tr', 0]
  },

  parseDOM: [{ tag: 'tr' }],
})

// ============================================================================
// TableCell
// ============================================================================

export const TableCell = NodeExtension.create({
  name: 'table_cell',
  content: 'block+',
  tableRole: 'cell',
  attrs: cellAttrs,
  defining: true,

  toDOM(node) {
    return ['td', cellDOMAttrs(node), 0]
  },

  parseDOM: [{
    tag: 'td',
    getAttrs: parseCellAttrs,
  }],
})

// ============================================================================
// TableHeader
// ============================================================================

export const TableHeader = NodeExtension.create({
  name: 'table_header',
  content: 'block+',
  tableRole: 'header_cell',
  attrs: cellAttrs,
  defining: true,

  toDOM(node) {
    return ['th', cellDOMAttrs(node), 0]
  },

  parseDOM: [{
    tag: 'th',
    getAttrs: parseCellAttrs,
  }],
})
