import { NodeExtension } from '../Extension'
import { InputRule } from 'prosemirror-inputrules'
import { TextSelection } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { Plugin, PluginKey } from 'prosemirror-state'
import { convertBlockType } from '../utils/blockType.js'
import Prism from 'prismjs'

// Import common languages (total ~40KB gzipped)
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-scss'
import 'prismjs/components/prism-less'
import 'prismjs/components/prism-markup'   // HTML/XML (base for PHP etc.)
import 'prismjs/components/prism-markup-templating' // Required by PHP, Twig, etc.
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-c'
import 'prismjs/components/prism-cpp'
import 'prismjs/components/prism-csharp'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-ruby'
import 'prismjs/components/prism-php'
import 'prismjs/components/prism-swift'
import 'prismjs/components/prism-kotlin'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-shell-session'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-toml'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-graphql'
import 'prismjs/components/prism-docker'
import 'prismjs/components/prism-nginx'
import 'prismjs/components/prism-diff'
import 'prismjs/components/prism-regex'

/**
 * Resolve language identifier to a Prism grammar key.
 * Supports common aliases.
 */
function resolveLanguage(lang) {
  if (!lang) return ''
  const aliases = {
    js: 'javascript', ts: 'typescript', py: 'python',
    rb: 'ruby', rs: 'rust', sh: 'bash', yml: 'yaml',
    md: 'markdown', html: 'markup', xml: 'markup',
    svg: 'markup', cpp: 'cpp', c: 'c',
    'c++': 'cpp', 'c#': 'csharp', cs: 'csharp',
    dockerfile: 'docker', shell: 'bash',
  }
  const resolved = aliases[lang.toLowerCase()] || lang.toLowerCase()
  return Prism.languages[resolved] ? resolved : ''
}

// ============================================================================
// Sync gutter DOM elements (called via rAF after each state change)
// ============================================================================

function syncGutters(view) {
  const pres = view.dom.querySelectorAll('pre.code-block')
  if (!pres.length) return

  let docIdx = 0
  view.state.doc.descendants(node => {
    if (node.type.name !== 'code_block') return
    const pre = pres[docIdx++]
    if (!pre || !pre._codeBlockView) return
    pre._codeBlockView._syncLineNumbers(node)
  })
}

// ============================================================================
// Syntax highlighting decorations
// ============================================================================

const codeBlockHighlightKey = new PluginKey('codeBlockHighlight')

function buildDecorations(state) {
  const decorations = []
  const codeBlockType = state.schema.nodes.code_block
  if (!codeBlockType) return DecorationSet.empty

  state.doc.descendants((node, pos) => {
    if (node.type !== codeBlockType) return

    const contentStart = pos + 1
    const text = node.textContent

    // Syntax highlighting only — line numbers handled by NodeView gutter
    if (text) {
      const lang = resolveLanguage(node.attrs.language)
      if (lang && Prism.languages[lang]) {
        const tokens = Prism.tokenize(text, Prism.languages[lang])

        function walk(tokens, textOffset) {
          let cursor = textOffset
          for (const token of tokens) {
            if (typeof token === 'string') {
              cursor += token.length
            } else {
              const tokenText = typeof token.content === 'string'
                ? token.content
                : token.content.join('')
              const from = contentStart + cursor
              const to = from + tokenText.length
              decorations.push(Decoration.inline(from, to, { class: `token ${token.type}` }))
              cursor += tokenText.length
              if (Array.isArray(token.content)) {
                walk(token.content, cursor - tokenText.length)
              }
            }
          }
          return cursor
        }

        walk(tokens, 0)
      }
    }
  })

  return DecorationSet.create(state.doc, decorations)
}

// ============================================================================
// Language display names
// ============================================================================

const LANGUAGE_NAMES = {
  javascript: 'JavaScript', typescript: 'TypeScript', jsx: 'JSX', tsx: 'TSX',
  css: 'CSS', scss: 'SCSS', less: 'Less',
  html: 'HTML', xml: 'XML', svg: 'SVG',
  json: 'JSON', python: 'Python', java: 'Java',
  c: 'C', cpp: 'C++', csharp: 'C#', go: 'Go',
  rust: 'Rust', ruby: 'Ruby', php: 'PHP',
  swift: 'Swift', kotlin: 'Kotlin', bash: 'Bash',
  yaml: 'YAML', toml: 'TOML', markdown: 'Markdown',
  sql: 'SQL', graphql: 'GraphQL', docker: 'Docker',
  nginx: 'Nginx', diff: 'Diff', regex: 'Regex',
}

function getLanguageLabel(lang) {
  if (!lang) return 'Plain Text'
  return LANGUAGE_NAMES[lang.toLowerCase()] || lang
}

// ============================================================================
// NodeView — Copy button + language label
// ============================================================================

class CodeBlockView {
  constructor(node, view, getPos) {
    this.node = node
    this.view = view
    this.getPos = getPos

    // Outer wrapper
    this.wrapper = document.createElement('div')
    this.wrapper.className = 'code-block-wrapper'

    // Language header bar (contains label + copy button)
    this.header = document.createElement('div')
    this.header.className = 'code-lang-label'

    // Language text label
    this.langText = document.createElement('span')
    this.langText.className = 'code-lang-text'

    // Copy button (inside header)
    this.copyBtn = document.createElement('button')
    this.copyBtn.className = 'code-copy-btn'
    this.copyBtn.type = 'button'
    this.copyBtn.title = '复制代码'
    this.copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'

    this.copyBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this._copyCode()
    })

    this.header.append(this.langText, this.copyBtn)

    // Content area — ProseMirror manages this element
    this.pre = document.createElement('pre')
    this.pre.className = 'code-block line-numbers'
    this.pre.spellcheck = false

    // Line numbers gutter (PrismJS style — separate from editable content)
    this.lineNumbersRows = document.createElement('span')
    this.lineNumbersRows.className = 'line-numbers-rows'
    this.lineNumbersRows.setAttribute('aria-hidden', 'true')

    this.code = document.createElement('code')
    this.code.className = node.attrs.language ? `language-${node.attrs.language}` : ''
    this.code.spellcheck = false
    this.pre.append(this.lineNumbersRows, this.code)

    // contentDOM must be <code>, not <pre>, so ProseMirror doesn't clear the gutter
    this.contentDOM = this.code
    this.pre._codeBlockView = this
    this.wrapper.append(this.header, this.pre)
    this.dom = this.wrapper

    this._syncLabel(node)
    this._syncLineNumbers(node)
  }

  _syncLabel(node) {
    const lang = node.attrs.language || ''
    this.langText.textContent = getLanguageLabel(lang)
  }

  _syncLineNumbers(node) {
    const text = node.textContent
    const lineCount = text ? (text.match(/\n/g) || []).length + 1 : 1
    const currentCount = this.lineNumbersRows.children.length

    if (currentCount !== lineCount) {
      this.lineNumbersRows.innerHTML = ''
      for (let i = 0; i < lineCount; i++) {
        this.lineNumbersRows.appendChild(document.createElement('span'))
      }
    }

    // Support custom start line
    const lineStart = node.attrs.lineStart || 1
    if (lineStart !== 1) {
      this.pre.style.counterReset = `linenumber ${lineStart - 1}`
    } else {
      this.pre.style.counterReset = ''
    }
  }

  async _copyCode() {
    const text = this.node.textContent
    try {
      await navigator.clipboard.writeText(text)
      this.copyBtn.classList.add('copied')
      setTimeout(() => this.copyBtn.classList.remove('copied'), 1500)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      this.copyBtn.classList.add('copied')
      setTimeout(() => this.copyBtn.classList.remove('copied'), 1500)
    }
  }

  update(node) {
    if (node.type !== this.node.type) return false
    const contentChanged = node.textContent !== this.node.textContent
    const attrsChanged = node.attrs.language !== this.node.attrs.language ||
                         node.attrs.lineStart !== this.node.lineStart
    this.node = node
    this.code.className = node.attrs.language ? `language-${node.attrs.language}` : ''
    this._syncLabel(node)
    if (contentChanged || attrsChanged) {
      this._syncLineNumbers(node)
    }
    return true
  }

  stopEvent(e) {
    if (this.copyBtn.contains(e.target)) return true
    if (this.header.contains(e.target)) return true
    return false
  }

  // Only ignore mutations OUTSIDE the contentDOM (<code>).
  // Mutations inside contentDOM must be tracked by ProseMirror so the
  // editor state stays in sync with the DOM — otherwise the cursor can
  // end up at the wrong position (e.g. jumping out of the code block).
  ignoreMutation(mutation) {
    if (!this.contentDOM || !this.contentDOM.contains(mutation.target)) return true
    return false
  }
  destroy() {
    if (this.pre) this.pre._codeBlockView = null
  }
}

// ============================================================================
// Extension
// ============================================================================

export const CodeBlock = NodeExtension.create({
  name: 'code_block',
  group: 'block',
  content: 'text*',
  marks: '',
  defining: true,
  code: true,
  attrs: {
    language: { default: '' },
    lineStart: { default: 1 },     // Starting line number (data-start equivalent)
  },
  toDOM(node) {
    return ['pre', {
      class: 'code-block',
      spellcheck: 'false',
      'data-start': node.attrs.lineStart !== 1 ? node.attrs.lineStart : undefined,
    },
      ['code', {
        class: node.attrs.language ? `language-${node.attrs.language}` : '',
        spellcheck: 'false',
      }, 0],
    ]
  },
  parseDOM: [{
    tag: 'pre',
    preserveWhitespace: 'full',
    getAttrs(dom) {
      const code = dom.querySelector('code')
      const langClass = code?.className || ''
      const match = langClass.match(/language-(\S+)/)
      const lineStart = parseInt(dom.getAttribute('data-start'), 10) || 1
      return { language: match ? match[1] : '', lineStart }
    },
  }],

  addCommands() {
    return {
      toggleCodeBlock: (attrs) => (state, dispatch) => {
        const { code_block, paragraph } = state.schema.nodes
        if (!code_block || !paragraph) return false
        const { $from } = state.selection
        if ($from.parent.type === code_block) {
          return convertBlockType(paragraph, null, state, dispatch)
        } else {
          return convertBlockType(code_block, attrs || { language: '' }, state, dispatch)
        }
      },
      setCodeBlockLanguage: (attrs) => (state, dispatch) => {
        const { code_block } = state.schema.nodes
        if (!code_block) return false
        const { $from } = state.selection
        if ($from.parent.type !== code_block) return false
        if (dispatch) {
          dispatch(state.tr.setNodeMarkup($from.before(), null, {
            ...$from.parent.attrs,
            ...attrs,
          }))
        }
        return true
      },
      setCodeBlockLineStart: (pos, lineStart) => (state, dispatch) => {
        const node = state.doc.nodeAt(pos)
        if (!node || node.type.name !== 'code_block') return false
        if (dispatch) {
          dispatch(state.tr.setNodeMarkup(pos, null, {
            ...node.attrs,
            lineStart: Math.max(1, Math.round(lineStart)),
          }))
        }
        return true
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-a': (state, dispatch) => {
        const codeBlockType = state.schema.nodes.code_block
        if (!codeBlockType) return false
        const { $from } = state.selection
        if ($from.parent.type !== codeBlockType) return false

        const before = $from.before()
        const after = $from.after()
        const contentFrom = before + 1
        const contentTo = after - 1

        if (contentFrom >= contentTo) return true

        const { from, to } = state.selection
        if (from === contentFrom && to === contentTo) return false

        if (dispatch) {
          dispatch(state.tr.setSelection(
            TextSelection.create(state.doc, contentFrom, contentTo)
          ))
        }
        return true
      },

      // Tab → indent: if selection, indent each selected line; else insert 2 spaces
      Tab: (state, dispatch) => {
        if (state.selection.$from.parent.type.name !== 'code_block') return false
        const { from, to, empty } = state.selection
        if (empty) {
          if (dispatch) dispatch(state.tr.replaceSelectionWith(state.schema.text('  ')))
          return true
        }
        const $from = state.selection.$from
        const blockStart = $from.start()
        const blockText = $from.parent.textContent
        const startInBlock = from - blockStart
        const endInBlock = to - blockStart
        let lineStart = blockText.lastIndexOf('\n', startInBlock - 1) + 1
        let pos = lineStart
        const inserts = []
        while (pos <= endInBlock) {
          inserts.push(pos)
          const nl = blockText.indexOf('\n', pos)
          if (nl === -1 || nl >= endInBlock) break
          pos = nl + 1
        }
        if (dispatch) {
          let tr = state.tr
          for (let i = inserts.length - 1; i >= 0; i--) {
            const absPos = blockStart + inserts[i]
            tr = tr.insert(absPos, state.schema.text('  '))
          }
          dispatch(tr)
        }
        return true
      },

      // Shift-Tab → unindent: remove up to 2 spaces from start of each selected line
      'Shift-Tab': (state, dispatch) => {
        const { $from } = state.selection
        if ($from.parent.type.name !== 'code_block') return false
        const { from, to, empty } = state.selection
        if (empty) {
          const offsetInBlock = $from.parentOffset
          const blockText = $from.parent.textContent
          const textBefore = blockText.slice(0, offsetInBlock)
          const lastNewline = textBefore.lastIndexOf('\n')
          const lineText = textBefore.slice(lastNewline + 1)
          const spaces = lineText.match(/^ {1,2}/)
          if (!spaces) return true
          if (dispatch) {
            const deleteFrom = $from.start() + lastNewline + 1
            dispatch(state.tr.delete(deleteFrom, deleteFrom + spaces[0].length))
          }
          return true
        }
        const blockStart = $from.start()
        const blockText = $from.parent.textContent
        const startInBlock = from - blockStart
        const endInBlock = to - blockStart
        let lineStart = blockText.lastIndexOf('\n', startInBlock - 1) + 1
        const deletions = []
        let pos = lineStart
        while (pos <= endInBlock) {
          const lineText = blockText.slice(pos, blockText.indexOf('\n', pos) === -1 ? blockText.length : blockText.indexOf('\n', pos))
          const spaces = lineText.match(/^ {1,2}/)
          if (spaces) {
            deletions.push({ from: pos, len: spaces[0].length })
          }
          const nl = blockText.indexOf('\n', pos)
          if (nl === -1 || nl >= endInBlock) break
          pos = nl + 1
        }
        if (deletions.length && dispatch) {
          let tr = state.tr
          for (let i = deletions.length - 1; i >= 0; i--) {
            const absFrom = blockStart + deletions[i].from
            tr = tr.delete(absFrom, absFrom + deletions[i].len)
          }
          dispatch(tr)
        }
        return true
      },

      // Smart Enter: insert newline and preserve indentation of current line.
      // Only handles collapsed cursor — non-empty selection falls through to default.
      Enter: (state, dispatch) => {
        if (!dispatch) return false
        const { $from, empty } = state.selection
        if ($from.parent.type.name !== 'code_block') return false
        if (!empty) return false  // let default behavior handle selection replacement

        const offsetInBlock = $from.parentOffset
        const blockText = $from.parent.textContent
        const textBefore = blockText.slice(0, offsetInBlock)
        const lastNewline = textBefore.lastIndexOf('\n')
        const lineText = textBefore.slice(lastNewline + 1)
        const indent = lineText.match(/^\s*/)[0]
        dispatch(state.tr.insertText('\n' + indent))
        return true
      },
    }
  },

  addInputRules() {
    return [new InputRule(/^```$/, (state, match, start, _end) => {
      // `start` is the absolute position in the state where the matched
      // text begins (the inputrules `run` function already accounts for
      // the lookbehind vs typed-text offset). We need to replace the
      // entire block that contains the match with a code_block.
      const $start = state.doc.resolve(start)
      const codeBlockType = state.schema.nodes.code_block
      if (!codeBlockType) return null
      // Inside a blockquote: don't recognize the markdown code-block syntax
      for (let d = $start.depth; d > 0; d--) {
        if ($start.node(d).type.name === 'blockquote') return null
      }
      const codeBlock = codeBlockType.create({ language: '' })
      const tr = state.tr.replaceWith($start.before(), $start.after(), codeBlock)
      const blockPos = tr.doc.resolve($start.before() + 1)
      tr.setSelection(TextSelection.near(blockPos))
      return tr
    })]
  },

  addNodeViews() {
    return {
      code_block: (node, view, getPos) => new CodeBlockView(node, view, getPos),
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: codeBlockHighlightKey,
        state: {
          init: (_, state) => buildDecorations(state),
          apply: (tr, prev, _oldState, newState) => {
            if (tr.docChanged || tr.selectionSet) {
              return buildDecorations(newState)
            }
            return prev.map(tr.mapping, newState.doc)
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)
          },
          // Click on line number gutter → select entire line
          handleClick(view, pos, event) {
            // Check if click is inside a line-numbers-rows gutter
            const gutter = event.target?.closest?.('.line-numbers-rows')
            if (!gutter) return false

            // Find the code block containing this click position
            let cbPos = null
            let cbNode = null
            view.state.doc.descendants((node, p) => {
              if (cbPos != null) return false
              if (node.type.name === 'code_block') {
                const from = p + 1
                const to = p + node.nodeSize - 1
                if (pos >= p && pos <= p + node.nodeSize) {
                  cbPos = from
                  cbNode = node
                }
              }
            })

            if (!cbPos || !cbNode) return false

            const text = cbNode.textContent
            // Map click position to offset within the text content
            const offset = Math.max(0, Math.min(pos - cbPos, text.length))

            // Find the line boundaries
            const lineStart = text.lastIndexOf('\n', offset - 1) + 1
            const lineEndIdx = text.indexOf('\n', offset)
            const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx

            const from = cbPos + lineStart
            const to = cbPos + lineEnd

            if (from >= to) return true

            view.dispatch(
              view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to))
            )
            return true
          },
        },
      }),
      // Gutter sync plugin — updates line number gutter after every state change
      new Plugin({
        key: new PluginKey('codeBlockGutterSync'),
        view() {
          return {
            update(editorView) {
              syncGutters(editorView)
            },
          }
        },
      }),
    ]
  },
})
