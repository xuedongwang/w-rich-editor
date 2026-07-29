import { Extension } from '../Extension'

const VALID_ALIGNS = ['left', 'center', 'right', 'justify']

function setBlockAttr(state, dispatch, attr, value) {
  const { from, to } = state.selection
  const applicable = []

  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return true
    if (node.attrs[attr] === value) return
    applicable.push({ node, pos })
  })

  if (applicable.length === 0) return false

  if (dispatch) {
    // IMPORTANT: must use a single transaction — state.tr creates a new one each access
    let tr = state.tr
    for (const { node, pos } of applicable) {
      tr = tr.setNodeMarkup(pos, null, { ...node.attrs, [attr]: value })
    }
    dispatch(tr)
  }

  return true
}

export const TextAlign = Extension.create({
  name: 'textAlign',

  addCommands() {
    return {
      setTextAlign: (attrs) => (state, dispatch) => {
        const align = attrs?.align
        if (!VALID_ALIGNS.includes(align)) return false
        return setBlockAttr(state, dispatch, 'align', align === 'left' ? null : align)
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-l': (state, dispatch) => setBlockAttr(state, dispatch, 'align', null),
      'Mod-Shift-e': (state, dispatch) => setBlockAttr(state, dispatch, 'align', 'center'),
      'Mod-Shift-r': (state, dispatch) => setBlockAttr(state, dispatch, 'align', 'right'),
      'Mod-Shift-j': (state, dispatch) => setBlockAttr(state, dispatch, 'align', 'justify'),
    }
  },
})
