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
- 后续其他支持扩展的编辑器

这些入口应该尽量薄。它们只负责把“当前应该打开哪个路径”交给 runtime，而不应该各自重写一套渲染逻辑。

### 3. Adapter Packages

每个宿主的适配层应该独立打包，匹配宿主本身的安装和交互方式：

- `adapters/vscode/`：第一批 editor adapter
- 后续 `adapters/<future-editor>/`

## 当前过渡态

这个仓库刚从原来的 VS Code 中心实现里抽离出来，所以当前是一个有意识的过渡态：

- 第一版可运行 runtime 还和 VS Code adapter 放在一起
- Finder 启动链先直接复用这套 runtime，而不是再写第二套
- 下一阶段的重点是把共享 runtime 抽到独立包里，让所有 adapter 都直接依赖它

这在第一版独立化里是可接受的，因为第一阶段先解决“仓库归属”和“产品边界”，第二阶段再解决“内部 runtime 解耦”。

## 边界规则

- 浏览器渲染规则属于 preview runtime，不属于 Finder 专属代码，也不属于 editor 专属代码
- 宿主 adapter 可以决定“打开哪个路径”，不能决定“Markdown 怎么渲染”
- session / 端口复用策略应该放在 runtime 或共享 launcher 层，而不是某一个 editor 独占
- Finder 专属问题，例如如何识别当前选中项、如何激活浏览器，只留在 Finder 启动链里
- Editor 专属问题，例如上下文菜单注入，只留在 editor adapter 里

## 后续目标形态

长期目标结构是：

- `packages/runtime/`
- `adapters/finder/`
- `adapters/vscode/`
- `adapters/<future-editor>/`

当前仓库还没完全到这一步。第一阶段目标是先让它独立、能跑、能装；第二阶段再把共享 runtime 抽干净。
