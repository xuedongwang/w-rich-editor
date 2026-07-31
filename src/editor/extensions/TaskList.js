import { NodeExtension } from '../Extension.js'
import { wrapInList, splitListItem, sinkListItem } from 'prosemirror-schema-list'
import { InputRule } from 'prosemirror-inputrules'
import { TextSelection } from 'prosemirror-state'
import { Fragment } from 'prosemirror-model'

/**
 * Return true if the given resolved position is inside a blockquote.
 */
function isInsideBlockquote($pos, blockquoteType) {
  if (!blockquoteType) return false
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type === blockquoteType) return true
  }
  return false
}

/**
 * Set the cursor inside the task item's paragraph, at the end of the original
 * content. Without this, `replaceWith` maps the cursor to AFTER the inserted
 * task list, causing it to appear on a new line.
 */
function setListSelection(tr, listNode, contentSize) {
  let listPos = -1
  tr.doc.descendants((node, pos) => {
    if (listPos >= 0) return false
    if (node === listNode) {
      listPos = pos
      return false
    }
  })
  if (listPos < 0) return tr
  const taskItem = listNode.firstChild
  const paragraph = taskItem.firstChild
  // Paragraph content start = listPos + 1 (task_list) + 1 (task_item) + 1 (paragraph) = listPos + 3
  const cursorPos = listPos + 3 + contentSize
  const $cursor = tr.doc.resolve(cursorPos)
  return tr.setSelection(TextSelection.near($cursor))
}

/**
 * Find the list wrapper depth for any known list type.
 */
function findListDepth($from, listTypes) {
  for (let d = $from.depth; d > 0; d--) {
    const n = $from.node(d)
    if (listTypes.some(t => t && n.type === t)) return d
  }
  return -1
}

/**
 * Exit a task list: drop the trailing empty task_item, keep the remaining
 * list intact, and insert a fresh paragraph after the list with the cursor
 * inside it. If the list contained only the empty item, replace the whole
 * list with a paragraph.
 */
function exitTaskList(state, dispatch, listDepth) {
  if (!dispatch) return true
  const $from = state.selection.$from
  const taskList = $from.node(listDepth)
  const listBefore = $from.before(listDepth)

  // Build a new task_list without the trailing empty item
  const remaining = []
  taskList.forEach((child, idx) => {
    if (idx < taskList.childCount - 1) remaining.push(child)
  })

  let tr = state.tr
  if (remaining.length > 0) {
    // Replace the old task_list with the trimmed version
    const newList = state.schema.nodes.task_list.create(null, remaining)
    tr = tr.replaceWith(listBefore, $from.after(listDepth), newList)
    // Insert a paragraph right after the new (shorter) list
    const insertPos = listBefore + newList.nodeSize
    const para = state.schema.nodes.paragraph.create()
    tr = tr.insert(insertPos, para)
    tr = tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1)))
  } else {
    // Single empty item → replace the whole list with a paragraph
    const para = state.schema.nodes.paragraph.create()
    tr = tr.replaceWith(listBefore, $from.after(listDepth), para)
    tr = tr.setSelection(TextSelection.near(tr.doc.resolve(listBefore + 1)))
  }
  dispatch(tr)
  return true
}

/**
 * Convert one list type into another by rebuilding children with the target
 * item type. Handles task_list ↔ bullet_list ↔ ordered_list.
 */
function convertListType(state, dispatch, listDepth, targetListType, targetItemType) {
  const listNode = state.selection.$from.node(listDepth)
  const items = []
  listNode.forEach(child => {
    const content = []
    child.forEach(c => content.push(c))
    items.push(targetItemType.create(child.attrs, content))
  })
  if (dispatch) {
    dispatch(state.tr.replaceWith(
      state.selection.$from.before(listDepth),
      state.selection.$from.after(listDepth),
      targetListType.create(null, items),
    ))
  }
  return true
}

// ============================================================================
// NodeView
// ============================================================================

class TaskItemView {
  constructor(node, view, getPos) {
    this.node = node
    this.view = view
    this.getPos = getPos

    // DOM structure
    this.wrapper = document.createElement('div')
    this.wrapper.className = 'task-item-wrapper'

    this.checkbox = document.createElement('span')
    this.checkbox.className = 'task-checkbox'
    this.checkbox.contentEditable = 'false'

    this.content = document.createElement('div')
    this.content.className = 'task-item-content'

    this.wrapper.append(this.checkbox, this.content)
    this.dom = this.wrapper
    this.contentDOM = this.content

    // Use mousedown to toggle — avoids click event issues and prevents
    // ProseMirror's click handler from stealing focus / creating a selection.
    this.checkbox.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })

    this.checkbox.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const pos = this.getPos()
      if (pos == null) return
      const currentNode = this.view.state.doc.nodeAt(pos)
      if (!currentNode || currentNode.type.name !== 'task_item') return
      this.view.dispatch(
        this.view.state.tr.setNodeMarkup(pos, null, {
          checked: !currentNode.attrs.checked,
        }),
      )
    })

    this.update(node)
  }

  update(node) {
    this.node = node
    this.checkbox.textContent = node.attrs.checked ? '☑' : '☐'
    this.wrapper.classList.toggle('is-checked', !!node.attrs.checked)
  }

  stopEvent(e) {
    return this.checkbox.contains(e.target)
  }

  ignoreMutation() {
    return false
  }

  destroy() {}
}

// ============================================================================
// Extensions
// ============================================================================

export const TaskList = NodeExtension.create({
  name: 'task_list',
  group: 'block',
  content: 'task_item+',
  toDOM: () => ['ul', { class: 'task-list', 'data-task-list': '' }, 0],
  parseDOM: [{ tag: 'ul[data-task-list]', priority: 60 }],
})

export const TaskItem = NodeExtension.create({
  name: 'task_item',
  content: 'paragraph block*',
  defining: true,
  attrs: { checked: { default: false } },

  toDOM(node) {
    // NOTE: ProseMirror requires the content hole (0) to be the ONLY child
    // of its parent node. The checkbox is rendered by the NodeView instead.
    return ['li', {
      class: 'task-item',
      'data-checked': String(!!node.attrs.checked),
    }, 0]
  },

  parseDOM: [{
    tag: 'li[data-checked]',
    priority: 60,
    getAttrs(dom) {
      return { checked: dom.getAttribute('data-checked') === 'true' }
    },
  }],

  addCommands() {
    return {
      toggleTaskList: () => (state, dispatch) => {
        const { task_list, bullet_list, ordered_list, task_item } = state.schema.nodes
        if (!task_list || !task_item) return false
        const { $from } = state.selection

        const listDepth = findListDepth($from, [task_list, bullet_list, ordered_list])

        if (listDepth < 0) {
          // Not in any list → wrap in task_list
          return wrapInList(task_list)(state, dispatch)
        }

        const listNode = $from.node(listDepth)

        if (listNode.type === task_list) {
          // In task_list → lift inner content out (task_items can't live at
          // doc level since they aren't in the 'block' group, so we extract
          // each item's inner paragraphs).
          const content = []
          listNode.forEach(item => item.forEach(child => content.push(child)))
          if (dispatch) {
            dispatch(state.tr.replaceWith(
              $from.before(listDepth),
              $from.after(listDepth),
              content,
            ))
          }
          return true
        }

        // In bullet_list or ordered_list → convert to task_list
        return convertListType(state, dispatch, listDepth, task_list, task_item)
      },
    }
  },

  addKeyboardShortcuts() {
    const isInsideTaskItem = ($from, taskItemType) => {
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type === taskItemType) return true
      }
      return false
    }

    return {
      Enter: (state, dispatch) => {
        const ti = state.schema.nodes.task_item
        if (!ti) return false
        if (!isInsideTaskItem(state.selection.$from, ti)) return false

        const { $from } = state.selection
        // Find the task_item depth
        let itemDepth = -1
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type === ti) { itemDepth = d; break }
        }
        const item = $from.node(itemDepth)

        // Empty item → exit the task list.
        // An "empty" task item has a single empty paragraph (content.size === 2
        // because the paragraph wrapper itself contributes 2 to the parent's size).
        const firstChild = item.firstChild
        const isEmpty = firstChild && firstChild.isTextblock && firstChild.content.size === 0

        if (isEmpty) {
          // Find parent task_list
          let listDepth = -1
          for (let d = itemDepth - 1; d > 0; d--) {
            if ($from.node(d).type === state.schema.nodes.task_list) {
              listDepth = d
              break
            }
          }
          if (listDepth >= 0) return exitTaskList(state, dispatch, listDepth)
        }
        return splitListItem(ti)(state, dispatch)
      },
      Tab: (state, dispatch) => {
        const ti = state.schema.nodes.task_item
        if (!ti) return false
        if (!isInsideTaskItem(state.selection.$from, ti)) return false
        return sinkListItem(ti)(state, dispatch)
      },
      'Shift-Tab': (state, dispatch) => {
        const ti = state.schema.nodes.task_item
        if (!ti) return false
        if (!isInsideTaskItem(state.selection.$from, ti)) return false

        const { $from } = state.selection
        let itemDepth = -1
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type === ti) { itemDepth = d; break }
        }
        const item = $from.node(itemDepth)
        const firstChild = item.firstChild
        const isEmpty = firstChild && firstChild.isTextblock && firstChild.content.size === 0

        if (!isEmpty) return false

        // Find parent task_list
        let listDepth = -1
        for (let d = itemDepth - 1; d > 0; d--) {
          if ($from.node(d).type === state.schema.nodes.task_list) {
            listDepth = d
            break
          }
        }
        if (listDepth < 0) return false

        return exitTaskList(state, dispatch, listDepth)
      },
    }
  },

  addInputRules() {
    const editor = this.editor
    const rules = []

    if (editor.schema.nodes.task_list && editor.schema.nodes.task_item) {
      // Primary rule: `- [] `, `- [ ] `, or `- [x] ` → create task_list directly.
      // (In practice the BulletList rule fires first on `- `, so this rule
      // only triggers when pasting or when the full sequence is typed fast
      // enough that the intermediate state isn't committed.)
      rules.push(new InputRule(/^(?:[-*+])\s\[([x ]?)\]\s$/, (state, match, start, end) => {
        const $start = state.doc.resolve(start)
        if (isInsideBlockquote($start, state.schema.nodes.blockquote)) return null
        const paragraph = $start.parent
        const content = paragraph.content.cut(0, start - $start.start)
        const p = state.schema.nodes.paragraph.create(null, content)
        const ti = state.schema.nodes.task_item.create({ checked: match[1] === 'x' }, p)
        const tl = state.schema.nodes.task_list.create(null, ti)
        let tr = state.tr.replaceWith($start.before(), $start.after(), tl)
        tr = setListSelection(tr, tl, content.size)
        return tr
      }))

      // Rescue rule: when the BulletList rule already fired on `- `, the user
      // is inside a bullet_list > list_item > paragraph. If they then type
      // `[]` or `[ ]` or `[x]` followed by a space, convert the parent
      // bullet_list to a task_list, stripping the `[] ` prefix. This lets the
      // user type `- `, then `[] `, and get a task list, matching Notion's
      // behavior.
      if (editor.schema.nodes.bullet_list && editor.schema.nodes.list_item) {
        rules.push(new InputRule(/^(\[[x ]?\])\s$/, (state, match, start, end) => {
          const $start = state.doc.resolve(start)
          if (isInsideBlockquote($start, state.schema.nodes.blockquote)) return null

          const paragraph = $start.parent
          const paraStart = $start.start()

          // The match must start at the beginning of the paragraph
          if (start !== paraStart) return null

          // Walk up ancestors to find the bullet_list wrapper
          const { bullet_list, list_item, task_list, task_item } = state.schema.nodes
          let listDepth = -1
          for (let d = $start.depth; d > 0; d--) {
            const n = $start.node(d)
            if (n.type === bullet_list) { listDepth = d; break }
          }
          if (listDepth < 0) return null
          const listWrapper = $start.node(listDepth)
          // Only convert the FIRST item (list_wrapper has exactly 1 child)
          if (listWrapper.childCount !== 1) return null
          if (listWrapper.firstChild.type !== list_item) return null

          // Strip the `[] ` prefix; keep any content after it
          const matchLen = end - start
          const remaining = paragraph.content.cut(matchLen)
          const checked = match[1] === '[x]'
          const p = state.schema.nodes.paragraph.create(null, remaining)
          const li = task_item.create({ checked }, [p])
          const tl = task_list.create(null, [li])
          let tr = state.tr.replaceWith(
            $start.before(listDepth),
            $start.after(listDepth),
            tl,
          )
          tr = setListSelection(tr, tl, remaining.size)
          return tr
        }))
      }
    }

    return rules
  },

  addNodeViews() {
    return {
      task_item: (node, view, getPos) => new TaskItemView(node, view, getPos),
    }
  },
})
