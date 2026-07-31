/**
 * Icon rendering utilities using Lucide.
 *
 * Lucide icons are defined as arrays of SVG element specs.
 * `createElement` wraps them in a proper <svg> container.
 */

import {
  createElement,
  GripVertical,
  Sparkles,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  Minus,
  ImagePlus,
  Pilcrow,
  PenLine,
  FileText,
  Languages,
  SlidersHorizontal,
  Loader2,
} from 'lucide'

/**
 * Render a Lucide icon as an inline SVG element.
 *
 * @param {Array} iconNode - Lucide icon definition array
 * @param {object} [attrs] - Additional SVG attributes (width, height, class, etc.)
 * @returns {SVGElement}
 */
export function renderIcon(iconNode, attrs = {}) {
  return createElement(iconNode, {
    width: '16',
    height: '16',
    'stroke-width': '2',
    fill: 'none',
    stroke: 'currentColor',
    'aria-hidden': 'true',
    ...attrs,
  })
}

// ============================================================================
// Pre-baked icon helpers for each feature
// ============================================================================

export function gripIcon() {
  return renderIcon(GripVertical, { width: '14', height: '14', class: 'icon-grip' })
}

export function sparklesIcon(attrs = {}) {
  return renderIcon(Sparkles, { width: '16', height: '16', ...attrs })
}

export function paragraphIcon() {
  return renderIcon(Pilcrow, { width: '16', height: '16' })
}

export function headingIcon(level) {
  const icons = { 1: Heading1, 2: Heading2, 3: Heading3 }
  return renderIcon(icons[level] || Heading1, { width: '16', height: '16' })
}

export function bulletListIcon() {
  return renderIcon(List, { width: '16', height: '16' })
}

export function orderedListIcon() {
  return renderIcon(ListOrdered, { width: '16', height: '16' })
}

export function taskListIcon() {
  return renderIcon(ListChecks, { width: '16', height: '16' })
}

export function quoteIcon() {
  return renderIcon(Quote, { width: '16', height: '16' })
}

export function codeIcon() {
  return renderIcon(Code, { width: '16', height: '16' })
}

export function dividerIcon() {
  return renderIcon(Minus, { width: '16', height: '16' })
}

export function imageIcon() {
  return renderIcon(ImagePlus, { width: '16', height: '16' })
}

export function improveIcon() {
  return renderIcon(PenLine, { width: '16', height: '16' })
}

export function summarizeIcon() {
  return renderIcon(FileText, { width: '16', height: '16' })
}

export function translateIcon() {
  return renderIcon(Languages, { width: '16', height: '16' })
}

export function toneIcon() {
  return renderIcon(SlidersHorizontal, { width: '16', height: '16' })
}

export function loadingIcon() {
  return renderIcon(Loader2, { width: '16', height: '16', class: 'icon-spin' })
}
