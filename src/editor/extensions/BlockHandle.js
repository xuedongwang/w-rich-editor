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
    handle.style.opacity = '1'
  })

  handle.addEventListener('mouseleave', () => {
    if (!handle.classList.contains('is-dragging-source')) {
      handle.style.opacity = ''
    }
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
 * Find the top-level (outermost) block position at the given mouse coordinates.
 * Returns { pos, node, rect, dom } or null.
 *
 * Only outermost blocks (direct children of the document) qualify — nested
 * blocks inside lists, blockquotes, etc. don't get individual handles.
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

  // Walk up to depth 1 (doc's direct children only)
  if ($pos.depth < 1) return null

  const blockDepth = 1
  const blockPos = $pos.before(blockDepth)
  const blockNode = $pos.node(blockDepth)

  // Skip if it's not actually a block node
  const group = blockNode.type.spec.group
  if (!group || !group.split(' ').includes('block')) return null

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
            mouseleave: (view) => {
              if (!ext._handle) return false
              if (ext._dragging) return false
              ext._handle.style.opacity = '0'
              ext._handle.style.pointerEvents = 'none'
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

function positionHandleAtBlock(ext, block) {
  if (!ext._handle) return
  const handle = ext._handle

  // Position handle to the LEFT of the block
  const left = block.rect.left - 28
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
    let tr = state.tr

    // Calculate insertion position (after removing source)
    let insertPos = targetPos
    if (!insertBefore) {
      insertPos = targetPos + state.doc.nodeAt(targetPos).nodeSize
    }
    // If target was after source, adjust for removal
    if (targetPos > sourcePos) {
      insertPos -= sourceNode.nodeSize
    }

    tr = tr.delete(sourcePos, sourcePos + sourceNode.nodeSize)
    // Re-resolve insertion point after delete
    const mappedPos = tr.mapping.map(insertPos)
    tr = tr.insert(mappedPos, sourceNode)
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
