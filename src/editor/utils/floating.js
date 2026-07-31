/**
 * Shared floating UI utilities.
 *
 * All three interactive features (AI dropdown, block handle, empty-line menu)
 * need to show UI elements positioned relative to either a DOM rect or a
 * document position. This module centralizes:
 *   - Floating element creation + lifecycle
 *   - Smart viewport-aware positioning
 *   - Outside-click and Escape handling
 */

const FLOATING_Z_INDEX = 30

// ============================================================================
// createFloatingElement
// ============================================================================

/**
 * Create a floating DOM element positioned relative to an anchor.
 *
 * @param {HTMLElement} content - The DOM to display inside the floating element
 * @param {{ type: 'rect', rect: DOMRect } | { type: 'pos', view: EditorView, pos: number }} anchor
 * @param {object} [options]
 * @param {number} [options.zIndex] - Override default z-index
 * @param {'below' | 'above' | 'auto'} [options.placement] - Placement strategy
 * @param {number} [options.offset] - Gap between anchor and floating element (px)
 * @returns {{ el: HTMLElement, update(anchor: any): void, destroy(): void }}
 */
export function createFloatingElement(content, anchor, options = {}) {
  const { zIndex = FLOATING_Z_INDEX, placement = 'auto', offset = 4 } = options

  const el = document.createElement('div')
  el.className = 'w-floating-element'
  el.style.position = 'fixed'
  el.style.zIndex = String(zIndex)
  el.appendChild(content)
  document.body.appendChild(el)

  function positionAt(currentAnchor) {
    const rect = resolveAnchorRect(currentAnchor)
    if (!rect) return

    const elRect = el.getBoundingClientRect()
    // jsdom returns 0 for viewport dimensions — use reasonable defaults
    const viewportH = window.innerHeight || 768
    const viewportW = window.innerWidth || 1024

    // Vertical placement
    let top
    const preferredPlacement = placement === 'auto'
      ? (rect.top > viewportH / 2 ? 'above' : 'below')
      : placement

    if (preferredPlacement === 'above') {
      top = rect.top - elRect.height - offset
    } else {
      top = rect.bottom + offset
    }

    // Clamp to viewport
    top = Math.max(4, Math.min(top, viewportH - elRect.height - 4))

    // Horizontal placement: left-aligned by default, right-aligned if overflows
    let left = rect.left
    if (left + elRect.width > viewportW - 8) {
      left = Math.max(8, rect.right - elRect.width)
    }

    el.style.top = `${top}px`
    el.style.left = `${left}px`
  }

  function resolveAnchorRect(a) {
    if (!a) return null
    if (a.type === 'rect' && a.rect) return a.rect
    if (a.type === 'pos' && a.view && typeof a.pos === 'number') {
      const coords = a.view.coordsAtPos(a.pos)
      if (!coords) return null
      // coordsAtPos returns { top, bottom, left, right } — build a DOMRect-like object
      return new DOMRect(coords.left, coords.top, coords.right - coords.left, coords.bottom - coords.top)
    }
    if (a instanceof DOMRect || (a && typeof a.top === 'number' && typeof a.bottom === 'number')) {
      return a
    }
    return null
  }

  positionAt(anchor)

  return {
    el,
    update(newAnchor) {
      positionAt(newAnchor)
    },
    destroy() {
      if (el.parentNode) el.parentNode.removeChild(el)
    },
  }
}

// ============================================================================
// onOutsideClick
// ============================================================================

/**
 * Listen for clicks outside the given element. Calls callback when a click
 * occurs on document that is not inside `element`.
 *
 * @param {HTMLElement} element
 * @param {(event: MouseEvent) => void} callback
 * @returns {() => void} Cleanup function
 */
export function onOutsideClick(element, callback) {
  const handler = (event) => {
    if (!element.contains(event.target)) {
      callback(event)
    }
  }
  // Use a timeout so the click that opened the element doesn't immediately close it
  setTimeout(() => {
    document.addEventListener('mousedown', handler, true)
  }, 0)
  return () => {
    document.removeEventListener('mousedown', handler, true)
  }
}

// ============================================================================
// onEscape
// ============================================================================

/**
 * Listen for the Escape key. Calls callback when Escape is pressed.
 *
 * @param {(event: KeyboardEvent) => void} callback
 * @returns {() => void} Cleanup function
 */
export function onEscape(callback) {
  const handler = (event) => {
    if (event.key === 'Escape') {
      callback(event)
    }
  }
  document.addEventListener('keydown', handler, true)
  return () => {
    document.removeEventListener('keydown', handler, true)
  }
}

// ============================================================================
// getPositionAtCursor (helper for empty-line menu)
// ============================================================================

/**
 * Get the bounding rect of the cursor caret at the current selection.
 * Returns null if the selection is not collapsed.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @returns {DOMRect | null}
 */
export function getCaretRect(view) {
  const { selection } = view.state
  if (!selection.empty) return null

  const coords = view.coordsAtPos(selection.from)
  if (!coords) return null
  return new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top)
}

// ============================================================================
// getSelectionRect (helper for AI dropdown)
// ============================================================================

/**
 * Get the bounding rect of the current text selection.
 * Returns null if the selection is collapsed or not a TextSelection.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @returns {DOMRect | null}
 */
export function getSelectionRect(view) {
  const { selection } = view.state
  if (selection.empty) return null
  if (selection.constructor.name !== 'TextSelection' && !selection.from) return null

  try {
    const startCoords = view.coordsAtPos(selection.from)
    const endCoords = view.coordsAtPos(selection.to)
    if (!startCoords || !endCoords) return null

    // Union of the two coords
    const top = Math.min(startCoords.top, endCoords.top)
    const bottom = Math.max(startCoords.bottom, endCoords.bottom)
    const left = Math.min(startCoords.left, endCoords.left)
    const right = Math.max(startCoords.right, endCoords.right)

    return new DOMRect(left, top, right - left, bottom - top)
  } catch {
    // jsdom doesn't support layout — coordsAtPos throws.
    return null
  }
}

// ============================================================================
// getBlockRect (helper for block handle)
// ============================================================================

/**
 * Get the bounding rect of the block node containing the given position.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @param {number} pos - A position inside the block
 * @returns {{ rect: DOMRect, node: HTMLElement } | null}
 */
export function getBlockRect(view, pos) {
  const { state } = view
  const $pos = state.doc.resolve(pos)

  // Walk up to find the top-level block (depth 1 for doc children)
  let targetDepth = 1
  // But if we're inside a nested block (like list_item), use that depth's block
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d)
    if (node.type.spec.group && node.type.spec.group.split(' ').includes('block')) {
      targetDepth = d
      break
    }
  }

  const dom = view.nodeDOM($pos.before(targetDepth))
  if (!dom || !(dom instanceof HTMLElement)) return null

  return {
    rect: dom.getBoundingClientRect(),
    node: dom,
  }
}
