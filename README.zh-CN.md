# Use Browser Priview

[English](README.md) | [中文](README.zh-CN.md)

Use Browser Priview 可以把本地文件夹和 Markdown 直接用浏览器打开，并保持一套统一的预览体验。

## 快速开始

最常见的用法是先装编辑器右键入口：

```bash
curl -fsSL https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/v0.0.3/install.sh | bash -s -- --vscode
```

激活后，运行时代码更新会自动热加载，不需要重启 Extension Host。如果这是你在一个已经打开的 VS Code / Codex 窗口里的首次安装，而且菜单还没出现，重开一次窗口即可。

如果你想在 macOS 上一次装齐全部入口，直接运行：

```bash
bash install.sh
```

## 你会得到什么

- Finder 文件夹右键：`Use Browser Priview`
- VS Code / Codex 的 Markdown 右键：`Use Browser Priview`
- 可选的 Codex app 链接右键：`Open With` -> `Use Browser Priview`
- Markdown 渲染预览
- `.htm` / `.html` 按 HTML 页面方式预览
- 浏览器里的目录浏览
- 目录里如果有 `README.md`，默认先打开这个 README
- 浏览器前进 / 后退时，尽量恢复之前的页面位置
- 图片、视频、文本预览
- 同一 workspace 会尽量保持同一个本地端口
- 同一个项目根在 Finder、VS Code / Codex 之间，以及运行时代码升级后，都会优先继续使用同一个本地预览端口；只有原端口无法回收时才换端口
- 预览后端由独立 supervisor 常驻，宿主重载或预览子进程异常退出后会尽量自动恢复

## 环境要求

- macOS
- 本机已安装 Node.js
- 如果要用编辑器集成，需要 VS Code / Codex 1.100 或更新版本

## 最简配置

- 只用 VS Code / Codex：macOS + Node.js + `bash install.sh --vscode`
- 只用 Finder：macOS + Node.js + `bash install.sh --finder`
- 需要 Codex app 链接菜单 patch：macOS + Node.js + 本机已安装 `Codex.app` + `bash install.sh --codex-app`

## 安装

### VS Code / Codex 一条命令安装

如果你只想装编辑器里的右键入口，并且希望直接复制一条命令就装好，推荐用这个：

```bash
curl -fsSL https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/v0.0.3/install.sh | bash -s -- --vscode
```

激活后，运行时代码更新会自动热加载，不需要重启 Extension Host。如果这是你在一个已经打开的 VS Code / Codex 窗口里的首次安装，而且菜单还没出现，重开一次窗口即可。

### 在 VS Code 插件中心里安装

如果你想从 VS Code 的 Extensions 视图安装，而不是走终端：

1. 先准备好这个扩展的 `.vsix` 安装包。
2. 打开 VS Code 的 Extensions 视图。
3. 点击右上角 `...`。
4. 选择 `Install from VSIX...`。
5. 选中 `.vsix` 文件。

如果这是首次安装，而且当前已经打开的窗口里还没看到右键菜单，重开一次 VS Code / Codex 即可。后续运行时代码更新会自动热加载，不需要重启 Extension Host。

这个扩展目前还没有发布到公开的 VS Code Marketplace，所以当前可用的插件中心安装方式是 `Install from VSIX...`，不是直接按名字搜索安装。

### 全部安装

终端：

```bash
bash install.sh
```

或者直接从 GitHub 安装：

```bash
curl -fsSL https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/v0.0.3/install.sh | bash
```

Finder：

- 双击 [install.command](install.command)

这会同时安装：

- VS Code / Codex 适配器
- Finder Quick Action

它不会顺带 patch Codex 桌面 app 的内部菜单。那部分保持显式可选安装。

### 只安装 VS Code / Codex

终端：

```bash
bash install.sh --vscode
```

或者：

```bash
npm run install:vscode
```

或者直接从 GitHub 安装：

```bash
curl -fsSL https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/v0.0.3/install.sh | bash -s -- --vscode
```

Finder：

- 双击 [install-vscode.command](install-vscode.command)

### 只安装 Finder

终端：

```bash
bash install.sh --finder
```

或者：

```bash
npm run install:finder
```

Finder：

- 双击 [install-finder.command](install-finder.command)

### 可选：安装 Codex App 链接菜单 Patch

只有当你想把 `Use Browser Priview` 插进 Codex app 自己的文件链接右键菜单时，才需要这一项。

终端：

```bash
bash install.sh --codex-app
```

或者直接从 GitHub 安装：

```bash
curl -fsSL https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/v0.0.3/install.sh | bash -s -- --codex-app
```

Finder：

- 双击 [install-codex-app.command](install-codex-app.command)

这部分能力故意独立，因为它会修改本机 `Codex.app` 包内容。如果 Codex 更新后菜单消失，重新执行一次这个安装即可。

当前安装器会先保留一份干净的 app bundle 备份，再用整包原子替换的方式安装 / 回滚，不再原地改写 `Resources/app.asar`。

如果后面要移除这个 patch：

```bash
bash adapters/codex-app/uninstall-codex-app.sh
```

## 怎么用

完整使用说明见 [使用说明](docs/usage.zh-CN.md)。

### 在 VS Code / Codex 里

1. 打开一个本地 Markdown 文件。
2. 在编辑区、Explorer，或者标签页标题上右键。
3. 选择 `Use Browser Priview`。

当前 VS Code 侧只保留右键入口，没有状态栏按钮，也没有命令面板快捷入口。

本地 `.htm` / `.html` 文件进入预览后会按 HTML 页面渲染，不再退回成纯文本查看。

如果目标是目录，并且该目录里有 `README.md`，预览会先打开这个 README；没有时才保持目录列表页。

同一个预览标签页里使用浏览器前进 / 后退时，会恢复这个页面之前记住的滚动位置，而不是总回到顶部。

Markdown 里的字号控制走安全白名单语法，不开放任意 HTML 或内联 CSS：

```md
[[size:lg|这一句会更大。]]

:::size-xl
这一整段都会更大。
里面仍然可以继续写 **加粗** 和 [链接](./README.md)。
:::
```

支持的字号只有：`sm`、`base`、`lg`、`xl`、`2xl`。

### 在 Finder 里

1. 对一个文件夹项右键。
2. 选择 `Use Browser Priview`。

当前稳定支持的是“文件夹项右键”。Finder 空白处右键不在当前 Quick Action 的可支持范围内。

端口复用以“项目根”为准，不以你点开的那个子目录为准：

- 项目根 = 最近一个包含 `.git`、`.hg` 或 `.svn` 的父目录
- 如果一路往上都没有这些标记，就把当前选中的目录本身当作根
- 先开 `repo/docs/a/`，再开 `repo/docs/`：同一个端口
- 先开 `repo/docs/a/`，再开 `repo/`：同一个端口
- 代码升级后再打开同一个仓库：优先还是同一个端口，只要旧端口能被回收
- 先开 `repo/docs/a/`，再开仓库外的别的目录：不同端口
- 目录里有 `README.md` 时，会默认落到这个 README，而不是先停在目录列表页

### 在 Codex App 的链接右键里

1. 先安装可选的 Codex app patch。
2. 完全退出再重新打开 Codex。
3. 在 Codex 里对一个文件链接右键。
4. 进入 `Open With` -> `Use Browser Priview`。

## 更新

重复执行同一条安装命令即可：

- 全部安装：`bash install.sh`
- 只装 VS Code：`bash install.sh --vscode`
- 只装 Finder：`bash install.sh --finder`
- 只装 Codex app patch：`bash install.sh --codex-app`
- 远程只装 VS Code：`curl -fsSL https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/v0.0.3/install.sh | bash -s -- --vscode`

## 常见问题

- VS Code 里首次安装后还是没看到菜单：重开当前 VS Code / Codex 窗口一次
- 运行时代码已经更新，但下一次预览看起来还是旧的：再触发一次 `Use Browser Priview`，让当前适配器切到最新 runtime
- Finder 里没看到入口：请对文件夹项右键，不要在空白处右键
- Codex app 里没看到 `Use Browser Priview`：执行 `--codex-app` 后彻底退出并重开 Codex；如果 Codex 刚更新过，再重新安装一次 patch
- 需要移除 Codex app patch：执行 `bash adapters/codex-app/uninstall-codex-app.sh`，然后彻底退出并重开 Codex
- 浏览器没有打开：先确认本机 `PATH` 里能找到 Node.js

## 文档

- [文档首页](docs/README.zh-CN.md)
- [使用说明](docs/usage.zh-CN.md)
- [架构](docs/architecture.zh-CN.md)
- [路线图](docs/roadmap.zh-CN.md)
- [测试计划](docs/test-plan.zh-CN.md)
- [发布流程](RELEASE.zh-CN.md)
