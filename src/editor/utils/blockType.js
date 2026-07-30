import { setBlockType as pmSetBlockType } from 'prosemirror-commands'

/**
 * Change the block type of the textblock at the cursor, lifting the content
 * out of restrictive ancestors (like blockquote which only allows paragraph+)
 * when the immediate parent doesn't allow the target node type.
 *
 * Returns a ProseMirror command result (true if operation succeeded, false if
 * already at target or not applicable).
 */
export function convertBlockType(targetType, targetAttrs, state, dispatch) {
  const { $from } = state.selection
  const parent = $from.parent

  if (!parent.isTextblock) return false

  // Already at target type+attrs → nothing to do
  if (parent.type === targetType && parent.hasMarkup(targetType, targetAttrs)) {
    return false
  }

  // Case 1: parent allows the target type → use ProseMirror's built-in command
  if (parent.canReplaceWith($from.index(), $from.indexAfter(), targetType)) {
    return pmSetBlockType(targetType, targetAttrs)(state, dispatch)
  }

  // Case 2: parent doesn't allow the target type.
  // Walk up ancestors to find the first whose content model accepts the target.
  let liftAncestorDepth = -1
  for (let d = $from.depth - 1; d >= 0; d--) {
    const ancestor = $from.node(d)
    const idx = $from.index(d)
    const idxAfter = $from.indexAfter(d)
    if (ancestor.canReplaceWith(idx, idxAfter, targetType)) {
      liftAncestorDepth = d
      break
    }
  }
  if (liftAncestorDepth < 0) return false

  if (dispatch) {
    const range = $from.blockRange()
    if (!range) return false
    let tr = state.tr.lift(range, liftAncestorDepth)
    // After lifting, re-resolve the cursor position in the new document.
    const new$from = tr.doc.resolve(tr.mapping.map($from.pos))
    const newRange = new$from.blockRange()
    if (!newRange) return false
    tr.setBlockType(newRange.start, newRange.end, targetType, targetAttrs)
    dispatch(tr)
  }
  return true
}
