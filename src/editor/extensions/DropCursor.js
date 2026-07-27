import { Extension } from '../Extension'
import { dropCursor } from 'prosemirror-dropcursor'

export const DropCursorExt = Extension.create({
  name: 'dropCursor',

  addProseMirrorPlugins() {
    return [dropCursor({ color: '#6366f1', width: 2 })]
  },
})
