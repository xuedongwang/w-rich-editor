import { NodeExtension } from '../Extension'
import { convertBlockType } from '../utils/blockType.js'

export const Paragraph = NodeExtension.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  attrs: { align: { default: null } },
  toDOM(node) {
    const attrs = {}
    if (node.attrs.align) {
      attrs.style = `text-align: ${node.attrs.align}`
    }
    return ['p', attrs, 0]
  },
  parseDOM: [
    {
      tag: 'p',
      getAttrs: (dom) => {
        const align = dom.style?.textAlign
        if (['center', 'right', 'justify'].includes(align)) {
          return { align }
        }
        return {}
      },
    },
  ],
  addCommands() {
    return {
      setParagraph: () => (state, dispatch) => {
        const paragraphType = state.schema.nodes.paragraph
        if (!paragraphType) return false
        // 已经是段落且无特殊属性 → no-op 但仍返回 true
        if (state.selection.$from.parent.type === paragraphType) {
          const align = state.selection.$from.parent.attrs.align
          if (!align) return true
        }
        return convertBlockType(paragraphType, null, state, dispatch)
      },
    }
  },
})
