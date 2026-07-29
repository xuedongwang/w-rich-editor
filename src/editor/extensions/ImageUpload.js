import { Extension } from '../Extension'
import { Plugin, PluginKey } from 'prosemirror-state'
import { countImages, loadDimensions, getEditorWidth } from './Image.js'

// ============================================================================
// Default options
// ============================================================================

const DEFAULT_ALLOWED_MIME = [
  'image/png', 'image/jpeg', 'image/gif',
  'image/webp', 'image/svg+xml', 'image/bmp',
]

const DEFAULT_OPTIONS = {
  allowedMimeTypes: DEFAULT_ALLOWED_MIME,

  // Upload — three modes (priority high → low):
  // 1. uploader: custom async function (most flexible)
  uploader: null,            // (file) => Promise<{ src, alt?, title? }>
  // 2. HTTP upload config
  uploadUrl: null,           // POST endpoint
  uploadHeaders: {},         // extra headers
  uploadFieldName: 'file',   // FormData field name
  // 3. base64 inline (fallback when neither uploader nor uploadUrl is set)
  useBase64: false,

  // Hook: transform file before upload (compression, watermark, etc.)
  // Return File/Blob to replace, or nothing to keep original.
  onBeforeUpload: null,      // (file) => Promise<File|Blob|void> | File|Blob|void

  // Callbacks
  onSuccess: null,           // (file, result) => void
  onError: null,             // (file, error) => void
}

// ============================================================================
// Upload helpers
// ============================================================================

export async function defaultUpload(file, url, headers, fieldName) {
  const formData = new FormData()
  formData.append(fieldName || 'file', file)
  const res = await fetch(url, { method: 'POST', headers, body: formData })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
  const data = await res.json()
  return { src: data.url || data.src, alt: data.alt, title: data.title }
}

export function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Failed to read file as base64'))
    reader.readAsDataURL(file)
  })
}

// ============================================================================
// Upload pipeline
// ============================================================================

export async function processImage(file, options) {
  let processed = file

  // Hook: let user transform the file (compress, watermark, etc.)
  if (options.onBeforeUpload) {
    const result = await options.onBeforeUpload(file)
    if (result instanceof File || result instanceof Blob) {
      processed = result
    }
  }

  // Upload — priority: uploader > uploadUrl > useBase64 > fallback object URL
  if (options.uploader) {
    return options.uploader(processed)
  }

  if (options.uploadUrl) {
    return defaultUpload(processed, options.uploadUrl, options.uploadHeaders, options.uploadFieldName)
  }

  if (options.useBase64) {
    const src = await toBase64(processed)
    return { src }
  }

  // Fallback: object URL (no upload)
  return { src: URL.createObjectURL(processed) }
}

// ============================================================================
// Insert image node with upload pipeline
// ============================================================================

async function insertImageNode(view, file, options, pos) {
  const imageType = view.state.schema.nodes.image
  if (!imageType) return null

  const filename = file.name || null
  const imageCount = countImages(view.state.doc)
  const maxW = getEditorWidth(view)

  // Create object URL for immediate preview
  const objectUrl = URL.createObjectURL(file)

  // Load natural dimensions immediately so placeholder matches final size
  const dims = await loadDimensions(objectUrl)
  const initialAttrs = {
    src: objectUrl,
    alt: filename,
    title: filename,
    caption: `图${imageCount + 1}`,
    uploading: true,
  }

  if (dims) {
    const w = Math.min(dims.width, maxW)
    const aspect = dims.height / dims.width
    initialAttrs.width = w
    initialAttrs.height = Math.round(w * aspect)
  }

  // Insert placeholder (already correctly sized)
  const node = imageType.create(initialAttrs)
  let tr
  if (pos != null) {
    tr = view.state.tr.insert(pos, node)
  } else {
    tr = view.state.tr.replaceSelectionWith(node)
  }
  view.dispatch(tr)

  // Find the inserted node's position
  const insertedPos = pos != null
    ? pos
    : findImageNodeAtPos(view.state.doc, objectUrl)

  if (insertedPos == null) return null

  // Async upload pipeline
  const objectUrlRef = objectUrl
  ;(async () => {
    try {
      const result = await processImage(file, options)
      URL.revokeObjectURL(objectUrlRef)

      const finalSrc = result.src || objectUrlRef
      const currentTr = view.state.tr
      const currentNode = view.state.doc.nodeAt(insertedPos)
      if (currentNode && currentNode.type.name === 'image') {
        currentTr.setNodeMarkup(insertedPos, null, {
          ...currentNode.attrs,
          src: finalSrc,
          alt: result.alt || currentNode.attrs.alt,
          title: result.title || currentNode.attrs.title,
          uploading: false,
          uploadError: false,
          errorMessage: null,
        })
        view.dispatch(currentTr)
      }

      options.onSuccess?.(file, result)
    } catch (err) {
      const currentTr = view.state.tr
      const currentNode = view.state.doc.nodeAt(insertedPos)
      if (currentNode && currentNode.type.name === 'image') {
        currentTr.setNodeMarkup(insertedPos, null, {
          ...currentNode.attrs,
          uploading: false,
          uploadError: true,
          errorMessage: err.message || '上传失败',
        })
        view.dispatch(currentTr)
      }

      options.onError?.(file, err)
    }
  })()

  return insertedPos
}

function findImageNodeAtPos(doc, src) {
  let found = null
  doc.descendants((node, pos) => {
    if (found != null) return false
    if (node.type.name === 'image' && node.attrs.src === src) {
      found = pos
      return false
    }
  })
  return found
}

// ============================================================================
// Extension
// ============================================================================

export const ImageUpload = Extension.create({
  name: 'imageUpload',

  addProseMirrorPlugins() {
    const ext = this
    let dragOriginInternal = false

    return [
      new Plugin({
        key: new PluginKey('imageUpload'),
        props: {
          // Track drag origin to distinguish internal drags from external file drops.
          // When dragging an <img> within the editor, the browser puts the image file
          // into dataTransfer.files — we must not treat that as a new file upload.
          handleDOMEvents: {
            dragstart() {
              dragOriginInternal = true
              return false
            },
          },

          handlePaste(view, event, slice) {
            const files = event.clipboardData?.files
            if (!files?.length) return false

            const options = { ...DEFAULT_OPTIONS, ...ext.options }
            const images = Array.from(files).filter(f =>
              options.allowedMimeTypes.includes(f.type),
            )
            if (!images.length) return false

            images.forEach(file => insertImageNode(view, file, options))
            return true
          },

          handleDrop(view, event, slice, moved) {
            if (moved) return false
            // Internal drag (from within the editor) — let ProseMirror handle it
            if (dragOriginInternal) {
              dragOriginInternal = false
              return false
            }

            const files = event.dataTransfer?.files
            if (!files?.length) return false

            const options = { ...DEFAULT_OPTIONS, ...ext.options }
            const images = Array.from(files).filter(f =>
              options.allowedMimeTypes.includes(f.type),
            )
            if (!images.length) return false

            const coords = { left: event.clientX, top: event.clientY }
            const posInfo = view.posAtCoords(coords)
            const pos = posInfo?.pos

            images.forEach(file => insertImageNode(view, file, options, pos))
            return true
          },
        },
      }),
    ]
  },
})
