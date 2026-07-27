// ============================================================================
// Helper: store raw functions (no bind) — Editor sets _editor on instance
// ============================================================================

function buildResolved(config, options, type, extraSpec) {
  const resolved = {
    type,
    name: config.name,
    options,
    _editor: null, // set by Editor after construction

    // Raw functions — called with .call(resolved) or with this === resolved
    _addCommands: config.addCommands || undefined,
    _addKeyboardShortcuts: config.addKeyboardShortcuts || undefined,
    _addInputRules: config.addInputRules || undefined,
    _addProseMirrorPlugins: config.addProseMirrorPlugins || undefined,

    // Lifecycle hooks
    _onCreate: config.onCreate || undefined,
    _onUpdate: config.onUpdate || undefined,
    _onSelectionUpdate: config.onSelectionUpdate || undefined,
    _onFocus: config.onFocus || undefined,
    _onBlur: config.onBlur || undefined,
    _onDestroy: config.onDestroy || undefined,

    ...extraSpec,
  }

  return resolved
}

// ============================================================================
// NodeExtension
// ============================================================================

export class NodeExtension {
  static type = 'node'

  static create(config) {
    return {
      configure(options = {}) {
        return NodeExtension.resolve(config, options)
      },
      resolve() {
        return NodeExtension.resolve(config, {})
      },
    }
  }

  static resolve(config, options) {
    const nodeSpec = {}
    if (config.group) nodeSpec.group = config.group
    if (config.content) nodeSpec.content = config.content
    if (config.inline !== undefined) nodeSpec.inline = config.inline
    if (config.atom) nodeSpec.atom = config.atom
    if (config.selectable !== undefined) nodeSpec.selectable = config.selectable
    if (config.draggable !== undefined) nodeSpec.draggable = config.draggable
    if (config.defining) nodeSpec.defining = config.defining
    if (config.isolating) nodeSpec.isolating = config.isolating
    if (config.code) nodeSpec.code = config.code
    if (config.marks !== undefined) nodeSpec.marks = config.marks
    if (config.attrs) nodeSpec.attrs = config.attrs
    if (config.toDOM) nodeSpec.toDOM = config.toDOM
    if (config.parseDOM) nodeSpec.parseDOM = config.parseDOM

    return buildResolved(config, options, 'node', { nodeSpec })
  }
}

// ============================================================================
// MarkExtension
// ============================================================================

export class MarkExtension {
  static type = 'mark'

  static create(config) {
    return {
      configure(options = {}) {
        return MarkExtension.resolve(config, options)
      },
      resolve() {
        return MarkExtension.resolve(config, {})
      },
    }
  }

  static resolve(config, options) {
    const markSpec = {}
    if (config.inclusive !== undefined) markSpec.inclusive = config.inclusive
    if (config.excludes !== undefined) markSpec.excludes = config.excludes
    if (config.attrs) markSpec.attrs = config.attrs
    if (config.toDOM) markSpec.toDOM = config.toDOM
    if (config.parseDOM) markSpec.parseDOM = config.parseDOM

    return buildResolved(config, options, 'mark', { markSpec })
  }
}

// ============================================================================
// Extension (general)
// ============================================================================

export class Extension {
  static type = 'extension'

  static create(config) {
    return {
      configure(options = {}) {
        return Extension.resolve(config, options)
      },
      resolve() {
        return Extension.resolve(config, {})
      },
    }
  }

  static resolve(config, options) {
    return buildResolved(config, options, 'extension', {})
  }
}
