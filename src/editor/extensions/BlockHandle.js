import { Extension } from '../Extension.js'
import { Plugin } from 'prosemirror-state'
import { getBlockRect } from '../utils/floating.js'
import { gripIcon } from '../utils/icons.js'

// ============================================================================
// Handle DOM builder
// ============================================================================

function buildHandleDOM({ onDragStart, onDragEnd }) {
  const handle = document.createElement('div')
  handle.className = 'block-handle'
  handle.contentEditable = 'false'
  handle.setAttribute('role', 'button')
  handle.setAttribute('aria-label', 'Drag to reorder')

  // Inline defaults — CSS stylesheet overrides these when loaded
  handle.style.position = 'fixed'
  handle.style.opacity = '0'
  handle.style.pointerEvents = 'none'
  handle.style.zIndex = '20'
  handle.style.cursor = 'grab'

  // Lucide grip icon
  handle.appendChild(gripIcon())

  handle.addEventListener('mouseenter', () => {
    clearTimeout(hideTimeout)
    handle.style.opacity = '1'
  })

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    handle.classList.add('is-dragging-source')
    onDragStart(e)
  })

  return handle
}

// ============================================================================
// Block discovery helper
// ============================================================================

/**
 * Find the draggable block at the given mouse coordinates.
 * Returns { pos, depth, node, rect, dom } or null.
 *
 * If the cursor is inside a list_item or task_item, that item is returned
 * as the draggable unit (enabling per-item drag). Otherwise, falls back to
 * the top-level block (depth 1).
 */
function findBlockAtCoords(view, clientX, clientY) {
  let posInfo
  try {
    posInfo = view.posAtCoords({ left: clientX, top: clientY })
  } catch {
    // jsdom doesn't support elementFromPoint — return null
    return null
  }
  if (!posInfo || posInfo.pos == null) return null

  const { state } = view
  let pos = posInfo.pos
  // Clamp to doc range
  if (pos > state.doc.content.size) pos = state.doc.content.size
  const $pos = state.doc.resolve(pos)

  if ($pos.depth < 1) return null

  // Check if we're inside a list_item / task_item — if so, use that item
  // as the draggable unit instead of the entire list wrapper.
  const listItemType = state.schema.nodes.list_item
  const taskItemType = state.schema.nodes.task_item

  for (let d = $pos.depth; d > 1; d--) {
    const node = $pos.node(d)
    if (node.type === listItemType || node.type === taskItemType) {
      const dom = view.nodeDOM($pos.before(d))
      if (!dom || !(dom instanceof HTMLElement)) return null
      return {
        pos: $pos.before(d),
        depth: d,
        node,
        rect: dom.getBoundingClientRect(),
        dom,
      }
    }
  }

  // Fallback: top-level block (depth 1)
  const blockDepth = 1
  const blockPos = $pos.before(blockDepth)
  const blockNode = $pos.node(blockDepth)

  // Skip if it's not actually a block node
  const group = blockNode.type.spec.group
  if (!group || !group.split(' ').includes('block')) return null

  // List blocks as a whole are not draggable — only individual items are
  if (['bullet_list', 'ordered_list', 'task_list'].includes(blockNode.type.name)) return null

  const dom = view.nodeDOM(blockPos)
  if (!dom || !(dom instanceof HTMLElement)) return null

  return {
    pos: blockPos,
    depth: blockDepth,
    node: blockNode,
    rect: dom.getBoundingClientRect(),
    dom,
  }
}

// ============================================================================
// Extension
// ============================================================================

export const BlockHandle = Extension.create({
  name: 'blockHandle',

  addProseMirrorPlugins() {
    const ext = this
    const options = this.options || {}
    const enabled = options.enabled !== false

    return [
      new Plugin({
        view(editorView) {
          if (!enabled) return {}

          const handle = buildHandleDOM({
            onDragStart: (event) => startDrag(editorView, ext, event),
            onDragEnd: () => endDrag(editorView, ext),
          })
          document.body.appendChild(handle)
          ext._handle = handle

          return {
            update(view) {
              syncHandlePosition(view, ext)
            },
            destroy() {
              cleanupDrag(ext)
              if (handle.parentNode) handle.parentNode.removeChild(handle)
              ext._handle = null
            },
          }
        },
        props: {
          handleDOMEvents: {
            mousemove: (view, event) => {
              if (!ext._handle) return false
              if (ext._dragging) return false
              updateHandleVisibility(view, ext, event)
              return false
            },
            mouseleave: (view, event) => {
              if (!ext._handle) return false
              if (ext._dragging) return false
              // Don't hide if mouse moved to the handle itself
              if (event.relatedTarget && ext._handle.contains(event.relatedTarget)) {
                return false
              }
              scheduleHide(ext)
              return false
            },
          },
        },
      }),
    ]
  },
})

// ============================================================================
// Handle visibility + positioning
// ============================================================================

let hideTimeout = null

function updateHandleVisibility(view, ext, event) {
  // If mouse is over the handle itself, keep it visible
  if (ext._handle && ext._handle.contains(event.target)) {
    clearTimeout(hideTimeout)
    return
  }

  const block = findBlockAtCoords(view, event.clientX, event.clientY)
  if (!block || !ext._handle) {
    // Check if mouse is in the "approach zone" between handle and current block
    // This prevents the handle from disappearing when the mouse crosses the gap
    if (isInApproachZone(ext, event)) {
      clearTimeout(hideTimeout)
      // Re-show handle in case the handle's own mouseleave hid it
      ext._handle.style.opacity = '1'
      ext._handle.style.pointerEvents = 'auto'
      return
    }
    scheduleHide(ext)
    return
  }

  // Don't show handle for empty paragraphs (let empty-line menu take over)
  if (block.node.type.name === 'paragraph' && block.node.content.size === 0) {
    scheduleHide(ext)
    return
  }

  clearTimeout(hideTimeout)
  positionHandleAtBlock(ext, block)
  ext._currentBlock = block
}

/**
 * Check if the mouse is in the "approach zone" between the handle and the
 * current block. This prevents the handle from disappearing when the mouse
 * crosses the gap between the handle and the block edge.
 */
function isInApproachZone(ext, event) {
  if (!ext._handle || !ext._currentBlock) return false
  const handleRect = ext._handle.getBoundingClientRect()
  const blockRect = ext._currentBlock.rect

  // Mouse is in approach zone if:
  // - Y is within handle's vertical range (with small tolerance)
  // - X is between handle's right edge and block's left edge (the gap)
  const yTolerance = 4
  const inYRange = event.clientY >= handleRect.top - yTolerance &&
                   event.clientY <= handleRect.bottom + yTolerance
  const inXRange = event.clientX >= handleRect.right &&
                   event.clientX <= blockRect.left

  return inYRange && inXRange
}

function positionHandleAtBlock(ext, block) {
  if (!ext._handle) return
  const handle = ext._handle

  // For list items, use the parent list element's left edge so that the
  // handle aligns horizontally with top-level block handles.
  let leftEdge = block.rect.left
  if (['list_item', 'task_item'].includes(block.node.type.name)) {
    const listEl = block.dom.closest('ul, ol')
    if (listEl) {
      leftEdge = listEl.getBoundingClientRect().left
    }
  }

  const left = leftEdge - 28
  const top = block.rect.top + 2

  handle.style.position = 'fixed'
  handle.style.left = `${left}px`
  handle.style.top = `${top}px`
  handle.style.opacity = '1'
  handle.style.pointerEvents = 'auto'
  handle.style.zIndex = '20'
}

function scheduleHide(ext) {
  clearTimeout(hideTimeout)
  hideTimeout = setTimeout(() => {
    if (!ext._handle) return
    ext._handle.style.opacity = '0'
    ext._handle.style.pointerEvents = 'none'
  }, 300)
}

function syncHandlePosition(view, ext) {
  // After doc/selection changes, hide the handle if current block no longer valid
  if (!ext._handle || !ext._currentBlock) return
  const { state } = view
  const block = ext._currentBlock
  // Re-verify block still exists
  if (block.pos >= state.doc.content.size) {
    ext._handle.style.opacity = '0'
    ext._currentBlock = null
  }
}

// ============================================================================
// Drag-and-drop
// ============================================================================

let dropIndicator = null

/**
 * Return true if the given node is a list_item or task_item.
 */
function isListItem(node, state) {
  const listItemType = state.schema.nodes.list_item
  const taskItemType = state.schema.nodes.task_item
  return (listItemType && node.type === listItemType) ||
         (taskItemType && node.type === taskItemType)
}

/**
 * Find the nearest ancestor list node (bullet_list, ordered_list, or
 * task_list) containing the given position. Returns { pos, node } or null.
 */
function findParentList(state, pos) {
  if (pos > state.doc.content.size) pos = state.doc.content.size
  const $pos = state.doc.resolve(pos)
  const listTypeNames = ['bullet_list', 'ordered_list', 'task_list']
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d)
    if (listTypeNames.includes(node.type.name)) {
      return { pos: $pos.before(d), node }
    }
  }
  return null
}

/**
 * Determine the list type for a new wrapper list when dragging a list item
 * out of its parent list. Preserves the source list's type (bullet/ordered/task),
 * defaulting to bullet_list.
 */
function getListType(sourceList, state) {
  if (sourceList && sourceList.node) {
    const t = sourceList.node.type
    if (t === state.schema.nodes.ordered_list) return t
    if (t === state.schema.nodes.task_list) return t
  }
  return state.schema.nodes.bullet_list
}

function startDrag(view, ext, event) {
  if (!ext._currentBlock) return

  const { state } = view
  const block = ext._currentBlock
  if (block.pos >= state.doc.content.size) return
  const node = state.doc.nodeAt(block.pos)
  if (!node) return

  ext._dragging = {
    sourcePos: block.pos,
    sourceNode: node,
    sourceDOM: block.dom,
    sourceRect: block.rect,
  }

  // Style source as ghost
  block.dom.classList.add('is-dragging')
  ext._handle.style.cursor = 'grabbing'

  // Create drop indicator
  dropIndicator = document.createElement('div')
  dropIndicator.className = 'block-drop-indicator'
  document.body.appendChild(dropIndicator)

  const onMouseMove = (e) => {
    e.preventDefault()
    const targetBlock = findBlockAtCoords(view, e.clientX, e.clientY)
    if (targetBlock && targetBlock.pos !== ext._dragging.sourcePos) {
      // Show indicator above/below target block based on mouse Y position
      const midY = targetBlock.rect.top + targetBlock.rect.height / 2
      const indicatorY = e.clientY < midY ? targetBlock.rect.top - 1 : targetBlock.rect.bottom + 1
      dropIndicator.style.position = 'fixed'
      dropIndicator.style.left = `${targetBlock.rect.left}px`
      dropIndicator.style.top = `${indicatorY}px`
      dropIndicator.style.width = `${targetBlock.rect.width}px`
      dropIndicator.style.opacity = '1'
      ext._dragging.targetPos = targetBlock.pos
      ext._dragging.insertBefore = e.clientY < midY
    } else {
      dropIndicator.style.opacity = '0'
      ext._dragging.targetPos = null
    }
  }

  const onMouseUp = (e) => {
    e.preventDefault()
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    finishDrag(view, ext)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function finishDrag(view, ext) {
  if (!ext._dragging) return

  const { sourcePos, sourceNode, targetPos, insertBefore } = ext._dragging

  // Apply the move
  if (targetPos != null && targetPos !== sourcePos) {
    const { state, dispatch } = view
    const sourceIsListItem = isListItem(sourceNode, state)

    // Determine source list context
    const sourceList = sourceIsListItem ? findParentList(state, sourcePos) : null
    const targetList = findParentList(state, targetPos)
    const sameList = sourceList && targetList && sourceList.pos === targetList.pos

    // Determine what to delete and what to insert
    let deleteFrom = sourcePos
    let deleteTo = sourcePos + sourceNode.nodeSize
    let insertNode = sourceNode

    if (sourceIsListItem && !sameList) {
      // Dropping outside the source list → wrap item in a new single-item list
      const listType = getListType(sourceList, state)
      insertNode = listType.create(null, sourceNode)

      // If this is the only item in the list, delete the entire (now-empty) list
      if (sourceList && sourceList.node.childCount === 1) {
        deleteFrom = sourceList.pos
        deleteTo = sourceList.pos + sourceList.node.nodeSize
      }
    }

    // Calculate insertion position (before or after target).
    // insertPos is in the PRE-delete coordinate system — tr.mapping.map()
    // will convert it to the post-delete system, so no manual adjustment needed.
    let insertPos = targetPos
    if (!insertBefore) {
      insertPos = targetPos + state.doc.nodeAt(targetPos).nodeSize
    }

    let tr = state.tr
    tr = tr.delete(deleteFrom, deleteTo)
    const mappedPos = tr.mapping.map(insertPos)
    tr = tr.insert(mappedPos, insertNode)
    dispatch(tr)
  }

  endDrag(view, ext)
}

function endDrag(view, ext) {
  if (!ext._dragging) return
  const { sourceDOM } = ext._dragging
  if (sourceDOM) sourceDOM.classList.remove('is-dragging')
  ext._dragging = null
  if (ext._handle) {
    ext._handle.style.cursor = 'grab'
  }
  cleanupDropIndicator()
}

function cleanupDrag(ext) {
  if (ext._dragging) {
    if (ext._dragging.sourceDOM) {
      ext._dragging.sourceDOM.classList.remove('is-dragging')
    }
    ext._dragging = null
  }
  cleanupDropIndicator()
}

function cleanupDropIndicator() {
  if (dropIndicator) {
    if (dropIndicator.parentNode) dropIndicator.parentNode.removeChild(dropIndicator)
    dropIndicator = null
  }
}
