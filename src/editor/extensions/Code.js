import { MarkExtension } from '../Extension'
import { toggleMark } from 'prosemirror-commands'
import { InputRule } from 'prosemirror-inputrules'

export const Code = MarkExtension.create({
  name: 'code',
  inclusive: false,
  excludes: '_',
  parseDOM: [{ tag: 'code' }],
  toDOM: () => ['code', 0],

  addCommands() {
    return {
      toggleCode: () => (state, dispatch) => {
        const markType = state.schema.marks.code
        if (!markType) return false
        return toggleMark(markType)(state, dispatch)
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-`': (state, dispatch) => {
        const m = state.schema.marks.code
        return m ? toggleMark(m)(state, dispatch) : false
      },
    }
  },

  addInputRules() {
    return [new InputRule(/`([^`]+)`$/, (state, match, start, end) => {
      const markType = state.schema.marks.code
      if (!markType) return null
      const text = match[1]
      return state.tr.delete(start, end).insertText(text, start)
        .addMark(start, start + text.length, markType.create())
    })]
  },
})
