import { NodeExtension } from '../Extension'
import { InputRule } from 'prosemirror-inputrules'
import { TextSelection } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { Plugin, PluginKey } from 'prosemirror-state'
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
import 'prismjs/components/prism-lua'
import 'prismjs/components/prism-haskell'
import 'prismjs/components/prism-elixir'
import 'prismjs/components/prism-erlang'
import 'prismjs/components/prism-clojure'
import 'prismjs/components/prism-scala'
import 'prismjs/components/prism-dart'

// Language aliases for convenience (e.g., "js" → "javascript")
const LANG_ALIASES = {
  js: 'javascript', ts: 'typescript', py: 'python', rb: 'ruby',
  sh: 'bash', shell: 'bash', yml: 'yaml', md: 'markdown',
  cs: 'csharp', 'c++': 'cpp', 'c#': 'csharp',
  html: 'markup', xml: 'markup', svg: 'markup',
  dockerfile: 'docker',
}

function resolveLanguage(lang) {
  if (!lang) return null
  const key = lang.toLowerCase()
  const resolved = LANG_ALIASES[key] || key
  return Prism.languages[resolved] ? resolved : null
}

const codeBlockHighlightKey = new PluginKey('codeBlockHighlight')

function buildDecorations(state) {
  const decorations = []
  const codeBlockType = state.schema.nodes.code_block
  if (!codeBlockType) return DecorationSet.empty

  state.doc.descendants((node, pos) => {
    if (node.type !== codeBlockType) return
    const lang = resolveLanguage(node.attrs.language)
    if (!lang) return

    const text = node.textContent
    if (!text) return

    const contentStart = pos + 1

    // Syntax highlighting token decorations
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
  })

  return DecorationSet.create(state.doc, decorations)
}

export const CodeBlock = NodeExtension.create({
  name: 'code_block',
  group: 'block',
  content: 'text*',
  marks: '',
  defining: true,
  code: true,
  attrs: { language: { default: '' } },
  toDOM(node) {
    return ['pre', { class: 'code-block', spellcheck: 'false' },
      ['code', { class: node.attrs.language ? `language-${node.attrs.language}` : '', spellcheck: 'false' }, 0]]
  },
  parseDOM: [{
    tag: 'pre',
    preserveWhitespace: 'full',
    getAttrs(dom) {
      const code = dom.querySelector('code')
      const langClass = code?.className || ''
      const match = langClass.match(/language-(\S+)/)
      return { language: match ? match[1] : '' }
    },
  }],

  addCommands() {
    return {
      toggleCodeBlock: (attrs) => (state, dispatch) => {
        const { code_block, paragraph } = state.schema.nodes
        if (!code_block || !paragraph) return false
        const { $from } = state.selection
        if ($from.parent.type === code_block) {
          if (dispatch) dispatch(state.tr.setNodeMarkup($from.before(), paragraph))
        } else {
          if (dispatch) dispatch(state.tr.setNodeMarkup($from.before(), code_block, attrs || { language: '' }))
        }
        return true
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
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-a': (state, dispatch) => {
        const codeBlockType = state.schema.nodes.code_block
        if (!codeBlockType) return false
        const { $from } = state.selection
        // Not in a code block → fall through to default select-all
        if ($from.parent.type !== codeBlockType) return false

        // Calculate code block content range
        const before = $from.before()
        const after = $from.after()
        const contentFrom = before + 1
        const contentTo = after - 1

        // If code block is empty, nothing to select
        if (contentFrom >= contentTo) return true

        // If the selection already covers the whole code block content,
        // fall through to default behavior (select entire document)
        const { from, to } = state.selection
        if (from === contentFrom && to === contentTo) return false

        // Select all content within this code block
        if (dispatch) {
          dispatch(state.tr.setSelection(
            TextSelection.create(state.doc, contentFrom, contentTo)
          ))
        }
        return true
      },

      'Mod-Alt-c': (state, dispatch) => {
        const { code_block, paragraph } = state.schema.nodes
        if (!code_block) return false
        const { $from } = state.selection
        if ($from.parent.type === code_block) {
          if (dispatch) dispatch(state.tr.setNodeMarkup($from.before(), paragraph))
        } else {
          if (dispatch) dispatch(state.tr.setNodeMarkup($from.before(), code_block, { language: '' }))
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

      // Smart Enter: preserve indentation of current line
      Enter: (state, dispatch) => {
        const { $from } = state.selection
        if ($from.parent.type.name !== 'code_block') return false
        const offsetInBlock = $from.parentOffset
        const blockText = $from.parent.textContent
        const textBefore = blockText.slice(0, offsetInBlock)
        const lastNewline = textBefore.lastIndexOf('\n')
        const lineText = textBefore.slice(lastNewline + 1)
        const indent = lineText.match(/^\s*/)[0]
        if (dispatch) {
          dispatch(state.tr.replaceSelectionWith(state.schema.text('\n' + indent)))
        }
        return true
      },
    }
  },

  addInputRules() {
    return [new InputRule(/^```$/, (state, match, start, end) => {
      const matchStart = start - match[0].length
      const codeBlock = state.schema.nodes.code_block.create({ language: '' })
      return state.tr.replaceWith(matchStart, end, codeBlock)
    })]
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
        },
      }),
    ]
  },
})
