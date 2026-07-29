# CLAUDE.md — w-rich-editor 开发规范

## 项目概述

w-rich-editor 是一个基于 ProseMirror 的 Notion 风格 Block 富文本编辑器，设计为框架无关的可复用 npm 包。

## 技术栈

- **编辑器引擎:** ProseMirror（prosemirror-state / view / model / commands / inputrules / keymap / history / dropcursor / schema-list）
- **构建工具:** Vite 8
- **样式:** Tailwind CSS 4 + 自定义 CSS（`src/style.css`）
- **测试:** Vitest 4 + jsdom
- **语法高亮:** PrismJS
- **语言:** Plain JavaScript（非 TypeScript）
- **Node.js 版本:** ≥ 20.12（`node:util.styleText` 依赖）

## 运行命令

```bash
# 启动开发服务器
npm run dev

# 运行全部测试
npm test

# 监听模式
npm run test:watch

# 构建
npm run build
```

## 目录结构

```
src/
├── main.js                      # Playground 入口（工具栏 + 编辑器 + 状态栏）
├── style.css                    # Playground 专用样式（toolbar/statusbar）
└── editor/
    ├── index.js                 # 公共导出 barrel
    ├── Editor.js                # 核心 Editor 类
    ├── Extension.js             # Extension / NodeExtension / MarkExtension 基类
    ├── style.css                # 编辑器内部样式（容器/边框/聚焦/占位符）
    ├── content.css              # 业务内容样式（标题/列表/引用/代码/分隔线）
    └── extensions/              # 所有扩展实现
        ├── Document.js
        ├── Paragraph.js
        ├── Heading.js
        ├── BulletList.js
        ├── Blockquote.js
        ├── CodeBlock.js
        ├── Divider.js
        ├── Bold.js              # Mark
        ├── Italic.js            # Mark
        ├── Code.js              # Mark
        ├── TextAlign.js         # 通用 Extension
        ├── MarkdownPaste.js     # Markdown 粘贴解析
        ├── Image.js             # 图片节点 (NodeView)
        ├── ImageUpload.js       # 图片粘贴/拖拽上传
        ├── History.js
        └── DropCursor.js
tests/
├── helper.js                    # 测试工具函数
└── editor/
    ├── Editor.test.js
    ├── Extension.test.js
    └── extensions/              # 每个扩展对应一个测试文件
```

## 扩展系统架构

三种扩展类型：

| 类型 | 基类 | 用途 | 产出 |
|------|------|------|------|
| `node` | `NodeExtension` | 块级 / 行内节点 | `nodeSpec` |
| `mark` | `MarkExtension` | 行内标记（粗体、斜体等） | `markSpec` |
| `extension` | `Extension` | 通用插件（命令、快捷键） | 无 spec |

### 扩展创建模式

```js
import { NodeExtension } from '../Extension'

export const MyNode = NodeExtension.create({
  name: 'myNode',
  group: 'block',
  content: 'inline*',
  attrs: { myAttr: { default: null } },
  toDOM(node) {
    return ['div', { 'data-my-attr': node.attrs.myAttr }, 0]
  },
  parseDOM: [{
    tag: 'div[data-my-attr]',
    getAttrs: (dom) => ({ myAttr: dom.getAttribute('data-my-attr') }),
  }],

  // 可选钩子
  addCommands() { return { ... } },
  addKeyboardShortcuts() { return { ... } },
  addInputRules() { return [ ... ] },
  addProseMirrorPlugins() { return [ ... ] },
  onCreate() {},
  onUpdate() {},
  onDestroy() {},
})
```

### 扩展解析链

1. `MyExt.resolve()` 或 `MyExt.configure({ options })` → 产生 resolved 对象
2. `Editor` 构造器为每个 resolved 绑定 `editor` 引用
3. `createSchema()` 收集 `nodeSpec` / `markSpec` → 创建 ProseMirror `Schema`
4. `collectCommands()` 调用每个扩展的 `addCommands()` → 合并到 `commandsMap`
5. `createView()` → `collectPlugins()` 收集插件、输入规则、快捷键

## 新增扩展的标准流程

### 1. Mark 扩展（如 Bold、Italic、Underline）

**文件:** `src/editor/extensions/<Name>.js`

```js
import { MarkExtension } from '../Extension'
import { toggleMark } from 'prosemirror-commands'
import { InputRule } from 'prosemirror-inputrules'

export const MyMark = MarkExtension.create({
  name: 'myMark',
  parseDOM: [
    { tag: 'tagname' },
    { style: 'css-property', getAttrs: (v) => /* 返回 true/attrs 或 false */ },
  ],
  toDOM: () => ['tagname', 0],

  addCommands() {
    return {
      toggleMyMark: () => (state, dispatch) => {
        const markType = state.schema.marks.myMark
        if (!markType) return false
        return toggleMark(markType)(state, dispatch)
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-key': (state, dispatch) => {
        const m = state.schema.marks.myMark
        return m ? toggleMark(m)(state, dispatch) : false
      },
    }
  },

  addInputRules() {
    return [new InputRule(/regex$/, (state, match, start, end) => {
      const markType = state.schema.marks.myMark
      if (!markType) return null
      const text = match[1]
      return state.tr.delete(start, end).insertText(text, start)
        .addMark(start, start + text.length, markType.create())
    })]
  },
})
```

### 2. 节点扩展（如 Paragraph、Heading）

直接在已有节点上修改，或创建新节点。**注意:** `toDOM` 必须接收 `node` 参数。

```js
toDOM(node) {
  const attrs = {}
  if (node.attrs.someAttr) attrs.someAttr = node.attrs.someAttr
  return ['tag', attrs, 0]
}
```

### 3. 通用 Extension（如 TextAlign、History）

```js
import { Extension } from '../Extension'

export const MyExt = Extension.create({
  name: 'myExt',
  addCommands() { return { ... } },
  addKeyboardShortcuts() { return { ... } },
})
```

### 4. 带 NodeView 的原子节点（如 Image）

原子节点（atom node）使用自定义 NodeView 来控制渲染和交互：

```js
import { NodeExtension } from '../Extension'

class MyNodeView {
  constructor(node, view, getPos) {
    this.dom = document.createElement('div')
    // 构建 DOM 结构...
    this.update(node)
  }
  update(node) { /* 响应属性变化更新 DOM */ }
  stopEvent() { return false }
  ignoreMutation() { return true }  // 原子节点必须返回 true
  destroy() {}
}

export const MyNode = NodeExtension.create({
  name: 'myNode',
  group: 'block',
  atom: true,           // 不可分割的编辑单元
  selectable: true,     // 可点击选中
  draggable: true,      // 可拖拽排序
  attrs: { myAttr: { default: null } },
  toDOM(node) { /* 序列化用 */ },
  parseDOM: [{ tag: 'my-tag', getAttrs: (dom) => ({ ... }) }],
  addCommands() { return { ... } },
  addNodeViews() {
    return { myNode: (node, view, getPos) => new MyNodeView(node, view, getPos) }
  },
})
```

**关键：** NodeView 需要在 `Editor.js` 的 `collectNodeViews()` 中收集，通过 `EditorView` 的 `nodeViews` prop 传入。`Extension.js` 的 `buildResolved` 已支持 `_addNodeViews` 钩子。

### 5. 注册步骤

每个新扩展必须完成以下所有步骤：

| 步骤 | 文件 | 操作 |
|------|------|------|
| ① | `src/editor/extensions/<Name>.js` | 创建扩展文件 |
| ② | `src/editor/index.js` | 添加 `export` 语句 |
| ③ | `src/main.js` | import → `extensions` 数组 → 工具栏按钮/控件 |
| ④ | `tests/helper.js` | 添加到 `DEFAULT_EXTENSIONS`（如果是核心功能） |
| ⑤ | `tests/editor/extensions/<Name>.test.js` | 编写完备测试 |
| ⑥ | `src/style.css` | 添加相关 CSS 样式 |

## 测试规范

### 测试文件命名

- 每个扩展对应一个测试文件：`tests/editor/extensions/<Name>.test.js`
- 测试文件结构必须与扩展文件一一对应

### 测试用例组织（5 个 describe 块）

每个扩展测试**必须**包含以下分类（如适用）：

```js
describe('<Name> 扩展定义', () => { ... })      // name、type、toDOM、parseDOM
describe('<Name> 命令', () => { ... })           // 命令功能、参数校验、边界情况
describe('<Name> 键盘快捷键', () => { ... })      // 快捷键触发与效果
describe('<Name> 输入规则', () => { ... })        // 规则数量、正则匹配
describe('<Name> 活动状态检测', () => { ... })     // isActive 检测
```

### 测试工具函数

```js
import { createEditor, setCursor, selectRange, cleanup } from '../../helper.js'

let editor
beforeEach(() => { document.body.innerHTML = '' })
afterEach(() => { cleanup(editor) })

// 创建默认编辑器
editor = createEditor()

// 带初始内容
editor = createEditor({ content: '<p>Hello</p>' })

// 设置光标位置
setCursor(editor, pos)

// 选择文本范围
selectRange(editor, from, to)
```

### 测试覆盖要求

- **命令测试:** 正向操作 + 反向操作 + 空文档 + 无效参数
- **快捷键测试:** 每个快捷键的触发效果
- **HTML 序列化:** toDOM 输出正确性（有/无属性）
- **HTML 解析:** parseDOM 从 HTML 正确还原属性
- **状态检测:** isActive 在各状态下的返回值
- **边界情况:** 多块选区、属性保留（marks、其他 attrs）、连续操作

## 关键编码规范

### ProseMirror 事务 (Transaction) 使用

⚠️ **极其重要:** `state.tr` 每次访问都创建**新的事务对象**。在循环中必须复用同一事务：

```js
// ❌ 错误 — 每次循环创建新事务，只有最后一次修改生效
for (const { node, pos } of items) {
  state.tr.setNodeMarkup(pos, null, newAttrs)  // 每次都是新事务！
}
dispatch(state.tr)  // 这是又一个新事务

// ✅ 正确 — 复用同一事务
let tr = state.tr
for (const { node, pos } of items) {
  tr = tr.setNodeMarkup(pos, null, newAttrs)
}
dispatch(tr)
```

### parseDOM 规则注意事项

- **节点规则必须包含 `tag` 属性** — 没有 `tag` 的规则会被当作 **Mark 规则**处理，导致运行时错误
- 如需根据样式设置节点属性，使用 `tag` + `getAttrs` 组合：

```js
// ❌ 错误 — 纯 style 规则仅用于 Mark
parseDOM: [{ style: 'text-align', getAttrs: (v) => ({ align: v }) }]

// ✅ 正确 — tag + getAttrs 读取 style
parseDOM: [{
  tag: 'p',
  getAttrs: (dom) => {
    const align = dom.style?.textAlign
    if (['center', 'right', 'justify'].includes(align)) return { align }
    return {}
  },
}]
```

### 命名约定

- 扩展名: `camelCase`（如 `textAlign`、`codeBlock`）
- 命令名: `动词 + 名词`（如 `toggleBold`、`setTextAlign`、`toggleHeading`）
- 快捷键: `Mod-键`（跨平台，Mac 上为 Cmd，其他为 Ctrl）
- CSS 类: `.ProseMirror` 前缀 + 语义化类名
- 测试描述: 中文，清晰描述预期行为

### 命令返回值约定

- 命令返回 `true` 表示操作成功（即使文档未变）
- 命令返回 `false` 表示操作失败（参数无效、schema 不存在等）
- 如果目标属性已经是目标值，返回 `false`（避免无意义的事务）

### setNodeMarkup 使用

```js
// 修改节点属性，保留节点类型和内容
tr.setNodeMarkup(pos, null, { ...node.attrs, newAttr: value })

// 第一个参数: 位置（节点起始位置）
// 第二个参数: null 表示保持原类型
// 第三个参数: 新的完整属性对象（必须包含所有属性）
```

### isActive 检测

```js
// Mark 检测
editor.isActive('bold')                           // 是否有 bold 标记
editor.isActive('bold', { class: 'highlight' })   // 是否有特定属性的 bold

// Node 检测
editor.isActive('paragraph')                      // 是否在段落中
editor.isActive('paragraph', { align: 'center' }) // 是否在居中段落中
editor.isActive('heading', { level: 2 })          // 是否在 H2 中
```

## 工具栏规范

### 按钮创建

```js
// 基础按钮
toolbar.appendChild(btn('B', 'toggleBold', null, '加粗 Mod+B'))

// 带属性检测的按钮
toolbar.appendChild(btn('H1', 'toggleHeading', { level: 1 }, '标题 1'))

// 下拉选择器（用于多项选择）
const select = document.createElement('select')
select.id = 'xxx-select'
select.innerHTML = `<option value="...">...</option>`
select.addEventListener('change', () => {
  editor.commands.xxx?.({ value: select.value })
  editor.view.focus()
})
toolbar.appendChild(select)
```

### 工具栏状态更新

- 所有 `[data-command]` 按钮的 active 状态由 `updateToolbarState` 自动处理
- 特殊的非命令型控件（如下拉选择器）需要单独编写更新函数
- 更新函数必须在 `onUpdate` 和 `onSelectionUpdate` 回调中调用

## CSS 规范

### 文件分层

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/editor/style.css` | 编辑器内部 | 容器边框、聚焦状态、占位符 |
| `src/editor/content.css` | 业务内容 | 标题/列表/引用/代码/分隔线/对齐 |
| `src/editor/extensions/*.css` | 扩展内部 | 图片 loading/错误/resize、代码块行号等 |
| `src/style.css` | Playground | toolbar、status bar（仅演示用） |

### 编写规范

- 业务内容样式以 `.w-rich-editor` 为前缀（用户可覆盖）
- 编辑器内部样式以 `.w-rich-editor` 为前缀
- 扩展组件样式（wrapper/button/overlay）不加前缀，避免冲突
- 使用属性选择器匹配动态样式: `.w-rich-editor [style*="text-align: center"]`
- 颜色变量参考 Tailwind 默认色板

### 外部样式覆盖

用户通过 `classNames` 选项注入自定义 CSS 类：
```js
new Editor({ classNames: 'my-theme' })
```
```css
.my-theme h1 { color: purple; }
.my-theme pre.code-block { background: #2d2d2d; }
```

## 剪贴板 & 粘贴处理

### ProseMirror 粘贴机制

ProseMirror 粘贴事件的完整处理链：

```
用户粘贴 → doPaste(view, text, html, preferPlain, event)
  ├─ 1. 所有 plugin.handlePaste() 依次调用（返回 true 则中断）
  ├─ 2. 如果有 text/html → clipboardParser (DOMParser) 解析 HTML
  └─ 3. 如果纯文本 → clipboardTextParser 或默认按换行拆段
```

### 关键区别：InputRule 不响应粘贴

`prosemirror-inputrules` 的 `InputRule` 仅在 `handleTextInput` 钩子中触发，只对**键盘输入**生效。**粘贴走的是 `parseFromClipboard` 路径，不触发 InputRule。** 所以需要单独的粘贴处理逻辑。

### MarkdownPaste 扩展

`MarkdownPaste` 扩展通过 `Plugin.props.handlePaste` 拦截纯文本粘贴：

```js
new Plugin({
  props: {
    handlePaste(view, event, slice) {
      // 1. HTML 粘贴 → 放行，让浏览器/ProseMirror 原生处理
      if (event.clipboardData?.types?.includes('text/html')) return false

      // 2. 纯文本 → 检测是否为 Markdown
      const text = event.clipboardData?.getData('text/plain')
      if (!text || !isMarkdown(text)) return false

      // 3. 解析 Markdown → ProseMirror Fragment → 插入
      const fragment = parseMarkdown(view.state.schema, text)
      view.dispatch(view.state.tr.replaceSelection(new Slice(fragment, 0, 0)))
      return true  // 阻止默认处理
    },
  },
})
```

### 支持的 Markdown 语法

**块级:**
- `# ` ~ `###### ` → Heading (H1-H6)
- `- ` / `* ` / `+ ` → 无序列表
- `1. ` → 有序列表
- `> ` → 引用块
- ` ``` ` → 代码块（支持语言标记）
- `---` → 分割线

**行内:**
- `**text**` → Bold
- `*text*` → Italic
- `` `code` `` → Code

### 编写粘贴处理扩展的规范

1. **必须区分 HTML 和纯文本**：HTML 粘贴通常不需要拦截
2. **`handlePaste` 返回 `true`** 阻止后续处理，返回 `false` 放行
3. **使用 `Slice(fragment, 0, 0)`** 包装 Fragment，让 ProseMirror 自动处理内容匹配
4. **检测函数要保守**：宁可漏判（当普通文本粘贴）也不要误判（把普通文本当 Markdown 解析）
5. **导出解析函数**：便于单独测试，不依赖 DOM 事件

## 图片上传扩展

### ImageUpload 配置模式

ImageUpload 使用 `Extension.configure()` 传入完整配置。配置通过 `options` 对象传递给插件：

```js
ImageUpload.configure({
  // 允许的图片格式 (MIME types)
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],

  // 上传方式三选一（优先级从高到低）：
  // 1. 自定义上传函数（最灵活）
  uploader: async (file) => { /* 返回 { src, alt?, title? } */ },
  // 2. HTTP 上传
  uploadUrl: '/api/upload', uploadHeaders: {}, uploadFieldName: 'file',
  // 3. Base64 内嵌
  useBase64: true,

  // 上传前处理钩子（压缩、水印等由使用者在钩子中实现）
  onBeforeUpload: async (file) => {
    // 返回 File/Blob 替换上传文件，返回 void/其他使用原始文件
    return compressedFile
  },

  // 回调
  onSuccess: (file, result) => {},
  onError: (file, error) => {},
})
```

### 上传管线流程

```
粘贴/拖拽图片 → 过滤 MIME → 创建 Object URL 占位 → 加载原始尺寸 → 插入 Image 节点(uploading)
    → onBeforeUpload 钩子（用户自行处理压缩/水印等）
    → 上传/uploader/base64
    → 成功：更新 src, 移除 loading
    → 失败：显示错误覆盖层, 调用 onError
```

### 关键设计决策

- **`Extension.configure()` vs `resolve()`**：`Extension.configure()` 直接返回已解析对象（无 `.resolve()` 方法），`NodeExtension.configure()` 返回可再次 `.resolve()` 的对象
- **NodeView `ignoreMutation()`**：原子节点（atom）必须返回 `true`，阻止 ProseMirror 尝试修改 DOM
- **插件优先级**：ImageUpload 必须在 MarkdownPaste 之前注册，确保图片粘贴优先于文本解析

## 新增功能的完整检查清单

- [ ] 扩展文件创建（`src/editor/extensions/<Name>.js`）
- [ ] barrel 导出（`src/editor/index.js`）
- [ ] Playground 注册（`src/main.js`：import + extensions + 工具栏）
- [ ] 测试辅助注册（`tests/helper.js` 的 `DEFAULT_EXTENSIONS`，如需要）
- [ ] 测试文件编写（`tests/editor/extensions/<Name>.test.js`）
- [ ] CSS 样式添加（`src/style.css`）
- [ ] 全部测试通过（`npm test`）
- [ ] 手动验证 Playground 功能正常（`npm run dev`）
