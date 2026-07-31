import { Extension } from '../Extension'
import { Plugin } from 'prosemirror-state'
import { Fragment, Slice } from 'prosemirror-model'

// ============================================================================
// Markdown detection
// ============================================================================

const MD_BLOCK_START = /^(#{1,6}\s|[-*+]\s(\[[x ]?\]\s)?|>\s|\d+\.\s|---+$|```)/

export function isMarkdown(text) {
  return MD_BLOCK_START.test(text.trimStart())
}

// ============================================================================
// Inline parsing
// ============================================================================

export function parseInline(schema, text) {
  if (!text) return []

  const nodes = []
  let i = 0

  while (i < text.length) {
    // — Code span: `code` —
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1)
      if (end !== -1) {
        const code = text.slice(i + 1, end)
        if (code && schema.marks.code) {
          nodes.push(schema.text(code, [schema.marks.code.create()]))
        } else if (code) {
          nodes.push(schema.text(code))
        }
        i = end + 1
        continue
      }
    }

    // — Bold: **text** —
    if (text[i] === '*' && text[i + 1] === '*') {
      const close = findClosingDelim(text, i + 2, '**')
      if (close !== -1) {
        const inner = text.slice(i + 2, close)
        if (inner && schema.marks.bold) {
          const innerNodes = parseInline(schema, inner)
          nodes.push(...innerNodes.map(n =>
            n.isText ? schema.text(n.text, [...n.marks, schema.marks.bold.create()]) : n,
          ))
        } else if (inner) {
          nodes.push(schema.text(inner))
        }
        i = close + 2
        continue
      }
      // No closing ** → consume both asterisks as plain text
      let j = i + 2
      while (j < text.length && text[j] !== '`' && text[j] !== '*' && text[j] !== '~') j++
      nodes.push(schema.text(text.slice(i, j)))
      i = j
      continue
    }

    // — Italic: *text* —
    if (text[i] === '*' && text[i + 1] !== '*') {
      const close = findClosingDelim(text, i + 1, '*')
      if (close !== -1) {
        const inner = text.slice(i + 1, close)
        if (inner && schema.marks.italic) {
          const innerNodes = parseInline(schema, inner)
          nodes.push(...innerNodes.map(n =>
            n.isText ? schema.text(n.text, [...n.marks, schema.marks.italic.create()]) : n,
          ))
        } else if (inner) {
          nodes.push(schema.text(inner))
        }
        i = close + 1
        continue
      }
      // No closing * → consume as plain text
      let j = i + 1
      while (j < text.length && text[j] !== '`' && text[j] !== '*' && text[j] !== '~') j++
      nodes.push(schema.text(text.slice(i, j)))
      i = j
      continue
    }

    // — Strikethrough: ~~text~~ —
    if (text[i] === '~' && text[i + 1] === '~') {
      const close = findClosingDelim(text, i + 2, '~~')
      if (close !== -1) {
        const inner = text.slice(i + 2, close)
        if (inner && schema.marks.strikethrough) {
          const innerNodes = parseInline(schema, inner)
          nodes.push(...innerNodes.map(n =>
            n.isText ? schema.text(n.text, [...n.marks, schema.marks.strikethrough.create()]) : n,
          ))
        } else if (inner) {
          nodes.push(schema.text(inner))
        }
        i = close + 2
        continue
      }
      // No closing ~~ → consume as plain text
      let j = i + 2
      while (j < text.length && text[j] !== '`' && text[j] !== '*' && text[j] !== '~') j++
      nodes.push(schema.text(text.slice(i, j)))
      i = j
      continue
    }

    // — Plain text run —
    let j = i + 1
    while (j < text.length && text[j] !== '`' && text[j] !== '*' && text[j] !== '~') j++
    nodes.push(schema.text(text.slice(i, j)))
    i = j
  }

  return nodes
}

/** Find closing delimiter, skipping escaped characters. */
function findClosingDelim(text, start, delim) {
  let i = start
  while (i <= text.length - delim.length) {
    if (text[i] === '\\') { i += 2; continue }
    if (text.slice(i, i + delim.length) === delim) {
      // For single *, don't match if it's part of **
      if (delim === '*' && text[i + 1] === '*') { i += 2; continue }
      return i
    }
    i++
  }
  return -1
}

// ============================================================================
// Block parsing
// ============================================================================

export function parseMarkdown(schema, text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const nodes = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    // trimStart: keep trailing whitespace so task list regex `- [ ] ` (which
    // requires a trailing space) matches even when lines have no content after
    // the checkbox. Other block regexes (heading, blockquote, etc.) already
    // consume their content explicitly, so trailing whitespace is harmless.
    const trimmed = line.trimStart()

    // — Empty line —
    if (!trimmed) { i++; continue }

    // — Fenced code block —
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim() || ''
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      if (i < lines.length) i++ // skip closing ```
      if (schema.nodes.code_block) {
        const codeText = codeLines.join('\n')
        const content = codeText ? [schema.text(codeText)] : []
        nodes.push(schema.nodes.code_block.create({ language: lang }, content))
      }
      continue
    }

    // — Heading —
    const hMatch = trimmed.match(/^(#{1,6})\s+(.*)/)
    if (hMatch && schema.nodes.heading) {
      const level = hMatch[1].length
      const inlineNodes = parseInline(schema, hMatch[2].trim())
      nodes.push(schema.nodes.heading.create({ level }, inlineNodes))
      i++
      continue
    }

    // — Blockquote —
    if (trimmed.startsWith('> ') && schema.nodes.blockquote) {
      const inlineNodes = parseInline(schema, trimmed.slice(2).trim())
      nodes.push(schema.nodes.blockquote.create(null, [
        schema.nodes.paragraph.create(null, inlineNodes),
      ]))
      i++
      continue
    }

    // — Divider —
    if (/^---+\s*$/.test(trimmed) && schema.nodes.horizontal_rule) {
      nodes.push(schema.nodes.horizontal_rule.create())
      i++
      continue
    }

    // — Task list (must be checked before unordered list) —
    if (/^[-*+]\s\[[x ]?\]\s?/.test(trimmed) && schema.nodes.task_list) {
      const items = []
      while (i < lines.length) {
        const m = lines[i].trimStart().match(/^[-*+]\s\[([x ]?)\]\s?(.*)/)
        if (!m) break
        const content = (m[2] || '').trim()
        const inlineNodes = content ? parseInline(schema, content) : []
        items.push(schema.nodes.task_item.create({ checked: m[1] === 'x' }, [
          schema.nodes.paragraph.create(null, inlineNodes),
        ]))
        i++
      }
      if (items.length) nodes.push(schema.nodes.task_list.create(null, items))
      continue
    }

    // — Unordered list —
    if (/^[-*+]\s/.test(trimmed) && schema.nodes.bullet_list) {
      const items = []
      while (i < lines.length) {
        const m = lines[i].trimStart().match(/^[-*+]\s(.*)/)
        if (!m) break
        const content = (m[1] || '').trim()
        const inlineNodes = content ? parseInline(schema, content) : []
        items.push(schema.nodes.list_item.create(null, [
          schema.nodes.paragraph.create(null, inlineNodes),
        ]))
        i++
      }
      if (items.length) nodes.push(schema.nodes.bullet_list.create(null, items))
      continue
    }

    // — Ordered list —
    if (/^\d+\.\s/.test(trimmed) && schema.nodes.ordered_list) {
      const items = []
      while (i < lines.length) {
        const m = lines[i].trimStart().match(/^\d+\.\s(.*)/)
        if (!m) break
        const content = (m[1] || '').trim()
        const inlineNodes = content ? parseInline(schema, content) : []
        items.push(schema.nodes.list_item.create(null, [
          schema.nodes.paragraph.create(null, inlineNodes),
        ]))
        i++
      }
      if (items.length) nodes.push(schema.nodes.ordered_list.create(null, items))
      continue
    }

    // — Paragraph (default) —
    {
      const inlineNodes = parseInline(schema, trimmed.trim())
      nodes.push(schema.nodes.paragraph.create(null, inlineNodes))
      i++
    }
  }

  if (!nodes.length) return Fragment.from(schema.nodes.paragraph.create())
  return Fragment.from(nodes)
}

// ============================================================================
// Extension
// ============================================================================

export const MarkdownPaste = Extension.create({
  name: 'markdownPaste',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handlePaste(view, event, slice) {
            // Let HTML pastes through (browsers handle rich paste natively)
            if (event.clipboardData?.types?.includes('text/html')) return false

            const text = event.clipboardData?.getData('text/plain')
            if (!text || !isMarkdown(text)) return false

            const fragment = parseMarkdown(view.state.schema, text)
            if (!fragment.size) return false

            view.dispatch(view.state.tr.replaceSelection(new Slice(fragment, 0, 0)))
            return true
          },
        },
      }),
    ]
  },
})
