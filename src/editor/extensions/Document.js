import { NodeExtension } from '../Extension'

export const Document = NodeExtension.create({
  name: 'doc',
  content: 'block+',
})
