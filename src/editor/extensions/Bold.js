import { MarkExtension } from '../Extension'
import { toggleMark } from 'prosemirror-commands'
import { InputRule } from 'prosemirror-inputrules'

export const Bold = MarkExtension.create({
  name: 'bold',
  parseDOM: [
    { tag: 'strong' },
    { tag: 'b' },
    { style: 'font-weight', getAttrs: (v) => /^(bold(er)?|[5-9]\d{2,})$/.test(v) },
  ],
  toDOM: () => ['strong', 0],

  addCommands() {
    return {
      toggleBold: () => (state, dispatch) => {
        const markType = state.schema.marks.bold
        if (!markType) return false
        return toggleMark(markType)(state, dispatch)
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-b': (state, dispatch) => {
        const m = state.schema.marks.bold
        return m ? toggleMark(m)(state, dispatch) : false
      },
    }
  },

  addInputRules() {
    return [new InputRule(/\*\*([^*]+)\*\*$/, (state, match, start, end) => {
      const markType = state.schema.marks.bold
      if (!markType) return null
      const text = match[1]
      return state.tr.delete(start, end).insertText(text, start)
        .addMark(start, start + text.length, markType.create())
    })]
  },
})
