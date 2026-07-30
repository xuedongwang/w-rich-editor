import { NodeExtension } from '../Extension'
import { InputRule } from 'prosemirror-inputrules'

function canInsertHr(hrType, state) {
  if (!hrType) return false
  const { $from } = state.selection
  if ($from.parent.isTextblock) {
    // Cursor inside a textblock (e.g. paragraph). The hr would become a
    // sibling of the textblock in the textblock's parent, so check the
    // textblock's parent (grandparent of cursor).
    if ($from.depth < 1) return false
    const grandParent = $from.node($from.depth - 1)
    const idx = $from.index($from.depth - 1)
    return grandParent.canReplaceWith(idx, idx, hrType)
  }
  return $from.parent.canReplaceWith($from.index(), $from.index(), hrType)
}

export const Divider = NodeExtension.create({
  name: 'horizontal_rule',
  group: 'block',
  toDOM: () => ['hr'],
  parseDOM: [{ tag: 'hr' }],

  addCommands() {
    return {
      insertDivider: () => (state, dispatch) => {
        const hrType = state.schema.nodes.horizontal_rule
        if (!canInsertHr(hrType, state)) return false
        if (dispatch) dispatch(state.tr.replaceSelectionWith(hrType.create()))
        return true
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-_': (state, dispatch) => {
        const hrType = state.schema.nodes.horizontal_rule
        if (!canInsertHr(hrType, state)) return false
        if (dispatch) dispatch(state.tr.replaceSelectionWith(hrType.create()))
        return true
      },
    }
  },

  addInputRules() {
    return [new InputRule(/^(?:---|___|\*\*\*)$/, (state, _match, start, end) => {
      const hrType = state.schema.nodes.horizontal_rule
      if (!hrType) return null
      const $start = state.doc.resolve(start)
      // For input rules, $start is at the block level (paragraph). Check if
      // the paragraph's parent (e.g. document or blockquote) allows hr.
      if ($start.depth < 1) return null
      const grandParent = $start.node($start.depth - 1)
      const idx = $start.index($start.depth - 1)
      if (!grandParent.canReplaceWith(idx, idx, hrType)) return null
      return state.tr.replaceWith($start.before(), $start.after(), hrType.create())
    })]
  },
})
