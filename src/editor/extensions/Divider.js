import { NodeExtension } from '../Extension'
import { InputRule } from 'prosemirror-inputrules'

export const Divider = NodeExtension.create({
  name: 'horizontal_rule',
  group: 'block',
  toDOM: () => ['hr'],
  parseDOM: [{ tag: 'hr' }],

  addCommands() {
    return {
      insertDivider: () => (state, dispatch) => {
        const hrType = state.schema.nodes.horizontal_rule
        if (!hrType) return false
        if (dispatch) dispatch(state.tr.replaceSelectionWith(hrType.create()))
        return true
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-_': (state, dispatch) => {
        const hrType = state.schema.nodes.horizontal_rule
        if (!hrType) return false
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
      return state.tr.replaceWith($start.before(), $start.after(), hrType.create())
    })]
  },
})
