# 架构

[English](architecture.md) | [中文](architecture.zh-CN.md)

## 目标

Use Browser Priview 不是“某一个编辑器的小扩展”，而是一个独立产品。

它的架构目标是：无论从哪个入口触发，最终都进入同一套浏览器预览体验。

## 顶层分层

### 1. Preview Runtime

Preview Runtime 是真正 durable 的内核，负责：

- 分析当前被选中的路径
- 服务目录、Markdown、文本、图片、视频
- 在浏览器里渲染页面和导航
- 解析 Markdown 内的相对链接
- 尽量复用现有 session 和端口

### 2. Launch Surfaces

Launch Surface 是触发入口：

- macOS Finder Quick Action
- Codex / VS Code 右键菜单
- 通过显式本地 patch 接入的 Codex app 内部文件链接 `Open With` 菜单
- 后续其他支持扩展的编辑器

这些入口应该尽量薄。它们只负责把“当前应该打开哪个路径”交给 runtime，而不应该各自重写一套渲染逻辑。

### 3. Adapter Packages

每个宿主的适配层应该独立打包，匹配宿主本身的安装和交互方式：

- `adapters/vscode/`：第一批 editor adapter
- `adapters/codex-app/`：可选 Codex 桌面 patch 的独立安装 / 回滚路径
- 后续 `adapters/<future-editor>/`

Codex 桌面 patch 这条路径现在走的是“staged app bundle swap + clean backup”模式，不再原地改写 `Resources/app.asar`。

## 当前 Runtime 形态

共享 runtime 现在已经抽到 `packages/runtime/`：

- `packages/runtime/browser-preview.js`：共享浏览器预览引擎和 raw server 构建逻辑
- `packages/runtime/session-store.js`：共享的同项目根 session / 端口复用规则
- `packages/runtime/runtime-loader.js`：共享 runtime 的 code stamp 和 fresh-load 入口
- `packages/runtime/preview-supervisor.js`：共享预览后端 supervisor，负责把实际监听端口的预览子进程保活并在需要时重启

宿主侧现在都只在这层之上做桥接：

- `adapters/vscode/extension.js`：稳定的 Extension Host shell，负责热更新检测
- `adapters/vscode/extension-runtime.js`：很薄的 VS Code bridge，把 editor 上下文转成共享 runtime 调用
- `adapters/vscode/open-finder-preview.js`：Finder / Codex-app launcher，目标也是同一套共享 runtime

这意味着 Finder 和 VS Code 现在都不再把 `adapters/vscode/extension.js` 或某个 adapter 私有的 session-store 文件当成 runtime 真相。

## 边界规则

- 浏览器渲染规则属于 preview runtime，不属于 Finder 专属代码，也不属于 editor 专属代码
- 宿主 adapter 可以决定“打开哪个路径”，不能决定“Markdown 怎么渲染”
- session / 端口复用策略应该放在 runtime 或共享 launcher 层，而不是某一个 editor 独占
- Finder 专属问题，例如如何识别当前选中项、如何激活浏览器，只留在 Finder 启动链里
- Editor 专属问题，例如上下文菜单注入，只留在 editor adapter 里
- Codex 桌面 app 的 patch 逻辑只留在 `adapters/codex-app/`，不能把 app bundle patch 细节污染到普通 VS Code / Finder 路径
- 当前 VS Code adapter 故意只保留右键入口，像启动即常驻的 `Docs Live` 状态指示这类持久 UI 不再放进 adapter 表面

## 下一步目标形态

当前已经落地的稳定结构是：

- `packages/runtime/`
- `adapters/vscode/`
- `adapters/codex-app/`
- 从仓库安装出来的 Finder Quick Action runtime

下一步的目标结构是：

- `adapters/finder/`
- `adapters/<future-editor>/`

现在剩下的架构工作已经不是“先把共享 runtime 抽出来”，而是“在这层共享 runtime 之上继续扩更多 launch surface，同时不再分叉行为”。
