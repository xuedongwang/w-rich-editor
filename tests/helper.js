import { TextSelection } from 'prosemirror-state'
import { Editor } from '../src/editor/Editor.js'
import {
  Document, Paragraph, Heading,
  BulletList, OrderedList, ListItem,
  Blockquote, CodeBlock, Divider,
  Bold, Italic, Code,
  History, DropCursorExt,
} from '../src/editor/index.js'

export const DEFAULT_EXTENSIONS = [
  Document.resolve(),
  Paragraph.resolve(),
  Heading.resolve(),
  BulletList.resolve(),
  OrderedList.resolve(),
  ListItem.resolve(),
  Blockquote.resolve(),
  CodeBlock.resolve(),
  Divider.resolve(),
  Bold.resolve(),
  Italic.resolve(),
  Code.resolve(),
  History.resolve(),
  DropCursorExt.resolve(),
]

export function createEditor(opts = {}) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const editor = new Editor({
    target,
    extensions: DEFAULT_EXTENSIONS,
    ...opts,
  })
  return editor
}

export function setCursor(editor, pos) {
  const sel = TextSelection.create(editor.state.doc, pos, pos)
  editor.view.dispatch(editor.state.tr.setSelection(sel))
}

export function selectRange(editor, from, to) {
  const sel = TextSelection.create(editor.state.doc, from, to)
  editor.view.dispatch(editor.state.tr.setSelection(sel))
}

export function cleanup(editor) {
  if (editor) editor.destroy()
  document.body.innerHTML = ''
}
