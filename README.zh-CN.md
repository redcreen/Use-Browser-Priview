# Use Browser Priview

[English](README.md) | [中文](README.zh-CN.md)

Use Browser Priview 是一个独立的本地浏览器预览工具链，目标是把“文件夹 / Markdown / 图片 / 视频用浏览器查看”这件事，从单一编辑器扩展里抽离成一个可复用产品。

它未来要支持的入口是统一的：

- macOS Finder 里对文件夹右键
- Codex / VS Code 里对 Markdown 右键
- 其他支持扩展上下文菜单的编辑器

用户最终看到的动作名统一为：

`Use Browser Priview`

## 当前目标

把原来耦合在编辑器扩展里的浏览器预览能力，收成一个独立项目和统一产品面。

这样后续新增入口时，不需要再在每个宿主里各写一套预览逻辑。

## 当前范围

- 独立 macOS 安装入口
- Finder 文件夹右键 Quick Action
- 第一批 Codex / VS Code 编辑器适配器
- 目录、Markdown、文本、图片、视频的浏览器预览
- 同一 workspace 尽量复用同一个本地端口

## 安装

在仓库根目录执行：

```bash
bash install.sh
```

当前会安装：

- 第一批 Codex / VS Code adapter 到 `~/.vscode/extensions`
- macOS Finder Quick Action：`Use Browser Priview`
- 自动清理旧的 `redcreen.workspace-doc-browser-*` 安装，避免 VS Code 里出现重复入口

## 最简配置

当前最小前提：

- 如果要走 Finder 入口，需要 macOS
- 本机需要有 Node.js
- 如果要走第一批 editor adapter，需要 Codex / VS Code 1.100 或更新版本

安装后先重启一次扩展宿主：

```text
Developer: Restart Extension Host
```

## 快速开始

1. 本地 clone 这个仓库
2. 执行 `bash install.sh`
3. 在 Codex / VS Code 里执行 `Developer: Restart Extension Host`
4. 然后从下面两个入口之一打开：
- Finder：对文件夹项右键，选择 `Use Browser Priview`
- Codex / VS Code：对 Markdown 右键，选择 `Use Browser Priview`

当前 VS Code 侧故意只保留右键入口，不再保留状态栏 `Docs Live` 按钮或命令面板快捷入口。

## 项目结构

- `adapters/vscode/`
  第一批编辑器适配器，也是当前 Codex / VS Code 的实现层。
- `install.sh`
  本地一键安装：装 VS Code 适配器，并安装 macOS Finder Quick Action。
- `docs/`
  面向使用者和维护者的公开文档。
- `.codex/`
  面向持续演进的活控制面。

## 文档地图

- [文档首页](docs/README.zh-CN.md)
- [架构](docs/architecture.zh-CN.md)
- [路线图](docs/roadmap.zh-CN.md)
- [测试计划](docs/test-plan.zh-CN.md)
- [开发计划](docs/reference/use-browser-priview/development-plan.zh-CN.md)

## 当前架构方向

第一版独立化先追求“先抽离成功，再继续收口”：

- 当前预览 runtime 还放在第一批 VS Code adapter 里
- Finder 启动链直接复用这套 runtime，不再再造第二套渲染器
- 下一阶段会继续把公共 runtime 抽到共享包里，让后续 editor adapter 不再依赖 VS Code adapter 的目录结构

## 当前状态

这个仓库现在就是 Use Browser Priview 的新产品主仓。原来的 `project-assistant` 只保留来源关系，不再是长期承载位置。
