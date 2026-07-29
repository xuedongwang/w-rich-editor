import { NodeExtension } from '../Extension'
import { textblockTypeInputRule } from 'prosemirror-inputrules'

const DEFAULT_LEVELS = [1, 2, 3, 4, 5, 6]

function buildParsedConfig(levels) {
  const parseDOM = levels.map((level) => ({ tag: `h${level}`, attrs: { level } }))
  const inputRuleSpecs = levels.map((level) => {
    const regex = new RegExp(`^${'#'.repeat(level)}\\s$`)
    return { regex, attrs: { level } }
  })
  const shortcuts = {}
  levels.forEach((level) => {
    shortcuts[`Mod-Alt-${level}`] = (state, dispatch) => {
      const headingType = state.schema.nodes.heading
      if (!headingType) return false
      const { $from } = state.selection
      if (dispatch) dispatch(state.tr.setNodeMarkup($from.before(), headingType, { level }))
      return true
    }
  })
  return { parseDOM, inputRuleSpecs, shortcuts }
}

const defaultParsed = buildParsedConfig(DEFAULT_LEVELS)

const baseConfig = {
  name: 'heading',
  group: 'block',
  content: 'inline*',
  defining: true,
  attrs: { level: { default: 1 }, align: { default: null } },
  toDOM(node) {
    const attrs = {}
    if (node.attrs.align) {
      attrs.style = `text-align: ${node.attrs.align}`
    }
    return [`h${node.attrs.level}`, attrs, 0]
  },
  parseDOM: [
    ...DEFAULT_LEVELS.map((level) => ({
      tag: `h${level}`,
      getAttrs: (dom) => {
        const align = dom.style?.textAlign
        if (['center', 'right', 'justify'].includes(align)) {
          return { level, align }
        }
        return { level }
      },
    })),
  ],
  addCommands() {
    const levels = this.options?.levels || DEFAULT_LEVELS
    return {
      toggleHeading: (attrs) => (state, dispatch) => {
        const headingType = state.schema.nodes.heading
        const paragraphType = state.schema.nodes.paragraph
        if (!headingType || !paragraphType) return false
        if (!levels.includes(attrs.level)) return false
        const { $from } = state.selection
        if ($from.parent.type === headingType && $from.parent.attrs.level === attrs.level) {
          if (dispatch) dispatch(state.tr.setNodeMarkup($from.before(), paragraphType))
        } else {
          if (dispatch) dispatch(state.tr.setNodeMarkup($from.before(), headingType, attrs))
        }
        return true
      },
    }
  },
  addKeyboardShortcuts() {
    const levels = this.options?.levels || DEFAULT_LEVELS
    return buildParsedConfig(levels).shortcuts
  },
  addInputRules() {
    const levels = this.options?.levels || DEFAULT_LEVELS
    const specs = buildParsedConfig(levels).inputRuleSpecs
    return specs.map(({ regex, attrs }) =>
      textblockTypeInputRule(regex, this.editor.schema.nodes.heading, attrs),
    )
  },
}

export const Heading = {
  resolve() {
    return NodeExtension.resolve(baseConfig, { levels: DEFAULT_LEVELS })
  },
  configure(options = {}) {
    const levels = options.levels || DEFAULT_LEVELS
    const parseDOM = DEFAULT_LEVELS.filter(l => levels.includes(l)).map((level) => ({
      tag: `h${level}`,
      getAttrs: (dom) => {
        const align = dom.style?.textAlign
        if (['center', 'right', 'justify'].includes(align)) {
          return { level, align }
        }
        return { level }
      },
    }))
    return NodeExtension.resolve(
      { ...baseConfig, parseDOM },
      { levels },
    )
  },
}
