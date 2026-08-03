# w-rich-editor — 基于 ProseMirror 的 Notion 风格 Block 编辑器

## 项目简介

一个 **Notion 风格的 Block 富文本编辑器**，以 **可复用的 npm 包** 发布，框架无关，任何框架均可集成。

- **编辑引擎**：ProseMirror
- **协同引擎**：Yjs + y-prosemirror（CRDT）
- **样式方案**：Tailwind CSS + CSS Variables
- **构建工具**：Vite + tsup
- **语言**：TypeScript (strict)

---

## Monorepo 包结构

```
@w-rich-editor/core            — 核心编辑器（框架无关）
@w-rich-editor/starter-kit     — 预设扩展包（常用 blocks + marks）
@w-rich-editor/markdown        — Markdown 导入/导出/快捷键
@w-rich-editor/collaboration   — 协同编辑插件
@w-rich-editor/ai              — AI 功能插件
@w-rich-editor/react           — React 框架适配器（独立子包）
@w-rich-editor/vue             — Vue 框架适配器（独立子包）
```

---

## 核心 API 设计（草案）

```ts
import { Editor } from '@w-rich-editor/core'
import { StarterKit } from '@w-rich-editor/starter-kit'
import { Collaboration } from '@w-rich-editor/collaboration'
import { AI } from '@w-rich-editor/ai'

const editor = new Editor({
  target: document.querySelector('#editor'),
  content: '<p>Hello world</p>',
  extensions: [
    StarterKit,
    Collaboration.configure({ provider: 'websocket', url: 'ws://...' }),
    AI.configure({ provider: 'openai', apiKey: '...' }),
  ],
  theme: 'light',
  editable: true,
  onUpdate: ({ editor }) => { ... },
})

editor.getHTML() / editor.getJSON() / editor.getMarkdown()
editor.chain().toggleBold().setHeading({ level: 1 }).focus().run()
editor.destroy()
```

---

## 功能清单（P0 = MVP / P1 = 重要 / P2 = 锦上添花）

### A. 核心 Block 类型（Nodes）

| 优先级 | Block | ProseMirror | 说明 |
|---|---|---|---|
| **P0** | Paragraph | `NodeSpec: paragraph` | 默认 Block，支持所有 inline marks |
| **P0** | Heading (H1-H3) | `NodeSpec: heading` (attrs: level) | 三级标题 |
| **P0** | BulletList + ListItem | `NodeSpec: bullet_list > list_item` | 无序列表，支持多级嵌套 |
| **P0** | OrderedList + ListItem | `NodeSpec: ordered_list > list_item` | 有序列表，支持多级嵌套 |
| **P0** | Blockquote | `NodeSpec: blockquote` | 引用块 |
| **P0** | CodeBlock | `NodeSpec: code_block` (attrs: language) | 代码块，支持语言标记 |
| **P0** | Divider | `NodeSpec: horizontal_rule` | 分割线 |
| **P1** | TaskList + TaskItem | `NodeSpec: task_list > task_item` (attrs: checked) | 带 checkbox 的待办列表 |
| **P1** | Image | `NodeSpec: image` (attrs: src, alt, width, align) | 图片（上传/URL/拖拽/调整大小） |
| **P1** | Table | `NodeSpec: table > table_row > table_cell` | 表格（合并单元格、拖拽行列） |
| **P2** | Callout | `NodeSpec: callout` | 提示框（图标+背景色） |
| **P2** | Toggle / Details | `NodeSpec: toggle` | 折叠/展开块 |
| **P2** | Table of Contents | `NodeSpec: toc` | 根据标题自动生成目录 |
| **P2** | Embed | `NodeSpec: embed` (attrs: provider, src) | 嵌入 YouTube/Twitter 等 |
| **P2** | Mention | `NodeSpec: mention` (attrs: id, label) | @提及用户/文档 |
| **P2** | Math / LaTeX | `NodeSpec: math_block` | 数学公式（KaTeX） |
| **P2** | Audio | `NodeSpec: audio` (attrs: src, title) | 音频插入（上传/URL，带播放控件） |
| **P2** | Video | `NodeSpec: video` (attrs: src, poster) | 视频播放块 |

### B. 行内格式（Marks）

| 优先级 | Mark | 快捷键 |
|---|---|---|
| **P0** | Bold | Mod+B |
| **P0** | Italic | Mod+I |
| **P0** | Code | Mod+\` |
| **P1** | Underline | Mod+U |
| **P1** | Strikethrough | Mod+Shift+S |
| **P1** | Link | Mod+K |
| **P1** | Highlight | Mod+Shift+H |
| **P1** | TextColor / HighlightColor | 颜色选择器 |
| **P1** | FontFamily 字体 | 字体选择器（如 Serif / Sans / Mono / 自定义字体列表） |
| **P1** | FontSize 字号 | 字号选择器 |
| **P2** | Subscript / Superscript | 上标/下标 |

### C. Block 操作

| 优先级 | 功能 | 说明 |
|---|---|---|
| **P0** | Enter 新建块 | 在块末尾 Enter 创建新块 |
| **P0** | Shift+Enter 软换行 | 块内 `<br>` 换行 |
| **P0** | Backspace 删除/合并 | 空行删除块，行首合并到上一块 |
| **P0** | Tab / Shift+Tab | 列表缩进/反缩进 |
| **P0** | Undo / Redo | history 插件 |
| **P1** | 拖拽排序 | 拖拽手柄改变块顺序 |
| **P1** | Block 类型转换 | 段落→标题、列表→引用等 |
| **P1** | 块级多选 | Shift+Click / 拖选多个块 |
| **P2** | 块嵌套（子块） | 拖入另一个块形成层级 |
| **P2** | 块对齐 | 左/中/右对齐 |

### D. Notion 风格 UX

| 优先级 | 功能 | 说明 |
|---|---|---|
| **P0** | 斜杠命令菜单 `/` | 输入 `/` 弹出命令面板，搜索+键盘导航 |
| **P0** | 拖拽手柄 | 悬停 Block 左侧显示 `⋮⋮`，可拖拽排序 |
| **P0** | 浮动工具栏（Bubble Menu） | 选中文本时浮出格式工具栏 |
| **P0** | 占位文本 | 空块显示 "Type '/' for commands..." |
| **P1** | 顶部工具栏 | 固定在编辑器上方，展示当前格式状态 |
| **P1** | 块类型转换菜单 | 拖拽手柄旁弹出快速转换菜单 |
| **P2** | 快捷搜索 Cmd+K | 全文搜索、跳转到指定块 |
| **P2** | 面包屑导航 | 嵌套块显示层级路径 |

### E. Markdown 功能

| 优先级 | 功能 | 规则 |
|---|---|---|
| **P0** | `#` / `##` / `###` | → H1/H2/H3 |
| **P0** | `- ` / `* ` | → 无序列表 |
| **P0** | `1. ` | → 有序列表 |
| **P0** | `> ` | → Blockquote |
| **P0** | ` ``` ` | → CodeBlock |
| **P0** | `---` | → Divider |
| **P0** | `**bold**` / `*italic*` / `` `code` `` | → Bold/Italic/Code mark |
| **P1** | `- [ ]` / `- [x]` | → TaskList |
| **P1** | `~~strikethrough~~` | → Strikethrough mark |
| **P1** | 粘贴 Markdown 文本 | → 自动解析为对应 Block |
| **P1** | 导出 Markdown | 编辑器内容 → Markdown 文本 |

### F. 协作编辑（Yjs）

| 优先级 | 功能 | 说明 |
|---|---|---|
| **P0** | Yjs 文档同步 | y-prosemirror 实现多人实时同步 |
| **P0** | WebSocket Provider | y-websocket 连接协同服务器 |
| **P0** | 光标感知 (Awareness) | 显示其他用户光标位置和选区 |
| **P1** | 用户彩色光标 | 每个用户不同颜色+用户名标签 |
| **P1** | 在线用户列表 | 当前在线用户头像 |
| **P1** | WebRTC Provider | P2P 协同（无需服务器） |
| **P1** | IndexedDB 持久化 | 离线编辑+本地持久化 |
| **P2** | 评论/批注系统 | 选中文本添加评论、回复、解决 |
| **P2** | 版本历史（协同版） | 协同场景下的版本追踪（基础版本历史见 K 模块） |
| **P2** | 版本 Diff | 版本间差异可视化 |
| **P2** | 权限控制 | 只读/编辑/评论权限分级 |

### G. AI 辅助

| 优先级 | 功能 | 说明 |
|---|---|---|
| **P0** | AI 命令面板 | Ctrl+J 或 `/ai` 呼出 AI 操作面板 |
| **P0** | 继续写作 | 光标处基于上下文自动续写（流式） |
| **P0** | 选中文本 → AI 操作 | 选中后弹出 AI 操作菜单 |
| **P1** | AI 改写 | 更正式/更简洁/更生动 |
| **P1** | AI 翻译 | 翻译为目标语言 |
| **P1** | AI 摘要 | 为选中文本生成摘要 |
| **P1** | AI 扩写 | 扩展选中文本内容 |
| **P1** | AI 流式输出 | 打字机效果的流式文本插入 |
| **P2** | AI 纠错 | 修复语法和拼写错误 |
| **P2** | AI 语气转换 | 专业/友好/幽默 |
| **P2** | AI 自定义指令 | 用户自由指令处理文本 |
| **P2** | AI Provider 抽象 | 支持 OpenAI / Claude / 自定义端点 |

### H. 插件系统 & 包架构

| 优先级 | 功能 | 说明 |
|---|---|---|
| **P0** | Extension 基类 | name, type, addOptions, addSchema, addPlugins, addNodeViews, addInputRules, addCommands, addKeyboardShortcuts |
| **P0** | NodeExtension / MarkExtension | 定义新 Block/Mark 的扩展基类 |
| **P0** | `.configure(options)` | 扩展级别配置 |
| **P0** | 链式命令 API | `editor.chain().cmd1().cmd2().run()` |
| **P0** | 事件系统 | `editor.on('update'/'focus'/'blur'/'destroy', cb)` |
| **P1** | 扩展优先级 `priority` | 控制加载顺序 |
| **P1** | 动态注册/注销插件 | 运行时管理扩展 |
| **P1** | 生命周期钩子 | onBeforeCreate, onCreate, onUpdate 等 |

### I. 主题与样式

| 优先级 | 功能 | 说明 |
|---|---|---|
| **P0** | CSS Variables 主题系统 | 颜色、字体、间距通过 CSS 变量定义 |
| **P0** | Light / Dark 主题 | 内置 `data-theme="light"` / `"dark"` |
| **P1** | 自定义主题覆盖 | 用户覆盖 CSS 变量自定义外观 |
| **P1** | CSS 类名前缀 | 避免样式冲突 |
| **P2** | Headless 模式 | 纯逻辑无样式导出 |

### J. 字数统计 & 文档信息

| 优先级 | 功能 | 说明 |
|---|---|---|
| **P0** | 字数统计 | 实时显示总字数（中文按字、英文按词） |
| **P0** | 字符数统计 | 含空格/不含空格两种字符计数 |
| **P1** | 选区字数统计 | 选中文本时显示选区字数 |
| **P1** | 段落数 / Block 数 | 统计文档段落和 Block 数量 |
| **P1** | 阅读时间估算 | 根据字数估算阅读时长（如"约 3 分钟"） |
| **P2** | 统计面板 UI | 编辑器底部状态栏展示统计信息，可点击展开详情 |

### K. 版本历史

| 优先级 | 功能 | 说明 |
|---|---|---|
| **P1** | 自动保存快照 | 按时间间隔或操作批次自动保存文档版本 |
| **P1** | 手动保存版本 | 用户主动创建命名版本快照 |
| **P1** | 版本列表 | 侧边栏展示版本时间线（时间、作者、摘要） |
| **P1** | 版本预览 | 点击版本查看该时刻的文档内容 |
| **P1** | 版本回滚 | 恢复到任意历史版本 |
| **P2** | 版本 Diff 对比 | 两个版本之间的差异可视化（增/删/改高亮） |
| **P2** | 版本命名 & 标签 | 给重要版本加名称和标签 |
| **P2** | 版本比较选择 | 选择任意两个版本进行对比 |
| **P2** | 版本存储配置 | 本地存储 / 远程存储（API 上传） |

### L. 开发者体验

| 优先级 | 功能 | 说明 |
|---|---|---|
| **P0** | Playground 演示 | 本地开发用 demo 应用 |
| **P0** | TypeScript 全量类型 | 导出 `.d.ts` 类型声明 |
| **P1** | 示例代码集 | 基础/协同/AI/自定义块示例 |
| **P1** | API 文档 | TSDoc + TypeDoc 生成文档站 |
| **P2** | Vitest 单元测试 | 核心逻辑覆盖 |
| **P2** | Playwright E2E 测试 | 编辑器交互场景 |

---

## ProseMirror 映射关系

| 编辑器概念 | ProseMirror 对应 |
|---|---|
| Block Type | `NodeSpec` + `NodeView`（复杂块） |
| Inline Mark | `MarkSpec` |
| 斜杠菜单 | `Plugin` (view + props) |
| 浮动工具栏 | `Plugin.view` (监听 selection) |
| Markdown 快捷键 | `InputRule` |
| 拖拽排序 | `Plugin` (DOM 事件) + `dropCursor` |
| 命令 | `Command` 函数 `(state, dispatch) => boolean` |
| 协同编辑 | `y-prosemirror` 的 `ySyncPlugin` |
| 光标感知 | `y-protocols/awareness` + `Decoration` |
| 内容序列化 | `DOMSerializer` / `DOMParser` |
| 剪贴板 | `clipboardSerializer` / `clipboardParser` |
| 键盘快捷键 | `keymap` Plugin |

---

## 实施路径

| 阶段 | 目标 | 包含功能 |
|---|---|---|
| **Phase 1** | 基础编辑器可用 | P0 Block/Marks + 基础操作 + Undo/Redo + Extension 系统 + Playground |
| **Phase 2** | Notion UX 成型 | 斜杠菜单 + 浮动工具栏 + 顶部工具栏 + 拖拽手柄 + 占位文本 |
| **Phase 3** | Markdown & 增强 Block | Input Rules + 图片增强 + 表格 + Markdown 导入导出 |
| **Phase 4** | 主题 & 排版 | CSS Variables + Light/Dark + FontFamily/FontSize + 可定制主题 |
| **Phase 5** | 协作 & 版本 | Yjs + 光标感知 + Provider 抽象 + 版本历史 + 字数统计 |
| **Phase 6** | AI 辅助 | AI Provider + 命令面板 + 流式输出 |
| **Phase 7** | 完整产品 | 高级 Block（Audio/Video/Callout 等）+ 评论 + 框架适配器 + 文档 + 测试 |

---

## 验证方式

1. `npm run dev` 启动 Playground，在浏览器中验证编辑器功能
2. 每个 Phase 完成后进行手动功能测试
3. Phase 7 引入 Vitest 单元测试 + Playwright E2E 测试
4. `npm run build` 确认包可正确构建和导出


// sk-9908f853f5a84941b0b3984646baace4