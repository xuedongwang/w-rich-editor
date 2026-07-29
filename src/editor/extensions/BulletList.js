import { NodeExtension } from '../Extension.js'
import { wrapInList, splitListItem, liftListItem, sinkListItem } from 'prosemirror-schema-list'
import { InputRule } from 'prosemirror-inputrules'

export const BulletList = NodeExtension.create({
  name: 'bullet_list',
  group: 'block',
  content: 'list_item+',
  toDOM: () => ['ul', 0],
  parseDOM: [{ tag: 'ul' }],
})

export const OrderedList = NodeExtension.create({
  name: 'ordered_list',
  group: 'block',
  content: 'list_item+',
  attrs: { start: { default: 1 } },
  toDOM(node) {
    return node.attrs.start === 1 ? ['ol', 0] : ['ol', { start: node.attrs.start }, 0]
  },
  parseDOM: [{
    tag: 'ol',
    getAttrs(dom) {
      return { start: dom.hasAttribute('start') ? +dom.getAttribute('start') : 1 }
    },
  }],
})

export const ListItem = NodeExtension.create({
  name: 'list_item',
  content: 'paragraph block*',
  defining: true,
  toDOM: () => ['li', 0],
  parseDOM: [{ tag: 'li' }],

  addCommands() {
    return {
      toggleBulletList: () => (state, dispatch) => {
        const { bullet_list, ordered_list, list_item } = state.schema.nodes
        if (!bullet_list || !list_item) return false
        const { $from } = state.selection

        // Walk up to find list wrapper
        let listDepth = -1
        for (let d = $from.depth; d > 0; d--) {
          const n = $from.node(d)
          if (n.type === bullet_list || n.type === ordered_list) {
            listDepth = d
            break
          }
        }

        if (listDepth < 0) {
          return wrapInList(bullet_list)(state, dispatch)
        }

        const listNode = $from.node(listDepth)

        if (listNode.type === bullet_list) {
          // In bullet list → lift contents out using ProseMirror's liftListItem
          return liftListItem(list_item)(state, dispatch)
        }

        if (listNode.type === ordered_list) {
          // In ordered list → convert to bullet list
          if (dispatch) dispatch(state.tr.setNodeMarkup($from.before(listDepth), bullet_list))
          return true
        }

        return false
      },

      toggleOrderedList: () => (state, dispatch) => {
        const { ordered_list, bullet_list, list_item } = state.schema.nodes
        if (!ordered_list || !list_item) return false
        const { $from } = state.selection

        let listDepth = -1
        for (let d = $from.depth; d > 0; d--) {
          const n = $from.node(d)
          if (n.type === ordered_list || n.type === bullet_list) {
            listDepth = d
            break
          }
        }

        if (listDepth < 0) {
          return wrapInList(ordered_list)(state, dispatch)
        }

        const listNode = $from.node(listDepth)

        if (listNode.type === ordered_list) {
          return liftListItem(list_item)(state, dispatch)
        }

        if (listNode.type === bullet_list) {
          if (dispatch) dispatch(state.tr.setNodeMarkup($from.before(listDepth), ordered_list))
          return true
        }

        return false
      },
    }
  },

  addKeyboardShortcuts() {
    // Helper: check if the cursor is inside a list_item (at any depth).
    // When the cursor is inside <li><p>text</p></li>, $from.parent is
    // the <p>, not the <li>. We need to walk up the ancestor chain.
    const isInsideListItem = ($from, listItemType) => {
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type === listItemType) return true
      }
      return false
    }

    return {
      Enter: (state, dispatch) => {
        const li = state.schema.nodes.list_item
        if (!li) return false
        if (!isInsideListItem(state.selection.$from, li)) return false
        return splitListItem(li)(state, dispatch)
      },
      Tab: (state, dispatch) => {
        const li = state.schema.nodes.list_item
        if (!li) return false
        if (!isInsideListItem(state.selection.$from, li)) return false
        return sinkListItem(li)(state, dispatch)
      },
      'Shift-Tab': (state, dispatch) => {
        const li = state.schema.nodes.list_item
        if (!li) return false
        if (!isInsideListItem(state.selection.$from, li)) return false
        return liftListItem(li)(state, dispatch)
      },
    }
  },

  addInputRules() {
    const editor = this.editor
    const rules = []

    if (editor.schema.nodes.bullet_list && editor.schema.nodes.list_item) {
      rules.push(new InputRule(/^(?:[-*+])\s$/, (state, match, start, end) => {
        const $start = state.doc.resolve(start)
        const paragraph = $start.parent
        const content = paragraph.content.cut(0, start - $start.start)
        const p = state.schema.nodes.paragraph.create(null, content)
        const li = state.schema.nodes.list_item.create(null, p)
        const ul = state.schema.nodes.bullet_list.create(null, li)
        return state.tr.replaceWith($start.before(), $start.after(), ul)
      }))
    }

    if (editor.schema.nodes.ordered_list && editor.schema.nodes.list_item) {
      rules.push(new InputRule(/^(\d+)\.\s$/, (state, match, start, end) => {
        const $start = state.doc.resolve(start)
        const paragraph = $start.parent
        const content = paragraph.content.cut(0, start - $start.start)
        const p = state.schema.nodes.paragraph.create(null, content)
        const li = state.schema.nodes.list_item.create(null, p)
        const ol = state.schema.nodes.ordered_list.create({ start: +match[1] }, li)
        return state.tr.replaceWith($start.before(), $start.after(), ol)
      }))
    }

    return rules
  },
})
