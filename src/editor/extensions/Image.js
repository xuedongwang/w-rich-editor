import { NodeExtension } from '../Extension'
import { TextSelection } from 'prosemirror-state'

const MIN_WIDTH = 50

// ============================================================================
// Helpers
// ============================================================================

/** Extract filename from a URL/src string */
export function getImageFilename(src) {
  if (!src) return null
  try {
    const url = new URL(src, 'http://x')
    const path = url.pathname
    const name = path.split('/').pop()
    return name && name !== '' ? decodeURIComponent(name) : null
  } catch {
    return null
  }
}

/** Count image nodes in a document */
export function countImages(doc) {
  let count = 0
  doc.descendants(node => { if (node.type.name === 'image') count++ })
  return count
}

/** Get the editor's content width (used as max image width) */
export function getEditorWidth(view) {
  const el = view.dom.closest('.w-rich-editor') || view.dom
  return el?.clientWidth || 800
}

/** Load image natural dimensions from src URL */
export function loadDimensions(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return }
    const img = document.createElement('img')
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// ============================================================================
// NodeView
// ============================================================================

class ImageView {
  constructor(node, view, getPos) {
    this.node = node
    this.view = view
    this.getPos = getPos
    this._captionFocused = false
    this._resizing = false
    this._naturalApplied = false

    // DOM structure
    this.wrapper = document.createElement('div')
    this.wrapper.className = 'image-wrapper'

    this.img = document.createElement('img')
    this.img.className = 'editor-image'

    this.loadingOverlay = document.createElement('div')
    this.loadingOverlay.className = 'image-loading-overlay'
    this.loadingOverlay.innerHTML = '<div class="image-loading-spinner"></div>'

    this.errorOverlay = document.createElement('div')
    this.errorOverlay.className = 'image-error-overlay'

    this.caption = document.createElement('div')
    this.caption.className = 'image-caption'
    this.caption.contentEditable = 'true'
    this.caption.dataset.placeholder = '添加图片说明...'
    this.caption.spellcheck = false

    this.resizeHandle = document.createElement('div')
    this.resizeHandle.className = 'image-resize-handle'
    this.resizeHandle.title = '拖拽调整大小'

    this.wrapper.append(
      this.img, this.loadingOverlay, this.errorOverlay,
      this.resizeHandle, this.caption,
    )
    this.dom = this.wrapper

    this._bindCaptionEvents()
    this._bindResizeEvents()
    this.update(node)
  }

  // — Caption events —

  _bindCaptionEvents() {
    this.caption.addEventListener('focus', () => { this._captionFocused = true })

    this.caption.addEventListener('blur', () => {
      this._captionFocused = false
      this._commitCaption()
    })

    this.caption.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey

      // Enter → commit, exit caption, insert new paragraph below
      if (e.key === 'Enter') {
        e.preventDefault()
        this._commitCaption()
        this._exitToParagraph()
        return
      }

      // Ctrl/Cmd+A → select all text within caption only
      if (mod && e.key === 'a') {
        e.preventDefault()
        const range = document.createRange()
        range.selectNodeContents(this.caption)
        const sel = window.getSelection()
        sel.removeAllRanges()
        sel.addRange(range)
        return
      }

      // All other keys (Backspace, Delete, arrows, typing, etc.)
      // are handled natively by contenteditable.
      // Stop propagation so ProseMirror keymaps don't interfere.
      e.stopPropagation()
    })
  }

  _commitCaption() {
    const pos = this.getPos()
    if (pos == null) return
    const text = this.caption.textContent || ''
    const currentNode = this.view.state.doc.nodeAt(pos)
    if (!currentNode || currentNode.type.name !== 'image') return
    if (currentNode.attrs.caption === text) return

    this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, null, {
      ...currentNode.attrs,
      caption: text || null,
    }))
  }

  /** Insert a paragraph after the image and move cursor into it. */
  _exitToParagraph() {
    const pos = this.getPos()
    if (pos == null) return
    const currentNode = this.view.state.doc.nodeAt(pos)
    if (!currentNode) return

    const paragraphType = this.view.state.schema.nodes.paragraph
    if (!paragraphType) return

    const insertPos = pos + currentNode.nodeSize
    const newPara = paragraphType.create()
    const tr = this.view.state.tr.insert(insertPos, newPara)
    tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1)))
    this.view.dispatch(tr)
    this.view.focus()
  }

  // — Resize events —

  _bindResizeEvents() {
    this.resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this._startResize(e.clientX)
    })
  }

  _startResize(startX) {
    this._resizing = true
    this._startX = startX
    this._startWidth = this.img.offsetWidth || this.img.naturalWidth || 200
    this.wrapper.classList.add('is-resizing')

    this._resizeOverlay = document.createElement('div')
    this._resizeOverlay.className = 'image-resize-overlay'
    this.wrapper.appendChild(this._resizeOverlay)

    this._onMouseMove = (e) => this._doResize(e.clientX)
    this._onMouseUp = () => this._endResize()

    document.addEventListener('mousemove', this._onMouseMove)
    document.addEventListener('mouseup', this._onMouseUp)
  }

  _doResize(clientX) {
    if (!this._resizing) return
    const diff = clientX - this._startX
    const newWidth = Math.max(MIN_WIDTH, Math.round(this._startWidth + diff))
    this.img.style.width = newWidth + 'px'
  }

  _endResize() {
    if (!this._resizing) return
    this._resizing = false
    this.wrapper.classList.remove('is-resizing')

    document.removeEventListener('mousemove', this._onMouseMove)
    document.removeEventListener('mouseup', this._onMouseUp)

    if (this._resizeOverlay) {
      this._resizeOverlay.remove()
      this._resizeOverlay = null
    }

    const newWidth = this.img.offsetWidth
    if (newWidth < MIN_WIDTH) return

    const pos = this.getPos()
    if (pos == null) return
    const currentNode = this.view.state.doc.nodeAt(pos)
    if (!currentNode || currentNode.type.name !== 'image') return
    if (currentNode.attrs.width === newWidth) return

    this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, null, {
      ...currentNode.attrs,
      width: newWidth,
    }))
  }

  // — ProseMirror NodeView interface —

  update(node) {
    this.node = node

    // Image src / alt / title
    this.img.src = node.attrs.src || ''
    this.img.alt = node.attrs.alt || ''
    this.img.title = node.attrs.title || ''

    // Width — don't override during resize
    if (!this._resizing) {
      if (node.attrs.width) {
        this.img.style.width = typeof node.attrs.width === 'number'
          ? node.attrs.width + 'px'
          : node.attrs.width
        this._naturalApplied = true
      } else if (!this._naturalApplied) {
        this.img.style.width = ''
      }
    }

    // Align class on wrapper
    this._setAlignClass(node.attrs.align)

    // Loading / error state
    this.wrapper.classList.toggle('is-uploading', !!node.attrs.uploading)
    this.wrapper.classList.toggle('has-error', !!node.attrs.uploadError)

    if (node.attrs.uploadError) {
      this.errorOverlay.innerHTML =
        `<span class="image-error-icon">⚠</span>` +
        `<span class="image-error-text">${node.attrs.errorMessage || '上传失败'}</span>`
    } else {
      this.errorOverlay.innerHTML = ''
    }

    // Caption — only update text when not focused
    const captionAlign = node.attrs.captionAlign || 'center'
    this.caption.style.textAlign = captionAlign
    this.caption.dataset.align = captionAlign

    const captionText = node.attrs.caption || ''
    this.caption.title = captionText  // tooltip shows full content when truncated

    if (!this._captionFocused) {
      if (this.caption.textContent !== captionText) {
        this.caption.textContent = captionText
      }
    }
  }

  _setAlignClass(align) {
    this.wrapper.classList.remove('align-left', 'align-center', 'align-right')
    if (align && align !== 'center') {
      this.wrapper.classList.add(`align-${align}`)
    }
  }

  stopEvent(e) {
    if (this.caption.contains(e.target)) return true
    if (this.resizeHandle.contains(e.target)) return true
    return false
  }

  ignoreMutation() { return true }

  destroy() {
    if (this._resizing) {
      document.removeEventListener('mousemove', this._onMouseMove)
      document.removeEventListener('mouseup', this._onMouseUp)
    }
  }
}

// ============================================================================
// Extension
// ============================================================================

export const Image = NodeExtension.create({
  name: 'image',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  attrs: {
    src: { default: null },
    alt: { default: null },
    title: { default: null },
    width: { default: null },
    height: { default: null },
    align: { default: null },
    uploading: { default: false },
    uploadError: { default: false },
    errorMessage: { default: null },
    caption: { default: null },
    captionAlign: { default: 'center' },
  },

  toDOM(node) {
    const imgAttrs = {
      src: node.attrs.src,
      alt: node.attrs.alt,
      title: node.attrs.title,
      class: 'editor-image',
    }
    if (node.attrs.width) imgAttrs.width = node.attrs.width

    const wrapperClass = 'image-wrapper' +
      (node.attrs.uploading ? ' is-uploading' : '') +
      (node.attrs.uploadError ? ' has-error' : '') +
      (node.attrs.align && node.attrs.align !== 'center' ? ` align-${node.attrs.align}` : '')

    const captionAlign = node.attrs.captionAlign || 'center'
    const captionText = node.attrs.caption || ''

    const children = [
      ['img', imgAttrs],
      ['div', { class: 'image-loading-overlay' },
        ['div', { class: 'image-loading-spinner' }],
      ],
      ['div', { class: 'image-error-overlay' },
        ['span', { class: 'image-error-icon' }, '⚠'],
        ['span', { class: 'image-error-text' }, node.attrs.errorMessage || '上传失败'],
      ],
    ]

    if (captionText) {
      children.push(['div', {
        class: 'image-caption',
        style: `text-align: ${captionAlign}`,
      }, captionText])
    }

    return ['div', {
      class: wrapperClass,
      'data-uploading': node.attrs.uploading || undefined,
      'data-align': node.attrs.align || 'center',
    }, ...children]
  },

  parseDOM: [{
    tag: 'img[src]',
    getAttrs: (dom) => {
      const attrs = {
        src: dom.getAttribute('src'),
        alt: dom.getAttribute('alt'),
        title: dom.getAttribute('title'),
      }
      const wrapper = dom.parentElement
      if (wrapper) {
        const captionEl = wrapper.querySelector('.image-caption')
        if (captionEl) {
          attrs.caption = captionEl.textContent || null
          const align = captionEl.style?.textAlign || captionEl.getAttribute('data-align')
          if (align) attrs.captionAlign = align
        }
        const dataAlign = wrapper.getAttribute('data-align')
        if (dataAlign) attrs.align = dataAlign
      }
      return attrs
    },
  }],

  addCommands() {
    return {
      insertImage: (attrs) => (state, dispatch, view) => {
        const imageType = state.schema.nodes.image
        if (!imageType || !attrs?.src) return false

        const filename = getImageFilename(attrs.src)
        const imageCount = countImages(state.doc)
        const nodeAttrs = {
          ...attrs,
          alt: attrs.alt ?? filename,
          title: attrs.title ?? filename,
          caption: attrs.caption ?? `图${imageCount + 1}`,
        }

        const node = imageType.create(nodeAttrs)
        if (dispatch) {
          dispatch(state.tr.replaceSelectionWith(node))

          // Async: load natural dimensions → update width/height if not set
          const src = attrs.src
          ;(async () => {
            const dims = await loadDimensions(src)
            if (!dims) return

            // Re-read state (document may have changed during async wait)
            let curPos = null
            view.state.doc.descendants((n, p) => {
              if (curPos != null) return false
              if (n.type.name === 'image' && n.attrs.src === src) curPos = p
            })
            if (curPos == null) return

            const curNode = view.state.doc.nodeAt(curPos)
            if (!curNode || curNode.type.name !== 'image') return
            if (curNode.attrs.width != null) return

            const maxW = getEditorWidth(view)
            const w = Math.min(dims.width, maxW)
            const aspect = dims.height / dims.width
            const h = Math.round(w * aspect)

            view.dispatch(
              view.state.tr.setNodeMarkup(curPos, null, {
                ...curNode.attrs,
                width: w,
                height: h,
              }),
            )
          })()
        }
        return true
      },

      updateImage: (pos, attrs) => (state, dispatch) => {
        const node = state.doc.nodeAt(pos)
        if (!node || node.type.name !== 'image') return false
        if (dispatch) {
          dispatch(state.tr.setNodeMarkup(pos, null, { ...node.attrs, ...attrs }))
        }
        return true
      },

      removeImage: (pos) => (state, dispatch) => {
        const node = state.doc.nodeAt(pos)
        if (!node || node.type.name !== 'image') return false
        if (dispatch) dispatch(state.tr.delete(pos, pos + node.nodeSize))
        return true
      },

      setImageCaption: (pos, caption) => (state, dispatch) => {
        const node = state.doc.nodeAt(pos)
        if (!node || node.type.name !== 'image') return false
        if (dispatch) {
          dispatch(state.tr.setNodeMarkup(pos, null, {
            ...node.attrs, caption: caption || null,
          }))
        }
        return true
      },

      setImageCaptionAlign: (pos, align) => (state, dispatch) => {
        if (!['left', 'center', 'right'].includes(align)) return false
        const node = state.doc.nodeAt(pos)
        if (!node || node.type.name !== 'image') return false
        if (dispatch) {
          dispatch(state.tr.setNodeMarkup(pos, null, { ...node.attrs, captionAlign: align }))
        }
        return true
      },

      setImageAlign: (pos, align) => (state, dispatch) => {
        if (!['left', 'center', 'right'].includes(align)) return false
        const node = state.doc.nodeAt(pos)
        if (!node || node.type.name !== 'image') return false
        if (dispatch) {
          dispatch(state.tr.setNodeMarkup(pos, null, {
            ...node.attrs, align: align === 'center' ? null : align,
          }))
        }
        return true
      },

      setImageWidth: (pos, width) => (state, dispatch) => {
        const node = state.doc.nodeAt(pos)
        if (!node || node.type.name !== 'image') return false
        if (dispatch) {
          const w = width == null ? null : Math.max(MIN_WIDTH, Math.round(width))
          dispatch(state.tr.setNodeMarkup(pos, null, { ...node.attrs, width: w }))
        }
        return true
      },
    }
  },

  addNodeViews() {
    return {
      image: (node, view, getPos) => new ImageView(node, view, getPos),
    }
  },
})
