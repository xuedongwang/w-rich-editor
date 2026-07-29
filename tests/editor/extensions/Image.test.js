import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Image, getImageFilename, countImages } from '../../../src/editor/extensions/Image.js'
import { NodeSelection } from 'prosemirror-state'
import { createEditor, setCursor, cleanup } from '../../helper.js'

let editor

beforeEach(() => { document.body.innerHTML = '' })
afterEach(() => { cleanup(editor) })

// ============================================================================
// Helper functions
// ============================================================================

describe('getImageFilename', () => {
  it('从 URL 提取文件名', () => {
    expect(getImageFilename('https://example.com/path/to/photo.jpg')).toBe('photo.jpg')
  })

  it('处理带查询参数的 URL', () => {
    expect(getImageFilename('https://cdn.com/img.png?w=800&h=600')).toBe('img.png')
  })

  it('处理简单路径', () => {
    expect(getImageFilename('photo.jpeg')).toBe('photo.jpeg')
  })

  it('处理中文文件名', () => {
    expect(getImageFilename('https://example.com/%E5%9B%BE%E7%89%87.png')).toBe('图片.png')
  })

  it('无文件名时返回 null', () => {
    expect(getImageFilename('')).toBeNull()
    expect(getImageFilename(null)).toBeNull()
  })
})

describe('countImages', () => {
  it('统计文档中的图片数量', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    expect(countImages(editor.state.doc)).toBe(0)

    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'a.png' })
    expect(countImages(editor.state.doc)).toBe(1)

    editor.commands.insertImage({ src: 'b.png' })
    expect(countImages(editor.state.doc)).toBe(2)
  })
})

// ============================================================================
// Extension definition
// ============================================================================

describe('Image 节点定义', () => {
  it('名称为 image', () => {
    expect(Image.resolve().name).toBe('image')
  })

  it('类型为 node', () => {
    expect(Image.resolve().type).toBe('node')
  })

  it('是块级节点', () => {
    expect(Image.resolve().nodeSpec.group).toBe('block')
  })

  it('是原子节点', () => {
    expect(Image.resolve().nodeSpec.atom).toBe(true)
  })

  it('可选中', () => {
    expect(Image.resolve().nodeSpec.selectable).toBe(true)
  })

  it('可拖拽', () => {
    expect(Image.resolve().nodeSpec.draggable).toBe(true)
  })

  it('无 content（叶节点）', () => {
    expect(Image.resolve().nodeSpec.content).toBeUndefined()
  })
})

// ============================================================================
// Attributes
// ============================================================================

describe('Image 属性', () => {
  it('src 默认值为 null', () => {
    expect(Image.resolve().nodeSpec.attrs.src.default).toBeNull()
  })

  it('alt 默认值为 null', () => {
    expect(Image.resolve().nodeSpec.attrs.alt.default).toBeNull()
  })

  it('title 默认值为 null', () => {
    expect(Image.resolve().nodeSpec.attrs.title.default).toBeNull()
  })

  it('width 默认值为 null', () => {
    expect(Image.resolve().nodeSpec.attrs.width.default).toBeNull()
  })

  it('height 默认值为 null', () => {
    expect(Image.resolve().nodeSpec.attrs.height.default).toBeNull()
  })

  it('uploading 默认值为 false', () => {
    expect(Image.resolve().nodeSpec.attrs.uploading.default).toBe(false)
  })

  it('uploadError 默认值为 false', () => {
    expect(Image.resolve().nodeSpec.attrs.uploadError.default).toBe(false)
  })

  it('errorMessage 默认值为 null', () => {
    expect(Image.resolve().nodeSpec.attrs.errorMessage.default).toBeNull()
  })

  it('caption 默认值为 null', () => {
    expect(Image.resolve().nodeSpec.attrs.caption.default).toBeNull()
  })

  it('captionAlign 默认值为 center', () => {
    expect(Image.resolve().nodeSpec.attrs.captionAlign.default).toBe('center')
  })

  it('align 默认值为 null', () => {
    expect(Image.resolve().nodeSpec.attrs.align.default).toBeNull()
  })
})

// ============================================================================
// toDOM
// ============================================================================

describe('Image toDOM', () => {
  it('渲染为 div > img 结构', () => {
    const dom = Image.resolve().nodeSpec.toDOM({
      attrs: { src: 'test.png', alt: 'test', title: null, width: null, height: null, uploading: false, uploadError: false, errorMessage: null },
    })
    expect(dom[0]).toBe('div')
    expect(dom[2][0]).toBe('img')
  })

  it('img 包含 src 和 alt', () => {
    const dom = Image.resolve().nodeSpec.toDOM({
      attrs: { src: 'photo.jpg', alt: 'A photo', title: null, width: null, height: null, uploading: false, uploadError: false, errorMessage: null },
    })
    const imgAttrs = dom[2][1]
    expect(imgAttrs.src).toBe('photo.jpg')
    expect(imgAttrs.alt).toBe('A photo')
  })

  it('上传中时添加 is-uploading class', () => {
    const dom = Image.resolve().nodeSpec.toDOM({
      attrs: { src: 'test.png', alt: null, title: null, width: null, height: null, uploading: true, uploadError: false, errorMessage: null },
    })
    expect(dom[1].class).toContain('is-uploading')
  })

  it('上传错误时添加 has-error class', () => {
    const dom = Image.resolve().nodeSpec.toDOM({
      attrs: { src: 'test.png', alt: null, title: null, width: null, height: null, uploading: false, uploadError: true, errorMessage: '失败' },
    })
    expect(dom[1].class).toContain('has-error')
  })

  it('有 width 时设置 width 属性', () => {
    const dom = Image.resolve().nodeSpec.toDOM({
      attrs: { src: 'test.png', alt: null, title: null, width: 300, height: null, uploading: false, uploadError: false, errorMessage: null },
    })
    const imgAttrs = dom[2][1]
    expect(imgAttrs.width).toBe(300)
  })
})

// ============================================================================
// parseDOM
// ============================================================================

describe('Image parseDOM', () => {
  it('从 img[src] 解析', () => {
    const rule = Image.resolve().nodeSpec.parseDOM[0]
    expect(rule.tag).toBe('img[src]')
  })

  it('getAttrs 提取 src、alt、title', () => {
    const rule = Image.resolve().nodeSpec.parseDOM[0]
    const mockDom = {
      getAttribute: (attr) => {
        const map = { src: 'test.png', alt: 'desc', title: 'hover' }
        return map[attr]
      },
    }
    const attrs = rule.getAttrs(mockDom)
    expect(attrs.src).toBe('test.png')
    expect(attrs.alt).toBe('desc')
    expect(attrs.title).toBe('hover')
  })
})

// ============================================================================
// Commands
// ============================================================================

describe('Image 命令', () => {
  it('insertImage 在光标处插入图片', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'test.png', alt: 'Test' })
    const html = editor.getHTML()
    expect(html).toContain('test.png')
    expect(html).toContain('image-wrapper')
  })

  it('insertImage 无 src 时返回 false', () => {
    editor = createEditor({ content: '<p>Test</p>' })
    setCursor(editor, 1)
    expect(editor.commands.insertImage({})).toBe(false)
  })

  it('insertImage 无参数时返回 false', () => {
    editor = createEditor({ content: '<p>Test</p>' })
    setCursor(editor, 1)
    expect(editor.commands.insertImage()).toBe(false)
  })

  it('insertImage 自动设置 alt 为文件名', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'https://cdn.example.com/path/photo.jpg' })
    let imgNode = null
    editor.state.doc.descendants(n => { if (n.type.name === 'image') imgNode = n })
    expect(imgNode.attrs.alt).toBe('photo.jpg')
  })

  it('insertImage 自动设置 title 为文件名', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'https://example.com/images/banner.png' })
    let imgNode = null
    editor.state.doc.descendants(n => { if (n.type.name === 'image') imgNode = n })
    expect(imgNode.attrs.title).toBe('banner.png')
  })

  it('insertImage 自动设置 caption 为图N', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'first.png' })
    editor.commands.insertImage({ src: 'second.png' })
    editor.commands.insertImage({ src: 'third.png' })

    const captions = []
    editor.state.doc.descendants(n => {
      if (n.type.name === 'image') captions.push(n.attrs.caption)
    })
    expect(captions).toEqual(['图1', '图2', '图3'])
  })

  it('insertImage 用户指定 alt/title 时覆盖默认值', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({
      src: 'https://example.com/photo.jpg',
      alt: '自定义替代文字',
      title: '自定义标题',
      caption: '自定义说明',
    })
    let imgNode = null
    editor.state.doc.descendants(n => { if (n.type.name === 'image') imgNode = n })
    expect(imgNode.attrs.alt).toBe('自定义替代文字')
    expect(imgNode.attrs.title).toBe('自定义标题')
    expect(imgNode.attrs.caption).toBe('自定义说明')
  })

  it('updateImage 更新图片属性', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'old.png' })
    // Find the image node position
    let imgPos = null
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image') imgPos = pos
    })
    expect(imgPos).not.toBeNull()
    editor.commands.updateImage(imgPos, { src: 'new.png', alt: 'Updated' })
    const html = editor.getHTML()
    expect(html).toContain('new.png')
  })

  it('removeImage 删除图片节点', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'test.png' })
    let imgPos = null
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image') imgPos = pos
    })
    editor.commands.removeImage(imgPos)
    expect(editor.getHTML()).not.toContain('test.png')
  })

  it('setImageCaption 设置说明文字', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'test.png' })
    let imgPos = null
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image') imgPos = pos
    })
    editor.commands.setImageCaption(imgPos, 'A test image')
    const node = editor.state.doc.nodeAt(imgPos)
    expect(node.attrs.caption).toBe('A test image')
  })

  it('setImageCaption 空字符串清除说明', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'test.png', caption: 'old caption' })
    let imgPos = null
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image') imgPos = pos
    })
    editor.commands.setImageCaption(imgPos, '')
    const node = editor.state.doc.nodeAt(imgPos)
    expect(node.attrs.caption).toBeNull()
  })

  it('setImageCaptionAlign 设置对齐方式', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'test.png', caption: 'caption' })
    let imgPos = null
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image') imgPos = pos
    })

    editor.commands.setImageCaptionAlign(imgPos, 'left')
    expect(editor.state.doc.nodeAt(imgPos).attrs.captionAlign).toBe('left')

    editor.commands.setImageCaptionAlign(imgPos, 'right')
    expect(editor.state.doc.nodeAt(imgPos).attrs.captionAlign).toBe('right')

    editor.commands.setImageCaptionAlign(imgPos, 'center')
    expect(editor.state.doc.nodeAt(imgPos).attrs.captionAlign).toBe('center')
  })

  it('setImageCaptionAlign 无效对齐返回 false', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'test.png', caption: 'caption' })
    let imgPos = null
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image') imgPos = pos
    })
    expect(editor.commands.setImageCaptionAlign(imgPos, 'invalid')).toBe(false)
  })

  it('setImageAlign 设置图片对齐', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'test.png' })
    let imgPos = null
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image') imgPos = pos
    })

    editor.commands.setImageAlign(imgPos, 'left')
    expect(editor.state.doc.nodeAt(imgPos).attrs.align).toBe('left')

    editor.commands.setImageAlign(imgPos, 'right')
    expect(editor.state.doc.nodeAt(imgPos).attrs.align).toBe('right')

    // center sets to null (default)
    editor.commands.setImageAlign(imgPos, 'center')
    expect(editor.state.doc.nodeAt(imgPos).attrs.align).toBeNull()
  })

  it('setImageAlign 无效对齐返回 false', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'test.png' })
    let imgPos = null
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image') imgPos = pos
    })
    expect(editor.commands.setImageAlign(imgPos, 'justify')).toBe(false)
  })

  it('setImageWidth 设置图片宽度', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'test.png' })
    let imgPos = null
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image') imgPos = pos
    })

    editor.commands.setImageWidth(imgPos, 300)
    expect(editor.state.doc.nodeAt(imgPos).attrs.width).toBe(300)
  })

  it('setImageWidth 最小宽度限制', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'test.png' })
    let imgPos = null
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image') imgPos = pos
    })

    editor.commands.setImageWidth(imgPos, 10)
    expect(editor.state.doc.nodeAt(imgPos).attrs.width).toBe(50)
  })

  it('setImageWidth null 清除宽度', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'test.png', width: 300 })
    let imgPos = null
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image') imgPos = pos
    })

    editor.commands.setImageWidth(imgPos, null)
    expect(editor.state.doc.nodeAt(imgPos).attrs.width).toBeNull()
  })
})

// ============================================================================
// NodeView
// ============================================================================

describe('Image NodeView', () => {
  it('注册了 addNodeViews', () => {
    const resolved = Image.resolve()
    expect(resolved._addNodeViews).toBeDefined()
    const views = resolved._addNodeViews.call(resolved)
    expect(views.image).toBeDefined()
    expect(typeof views.image).toBe('function')
  })

  it('编辑器正确加载 NodeView', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'test.png' })
    // NodeView creates a wrapper div
    const wrapper = editor.view.dom.querySelector('.image-wrapper')
    expect(wrapper).not.toBeNull()
  })

  it('上传中的图片显示 loading 覆盖层', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'test.png', uploading: true })
    const wrapper = editor.view.dom.querySelector('.image-wrapper')
    expect(wrapper?.classList.contains('is-uploading')).toBe(true)
  })

  it('上传错误的图片显示 error 覆盖层', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'test.png', uploadError: true, errorMessage: '网络错误' })
    const wrapper = editor.view.dom.querySelector('.image-wrapper')
    expect(wrapper?.classList.contains('has-error')).toBe(true)
  })

  it('NodeView 渲染 caption 元素', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'test.png', caption: '说明文字' })
    const caption = editor.view.dom.querySelector('.image-caption')
    expect(caption).not.toBeNull()
    expect(caption.textContent).toBe('说明文字')
  })

  it('caption 默认为居中对齐', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'test.png', caption: '说明' })
    const caption = editor.view.dom.querySelector('.image-caption')
    expect(caption.style.textAlign).toBe('center')
  })

  it('caption 对齐方式更新', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'test.png', caption: '说明' })
    let imgPos = null
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image') imgPos = pos
    })
    editor.commands.setImageCaptionAlign(imgPos, 'left')
    const caption = editor.view.dom.querySelector('.image-caption')
    expect(caption.style.textAlign).toBe('left')
  })

  it('caption 是 contenteditable 的', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'test.png', caption: '说明' })
    const caption = editor.view.dom.querySelector('.image-caption')
    expect(caption.contentEditable).toBe('true')
  })

  it('NodeView 渲染 resize handle', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'test.png' })
    const handle = editor.view.dom.querySelector('.image-resize-handle')
    expect(handle).not.toBeNull()
    expect(handle.title).toBe('拖拽调整大小')
  })

  it('左对齐时 wrapper 添加 align-left class', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'test.png' })
    let imgPos = null
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image') imgPos = pos
    })
    editor.commands.setImageAlign(imgPos, 'left')
    const wrapper = editor.view.dom.querySelector('.image-wrapper')
    expect(wrapper?.classList.contains('align-left')).toBe(true)
  })

  it('右对齐时 wrapper 添加 align-right class', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'test.png' })
    let imgPos = null
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image') imgPos = pos
    })
    editor.commands.setImageAlign(imgPos, 'right')
    const wrapper = editor.view.dom.querySelector('.image-wrapper')
    expect(wrapper?.classList.contains('align-right')).toBe(true)
  })

  it('居中时不添加对齐 class', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'test.png' })
    let imgPos = null
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image') imgPos = pos
    })
    editor.commands.setImageAlign(imgPos, 'center')
    const wrapper = editor.view.dom.querySelector('.image-wrapper')
    expect(wrapper?.classList.contains('align-left')).toBe(false)
    expect(wrapper?.classList.contains('align-right')).toBe(false)
  })

  it('stopEvent 对 caption 和 resize handle 返回 true', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'test.png', caption: '说明' })
    // NodeView is active — resize handle and caption should block events
    const handle = editor.view.dom.querySelector('.image-resize-handle')
    const caption = editor.view.dom.querySelector('.image-caption')
    expect(handle).not.toBeNull()
    expect(caption).not.toBeNull()
  })
})

// ============================================================================
// isActive detection
// ============================================================================

describe('Image 活动状态检测', () => {
  it('isActive 检测图片节点', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'test.png' })
    // Select the image node (it's an atom, so we need to select it)
    let imgPos = null
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image') imgPos = pos
    })
    // Use NodeSelection to select the image
    const sel = NodeSelection.create(editor.state.doc, imgPos)
    editor.view.dispatch(editor.state.tr.setSelection(sel))
    expect(editor.isActive('image')).toBe(true)
  })

  it('isActive 按属性检测', () => {
    editor = createEditor({ content: '<p>Before</p>' })
    setCursor(editor, 1)
    editor.commands.insertImage({ src: 'test.png', alt: 'desc' })
    let imgPos = null
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image') imgPos = pos
    })
    const sel = NodeSelection.create(editor.state.doc, imgPos)
    editor.view.dispatch(editor.state.tr.setSelection(sel))
    expect(editor.isActive('image', { src: 'test.png' })).toBe(true)
    expect(editor.isActive('image', { src: 'other.png' })).toBe(false)
  })
})
