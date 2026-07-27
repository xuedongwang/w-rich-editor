import { MarkExtension } from '../Extension'
import { toggleMark } from 'prosemirror-commands'
import { InputRule } from 'prosemirror-inputrules'

export const Italic = MarkExtension.create({
  name: 'italic',
  parseDOM: [
    { tag: 'em' },
    { tag: 'i' },
    { style: 'font-style=italic' },
  ],
  toDOM: () => ['em', 0],

  addCommands() {
    return {
      toggleItalic: () => (state, dispatch) => {
        const markType = state.schema.marks.italic
        if (!markType) return false
        return toggleMark(markType)(state, dispatch)
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-i': (state, dispatch) => {
        const m = state.schema.marks.italic
        return m ? toggleMark(m)(state, dispatch) : false
      },
    }
  },

  addInputRules() {
    return [new InputRule(/(?:^|\s)\*([^*]+)\*$/, (state, match, start, end) => {
      const markType = state.schema.marks.italic
      if (!markType) return null
      const text = match[1]
      return state.tr.delete(start, end).insertText(text, start)
        .addMark(start, start + text.length, markType.create())
    })]
  },
})
