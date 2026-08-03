import 'prosemirror-view/style/prosemirror.css'
import 'prismjs/themes/prism-tomorrow.css'
import './editor/style.css'
import './editor/content.css'
import './editor/extensions/image-upload.css'
import './editor/extensions/ai-assistant.css'
import './editor/extensions/block-handle.css'
import './editor/extensions/empty-line-menu.css'
import './editor/extensions/ai-input.css'
import './style.css'
import { Editor } from './editor/index.js'
import {
  Document, Paragraph, Heading,
  BulletList, OrderedList, ListItem,
  TaskList, TaskItem,
  Blockquote, CodeBlock, Divider,
  Bold, Italic, Code,
  History, DropCursorExt, TextAlign, MarkdownPaste,
  Image, ImageUpload,
  EmptyLineMenu, BlockHandle, AIAssistant, AIInput,
} from './editor/index.js'

// ============================================================================
// DOM references & helpers
// ============================================================================

const editorEl = document.getElementById('editor')
const toolbar = document.getElementById('toolbar')

function updateToolbarState(ed) {
  if (!toolbar) return
  toolbar.querySelectorAll('[data-command]').forEach((btn) => {
    const cmd = btn.dataset.command
    const attrStr = btn.dataset.attrs
    const attrs = attrStr ? JSON.parse(attrStr) : undefined
    btn.classList.toggle('active', ed.isActive(cmd, attrs))
  })
}

function updateBlockSelect(ed) {
  const select = document.getElementById('block-type-select')
  const langSel = document.getElementById('code-lang-select')
  if (!select) return
  const { $from } = ed.state.selection
  const type = $from.parent.type.name

  // Show/hide code language selector
  if (langSel) {
    if (type === 'code_block') {
      langSel.style.display = ''
      langSel.value = $from.parent.attrs.language || ''
    } else {
      langSel.style.display = 'none'
    }
  }

  if (type === 'heading') {
    select.value = `heading-${$from.parent.attrs.level}`
  } else if (type === 'bullet_list' || (type === 'list_item' && $from.node($from.depth - 1)?.type.name === 'bullet_list')) {
    select.value = 'bullet-list'
  } else if (type === 'ordered_list' || (type === 'list_item' && $from.node($from.depth - 1)?.type.name === 'ordered_list')) {
    select.value = 'ordered-list'
  } else if (type === 'task_list' || (type === 'task_item')) {
    select.value = 'task-list'
  } else if (type === 'blockquote') {
    select.value = 'blockquote'
  } else if (type === 'code_block') {
    select.value = 'code-block'
  } else {
    select.value = 'paragraph'
  }
}

function updateAlignSelect(ed) {
  const select = document.getElementById('align-select')
  if (!select) return
  const { $from } = ed.state.selection
  const align = $from.parent.attrs?.align || 'left'
  select.value = align
}

// ============================================================================
// Create Editor
// ============================================================================

// AI API key — read from URL query param or prompt
const urlParams = new URLSearchParams(window.location.search)
let aiApiKey = urlParams.get('ai-key') || localStorage.getItem('w-editor-ai-key') || ''
if (!aiApiKey && typeof prompt === 'function') {
  // Prompt once on first load (skip if in test env)
  try {
    const stored = localStorage.getItem('w-editor-ai-skip-prompt')
    if (!stored && window.confirm('配置 DeepSeek API key 以启用 AI 功能？\n\n（取消或留空则跳过）')) {
      const key = prompt('请输入 DeepSeek API Key:')
      if (key) {
        aiApiKey = key
        localStorage.setItem('w-editor-ai-key', key)
      }
      localStorage.setItem('w-editor-ai-skip-prompt', '1')
    }
  } catch {
    // localStorage/prompt not available (e.g., in test env)
  }
}

const editor = new Editor({
  target: editorEl,
  content: `
    <h1>w-rich-editor</h1>
    <p>基于 <strong>ProseMirror</strong> 的 <em>Notion 风格</em> Block 富文本编辑器</p>
    <h2>功能演示</h2>
    <ul>
      <li><p>加粗、斜体、行内代码</p></li>
      <li><p>标题（H1-H6）</p></li>
      <li><p>有序列表 &amp; 无序列表 &amp; 任务列表</p></li>
      <li><p>引用块、代码块、分割线</p></li>
      <li><p>🪄 空行菜单（点击空段落查看）</p></li>
      <li><p>⋮⋮ 块拖拽手柄（悬停块左侧查看）</p></li>
      <li><p>✨ AI 辅助写作（选中文本后查看）</p></li>
    </ul>
    <blockquote><p>试试输入 <code>#</code>、<code>-</code>、<code>- [ ]</code>、<code>&gt;</code>、<code>\`\`\`</code> 等 Markdown 快捷语法</p></blockquote>
    <p></p>
    <p>使用上方工具栏或快捷键 <code>Mod+B</code>、<code>Mod+I</code> 来格式化文本。</p>
    <h2>代码高亮示例</h2>
    <pre><code class="language-javascript">function fibonacci(n) {
  if (n &lt;= 1) return n
  return fibonacci(n - 1) + fibonacci(n - 2)
}

const result = fibonacci(10)
console.log("Result: " + result) // 55</code></pre>
  `,
  autofocus: 'end',
  extensions: [
    Document.resolve(),
    Paragraph.resolve(),
    Heading.resolve(),
    BulletList.resolve(),
    OrderedList.resolve(),
    ListItem.resolve(),
    TaskList.resolve(),
    TaskItem.resolve(),
    Blockquote.resolve(),
    CodeBlock.resolve(),
    Divider.resolve(),
    Bold.resolve(),
    Italic.resolve(),
    Code.resolve(),
    History.resolve(),
    DropCursorExt.resolve(),
    TextAlign.resolve(),
    Image.resolve(),
    ImageUpload.configure({
      useBase64: true,
    }),
    MarkdownPaste.resolve(),
    EmptyLineMenu.resolve(),
    BlockHandle.resolve(),
    AIAssistant.configure({
      apiKey: aiApiKey,
    }),
    AIInput.resolve(),
  ],
  onUpdate({ editor }) {
    updateToolbarState(editor)
    updateBlockSelect(editor)
    updateAlignSelect(editor)
  },
  onSelectionUpdate({ editor }) {
    updateToolbarState(editor)
    updateBlockSelect(editor)
    updateAlignSelect(editor)
  },
})

// ============================================================================
// Toolbar Buttons
// ============================================================================

function btn(label, command, attrs, title) {
  const el = document.createElement('button')
  el.textContent = label
  el.dataset.command = command
  if (attrs) el.dataset.attrs = JSON.stringify(attrs)
  if (title) el.title = title
  el.addEventListener('mousedown', (e) => {
    e.preventDefault()
    editor.commands[command]?.(attrs)
    editor.view.focus()
  })
  return el
}

function divider() {
  const el = document.createElement('span')
  el.className = 'toolbar-divider'
  return el
}

// Block type dropdown
const blockSelect = document.createElement('select')
blockSelect.id = 'block-type-select'
blockSelect.innerHTML = `
  <option value="paragraph">段落</option>
  <option value="heading-1">标题 1</option>
  <option value="heading-2">标题 2</option>
  <option value="heading-3">标题 3</option>
  <option value="heading-4">标题 4</option>
  <option value="heading-5">标题 5</option>
  <option value="heading-6">标题 6</option>
  <option value="bullet-list">无序列表</option>
  <option value="ordered-list">有序列表</option>
  <option value="task-list">任务列表</option>
  <option value="blockquote">引用</option>
  <option value="code-block">代码块</option>
`
blockSelect.addEventListener('change', () => {
  const val = blockSelect.value
  const map = {
    'paragraph': () => editor.commands.toggleHeading?.({ level: 1 }),
    'heading-1': () => editor.commands.toggleHeading?.({ level: 1 }),
    'heading-2': () => editor.commands.toggleHeading?.({ level: 2 }),
    'heading-3': () => editor.commands.toggleHeading?.({ level: 3 }),
    'heading-4': () => editor.commands.toggleHeading?.({ level: 4 }),
    'heading-5': () => editor.commands.toggleHeading?.({ level: 5 }),
    'heading-6': () => editor.commands.toggleHeading?.({ level: 6 }),
    'bullet-list': () => editor.commands.toggleBulletList?.(),
    'ordered-list': () => editor.commands.toggleOrderedList?.(),
    'task-list': () => editor.commands.toggleTaskList?.(),
    'blockquote': () => editor.commands.toggleBlockquote?.(),
    'code-block': () => editor.commands.toggleCodeBlock?.(),
  }
  map[val]?.()
  editor.view.focus()
})
toolbar.appendChild(blockSelect)
toolbar.appendChild(divider())

// Text alignment dropdown
const alignSelect = document.createElement('select')
alignSelect.id = 'align-select'
alignSelect.innerHTML = `
  <option value="left">左对齐</option>
  <option value="center">居中</option>
  <option value="right">右对齐</option>
  <option value="justify">两端对齐</option>
`
alignSelect.addEventListener('change', () => {
  editor.commands.setTextAlign?.({ align: alignSelect.value })
  editor.view.focus()
})
toolbar.appendChild(alignSelect)
toolbar.appendChild(divider())

// Inline marks
toolbar.appendChild(btn('B', 'toggleBold', null, '加粗 Mod+B'))
toolbar.appendChild(btn('I', 'toggleItalic', null, '斜体 Mod+I'))
toolbar.appendChild(btn('<>', 'toggleCode', null, '行内代码 Mod+`'))
toolbar.appendChild(divider())

// Code block language selector (only visible when cursor is in a code block)
const langSelect = document.createElement('select')
langSelect.id = 'code-lang-select'
langSelect.className = 'code-lang-select'
langSelect.style.display = 'none'
langSelect.innerHTML = `
  <option value="">plain text</option>
  <option value="javascript">JavaScript</option>
  <option value="typescript">TypeScript</option>
  <option value="jsx">JSX</option>
  <option value="tsx">TSX</option>
  <option value="python">Python</option>
  <option value="java">Java</option>
  <option value="c">C</option>
  <option value="cpp">C++</option>
  <option value="csharp">C#</option>
  <option value="go">Go</option>
  <option value="rust">Rust</option>
  <option value="ruby">Ruby</option>
  <option value="php">PHP</option>
  <option value="swift">Swift</option>
  <option value="kotlin">Kotlin</option>
  <option value="php">PHP</option>
  <option value="html">HTML</option>
  <option value="css">CSS</option>
  <option value="scss">SCSS</option>
  <option value="json">JSON</option>
  <option value="yaml">YAML</option>
  <option value="sql">SQL</option>
  <option value="bash">Bash</option>
  <option value="markdown">Markdown</option>
  <option value="docker">Docker</option>
  <option value="diff">Diff</option>
  <option value="regex">Regex</option>
`
langSelect.addEventListener('mousedown', (e) => e.stopPropagation())
langSelect.addEventListener('change', () => {
  editor.commands.setCodeBlockLanguage?.({ language: langSelect.value })
  editor.view.focus()
})
toolbar.appendChild(langSelect)

// History
toolbar.appendChild(btn('↩', 'undo', null, '撤销 Mod+Z'))
toolbar.appendChild(btn('↪', 'redo', null, '重做 Mod+Y'))
toolbar.appendChild(divider())

// Insert
toolbar.appendChild(btn('—', 'insertDivider', null, '分割线'))

// ============================================================================
// Status Bar — word count
// ============================================================================

const statusEl = document.getElementById('status-bar')

function updateStatus() {
  const text = editor.getText()
  const chars = text.length
  const charsNoSpace = text.replace(/\s/g, '').length
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  statusEl.textContent = `字数: ${words}  |  字符: ${chars} (不含空格: ${charsNoSpace})`
}

editor.view.dom.addEventListener('input', updateStatus)
setInterval(updateStatus, 1000)
updateStatus()

// Initial state
updateToolbarState(editor)
updateBlockSelect(editor)
