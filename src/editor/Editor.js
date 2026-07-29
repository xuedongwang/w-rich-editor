import { EditorState } from 'prosemirror-state'
import { TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { Schema, DOMParser as PMDOMParser, DOMSerializer } from 'prosemirror-model'
import { keymap } from 'prosemirror-keymap'
import { inputRules as createInputRules } from 'prosemirror-inputrules'
import { baseKeymap } from 'prosemirror-commands'

export class Editor {
  constructor(options) {
    this.options = {
      editable: true,
      autofocus: false,
      ...options,
    }

    // Resolve extensions and bind editor reference
    this.extensions = options.extensions.map((ext) => {
      const resolved = ext && typeof ext.resolve === 'function' ? ext.resolve() : ext
      resolved.editor = this
      return resolved
    })

    this.commandsMap = {}

    this.createSchema()
    this.collectCommands()
    this.createView()
    this.bindEvents()
    this.fireLifecycle('onCreate')

    // Auto focus
    if (this.options.autofocus && this.view) {
      this.view.focus()
      if (this.options.autofocus === 'end') {
        const endPos = this.state.doc.content.size
        const $pos = this.state.doc.resolve(endPos)
        const selection = TextSelection.near($pos, -1)
        this.view.dispatch(this.state.tr.setSelection(selection))
      }
    }
  }

  // ========================================================================
  // Schema
  // ========================================================================

  createSchema() {
    const nodes = {}
    const marks = {}

    for (const ext of this.extensions) {
      if (ext.type === 'node' && ext.nodeSpec) {
        nodes[ext.name] = ext.nodeSpec
      }
      if (ext.type === 'mark' && ext.markSpec) {
        marks[ext.name] = ext.markSpec
      }
    }

    // ProseMirror requires a 'text' node in every schema
    if (!nodes.text) {
      nodes.text = { group: 'inline', inline: true }
    }

    this.schema = new Schema({ nodes, marks })
  }

  // ========================================================================
  // Commands
  // ========================================================================

  collectCommands() {
    this.commandsMap = {}

    for (const ext of this.extensions) {
      if (ext._addCommands) {
        const cmds = ext._addCommands.call(ext)
        Object.assign(this.commandsMap, cmds)
      }
    }
  }

  get commands() {
    const result = {}
    for (const [name, cmdFactory] of Object.entries(this.commandsMap)) {
      result[name] = (...args) => {
        const cmd = cmdFactory(...args)
        return cmd(this.state, this.view.dispatch, this.view)
      }
    }
    return result
  }

  chain() {
    const chained = {}
    const queue = []
    let shouldFocus = false

    for (const [name, cmdFactory] of Object.entries(this.commandsMap)) {
      chained[name] = (...args) => {
        queue.push(() => {
          const cmd = cmdFactory(...args)
          return cmd(this.state, this.view.dispatch, this.view)
        })
        return chained
      }
    }

    chained.focus = () => {
      shouldFocus = true
      return chained
    }

    chained.run = () => {
      if (shouldFocus) this.view.focus()
      for (const fn of queue) fn()
    }

    return chained
  }

  // ========================================================================
  // View
  // ========================================================================

  createView() {
    const plugins = this.collectPlugins()
    const nodeViews = this.collectNodeViews()

    let doc = undefined
    if (this.options.content) {
      if (typeof this.options.content === 'string') {
        const temp = document.createElement('div')
        temp.innerHTML = this.options.content
        doc = PMDOMParser.fromSchema(this.schema).parse(temp)
      } else {
        doc = this.schema.nodeFromJSON(this.options.content)
      }
    }

    this.state = EditorState.create({
      schema: this.schema,
      doc,
      plugins,
    })

    const viewProps = {
      state: this.state,
      editable: () => this.options.editable !== false,
      dispatchTransaction: (tr) => {
        this.state = this.state.apply(tr)
        this.view.updateState(this.state)

        if (tr.docChanged) this.fireLifecycle('onUpdate')
        if (tr.selectionSet) this.fireLifecycle('onSelectionUpdate')
      },
    }

    if (Object.keys(nodeViews).length > 0) {
      viewProps.nodeViews = nodeViews
    }

    this.view = new EditorView(this.options.target, viewProps)

    // Apply CSS class names to the editor DOM
    this.view.dom.classList.add('w-rich-editor')
    if (this.options.classNames) {
      const extra = this.options.classNames
      if (typeof extra === 'string') {
        extra.split(/\s+/).filter(Boolean).forEach(c => this.view.dom.classList.add(c))
      } else if (Array.isArray(extra)) {
        extra.forEach(c => this.view.dom.classList.add(c))
      }
    }
  }

  collectPlugins() {
    const plugins = []
    const allInputRules = []
    const allKeymaps = {}

    for (const ext of this.extensions) {
      if (ext._addProseMirrorPlugins) {
        const extPlugins = ext._addProseMirrorPlugins.call(ext)
        plugins.push(...extPlugins)
      }

      if (ext._addInputRules) {
        const rules = ext._addInputRules.call(ext)
        allInputRules.push(...rules)
      }

      if (ext._addKeyboardShortcuts) {
        const shortcuts = ext._addKeyboardShortcuts.call(ext)
        Object.assign(allKeymaps, shortcuts)
      }
    }

    if (allInputRules.length > 0) {
      plugins.push(createInputRules({ rules: allInputRules }))
    }
    if (Object.keys(allKeymaps).length > 0) {
      plugins.push(keymap(allKeymaps))
    }
    plugins.push(keymap(baseKeymap))

    return plugins
  }

  collectNodeViews() {
    const nodeViews = {}
    for (const ext of this.extensions) {
      if (ext._addNodeViews) {
        const views = ext._addNodeViews.call(ext)
        Object.assign(nodeViews, views)
      }
    }
    return nodeViews
  }

  // ========================================================================
  // Events
  // ========================================================================

  bindEvents() {
    const wrapper = this.view.dom

    wrapper.addEventListener('focus', (event) => {
      this.fireLifecycle('onFocus', { event })
    })

    wrapper.addEventListener('blur', (event) => {
      this.fireLifecycle('onBlur', { event })
    })
  }

  fireLifecycle(hook, extra) {
    for (const ext of this.extensions) {
      const hookFn = ext[`_${hook}`]
      if (hookFn) {
        hookFn.call(ext)
      }
    }

    const callbackMap = {
      onCreate: 'onCreate',
      onUpdate: 'onUpdate',
      onSelectionUpdate: 'onSelectionUpdate',
      onFocus: 'onFocus',
      onBlur: 'onBlur',
      onDestroy: 'onDestroy',
    }

    const key = callbackMap[hook]
    if (key && this.options[key]) {
      this.options[key]({ editor: this, ...extra })
    }
  }

  // ========================================================================
  // Content
  // ========================================================================

  getHTML() {
    const div = document.createElement('div')
    const serializer = DOMSerializer.fromSchema(this.schema)
    serializer.serializeFragment(this.state.doc.content, { document }, div)
    return div.innerHTML
  }

  getJSON() {
    return this.state.doc.toJSON()
  }

  getText() {
    return this.state.doc.textContent
  }

  setContent(content) {
    let doc
    if (typeof content === 'string') {
      const temp = document.createElement('div')
      temp.innerHTML = content
      doc = PMDOMParser.fromSchema(this.schema).parse(temp)
    } else {
      doc = this.schema.nodeFromJSON(content)
    }
    const tr = this.state.tr.replaceWith(0, this.state.doc.content.size, doc.content)
    this.view.dispatch(tr)
  }

  // ========================================================================
  // State
  // ========================================================================

  isEditable() {
    return this.options.editable !== false
  }

  setEditable(editable) {
    this.options.editable = editable
    this.view.update(this.view.props)
  }

  isEmpty() {
    const doc = this.state.doc
    return doc.childCount === 1
      && doc.firstChild.isTextblock
      && doc.firstChild.content.size === 0
  }

  isActive(name, attrs) {
    const { from, $from, to, empty } = this.state.selection

    // Check marks
    if (this.schema.marks[name]) {
      if (empty) {
        const markType = this.schema.marks[name]
        const storedMarks = this.state.storedMarks || $from.marks()
        return storedMarks.some(m => {
          if (m.type !== markType) return false
          if (attrs) return Object.entries(attrs).every(([key, val]) => m.attrs[key] === val)
          return true
        })
      }
      let found = false
      this.state.doc.nodesBetween(from, to, (node) => {
        if (found) return false
        if (node.marks.some(m => {
          if (m.type.name !== name) return false
          if (attrs) return Object.entries(attrs).every(([key, val]) => m.attrs[key] === val)
          return true
        })) {
          found = true
        }
      })
      return found
    }

    // Check nodes
    if (this.schema.nodes[name]) {
      const nodeType = this.schema.nodes[name]
      let found = false
      this.state.doc.nodesBetween(from, to, (node) => {
        if (found) return false
        if (node.type === nodeType) {
          if (attrs) {
            if (Object.entries(attrs).every(([key, val]) => node.attrs[key] === val)) found = true
          } else {
            found = true
          }
        }
      })
      return found
    }

    return false
  }

  // ========================================================================
  // Lifecycle
  // ========================================================================

  destroy() {
    if (this._isDestroyed) return
    this._isDestroyed = true
    this.fireLifecycle('onDestroy')
    this.view.destroy()
  }
}
