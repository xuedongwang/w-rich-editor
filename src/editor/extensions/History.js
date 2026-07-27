import { Extension } from '../Extension'
import { history, undo, redo } from 'prosemirror-history'

export const History = Extension.create({
  name: 'history',

  addCommands() {
    return {
      undo: () => (state, dispatch) => undo(state, dispatch),
      redo: () => (state, dispatch) => redo(state, dispatch),
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-z': (state, dispatch) => undo(state, dispatch),
      'Mod-y': (state, dispatch) => redo(state, dispatch),
      'Mod-Shift-z': (state, dispatch) => redo(state, dispatch),
    }
  },

  addProseMirrorPlugins() {
    return [history()]
  },
})
