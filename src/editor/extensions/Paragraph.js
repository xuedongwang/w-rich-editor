import { NodeExtension } from '../Extension'

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
})
