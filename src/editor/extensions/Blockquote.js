import { NodeExtension } from '../Extension'
import { wrapIn } from 'prosemirror-commands'
import { InputRule } from 'prosemirror-inputrules'

export const Blockquote = NodeExtension.create({
  name: 'blockquote',
  group: 'block',
  content: 'block+',
  defining: true,
  toDOM: () => ['blockquote', 0],
  parseDOM: [{ tag: 'blockquote' }],

  addCommands() {
    return {
      toggleBlockquote: () => (state, dispatch) => {
        const bqType = state.schema.nodes.blockquote
        if (!bqType) return false
        const { $from } = state.selection

        // Check if already in blockquote
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type === bqType) {
            // Lift: replace blockquote with its children
            if (dispatch) {
              const bqPos = $from.before(d)
              const bqNode = $from.node(d)
              const content = []
              bqNode.forEach(child => content.push(child))
              dispatch(state.tr.replaceWith(bqPos, bqPos + bqNode.nodeSize, content))
            }
            return true
          }
        }

        // Wrap in blockquote
        return wrapIn(bqType)(state, dispatch)
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-b': (state, dispatch) => {
        const bqType = state.schema.nodes.blockquote
        if (!bqType) return false
        const { $from } = state.selection

        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type === bqType) {
            if (dispatch) {
              const bqPos = $from.before(d)
              const bqNode = $from.node(d)
              const content = []
              bqNode.forEach(child => content.push(child))
              dispatch(state.tr.replaceWith(bqPos, bqPos + bqNode.nodeSize, content))
            }
            return true
          }
        }
        return wrapIn(bqType)(state, dispatch)
      },
    }
  },

  addInputRules() {
    return [new InputRule(/^>\s$/, (state, _match, start, end) => {
      const $start = state.doc.resolve(start)
      const paragraph = $start.parent
      const content = paragraph.content.cut(0, start - $start.start)
      const p = state.schema.nodes.paragraph.create(null, content)
      const bq = state.schema.nodes.blockquote.create(null, p)
      return state.tr.replaceWith($start.before(), $start.after(), bq)
    })]
  },
})
