import { NodeExtension } from '../Extension'

export const Paragraph = NodeExtension.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  toDOM: () => ['p', 0],
  parseDOM: [{ tag: 'p' }],
})
