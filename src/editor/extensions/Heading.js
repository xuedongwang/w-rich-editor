import { NodeExtension } from '../Extension'
import { textblockTypeInputRule } from 'prosemirror-inputrules'

export const Heading = NodeExtension.create({
  name: 'heading',
  group: 'block',
  content: 'inline*',
  defining: true,
  attrs: { level: { default: 1 } },
  toDOM(node) {
    return [`h${node.attrs.level}`, 0]
  },
  parseDOM: [
    { tag: 'h1', attrs: { level: 1 } },
    { tag: 'h2', attrs: { level: 2 } },
    { tag: 'h3', attrs: { level: 3 } },
    { tag: 'h4', attrs: { level: 4 } },
    { tag: 'h5', attrs: { level: 5 } },
    { tag: 'h6', attrs: { level: 6 } },
  ],

  addCommands() {
    return {
      toggleHeading: (attrs) => (state, dispatch) => {
        const headingType = state.schema.nodes.heading
        const paragraphType = state.schema.nodes.paragraph
        if (!headingType || !paragraphType) return false
        const { $from } = state.selection
        if ($from.parent.type === headingType && $from.parent.attrs.level === attrs.level) {
          if (dispatch) dispatch(state.tr.setNodeMarkup($from.before(), paragraphType))
        } else {
          if (dispatch) dispatch(state.tr.setNodeMarkup($from.before(), headingType, attrs))
        }
        return true
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Alt-1': (state, dispatch) => {
        const headingType = state.schema.nodes.heading
        if (!headingType) return false
        const { $from } = state.selection
        if (dispatch) dispatch(state.tr.setNodeMarkup($from.before(), headingType, { level: 1 }))
        return true
      },
      'Mod-Alt-2': (state, dispatch) => {
        const headingType = state.schema.nodes.heading
        if (!headingType) return false
        const { $from } = state.selection
        if (dispatch) dispatch(state.tr.setNodeMarkup($from.before(), headingType, { level: 2 }))
        return true
      },
      'Mod-Alt-3': (state, dispatch) => {
        const headingType = state.schema.nodes.heading
        if (!headingType) return false
        const { $from } = state.selection
        if (dispatch) dispatch(state.tr.setNodeMarkup($from.before(), headingType, { level: 3 }))
        return true
      },
    }
  },

  addInputRules() {
    return [
      textblockTypeInputRule(/^#\s$/, this.editor.schema.nodes.heading, () => ({ level: 1 })),
      textblockTypeInputRule(/^##\s$/, this.editor.schema.nodes.heading, () => ({ level: 2 })),
      textblockTypeInputRule(/^###\s$/, this.editor.schema.nodes.heading, () => ({ level: 3 })),
    ]
  },
})
