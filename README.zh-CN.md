# Use Browser Priview

[English](README.md) | [中文](README.zh-CN.md)

Use Browser Priview 可以把本地文件夹和 Markdown 直接用浏览器打开，并保持一套统一的预览体验。

## 你会得到什么

- Finder 文件夹右键：`Use Browser Priview`
- VS Code / Codex 的 Markdown 右键：`Use Browser Priview`
- Markdown 渲染预览
- 浏览器里的目录浏览
- 图片、视频、文本预览
- 同一 workspace 尽量复用同一个本地端口
- 同一个项目根在 Finder 和 VS Code / Codex 之间尽量复用同一个本地预览端口

## 环境要求

- macOS
- 本机已安装 Node.js
- 如果要用编辑器集成，需要 VS Code / Codex 1.100 或更新版本

## 安装

### VS Code / Codex 一条命令安装

如果你只想装编辑器里的右键入口，并且希望直接复制一条命令就装好，推荐用这个：

```bash
curl -fsSL https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/master/install.sh | bash -s -- --vscode
```

安装后，在 VS Code / Codex 里执行一次：

```text
Developer: Restart Extension Host
```

### 在 VS Code 插件中心里安装

如果你想从 VS Code 的 Extensions 视图安装，而不是走终端：

1. 先准备好这个扩展的 `.vsix` 安装包。
2. 打开 VS Code 的 Extensions 视图。
3. 点击右上角 `...`。
4. 选择 `Install from VSIX...`。
5. 选中 `.vsix` 文件，然后执行一次 `Developer: Restart Extension Host`。

这个扩展目前还没有发布到公开的 VS Code Marketplace，所以当前可用的插件中心安装方式是 `Install from VSIX...`，不是直接按名字搜索安装。

### 全部安装

终端：

```bash
bash install.sh
```

或者直接从 GitHub 安装：

```bash
curl -fsSL https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/master/install.sh | bash
```

Finder：

- 双击 [install.command](install.command)

这会同时安装：

- VS Code / Codex 适配器
- Finder Quick Action

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
curl -fsSL https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/master/install.sh | bash -s -- --vscode
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

## 怎么用

### 在 VS Code / Codex 里

1. 打开一个本地 Markdown 文件。
2. 在编辑区、Explorer，或者标签页标题上右键。
3. 选择 `Use Browser Priview`。

当前 VS Code 侧只保留右键入口，没有状态栏按钮，也没有命令面板快捷入口。

### 在 Finder 里

1. 对一个文件夹项右键。
2. 选择 `Use Browser Priview`。

当前稳定支持的是“文件夹项右键”。Finder 空白处右键不在当前 Quick Action 的可支持范围内。

端口复用以“项目根”为准，不以你点开的那个子目录为准：

- 项目根 = 最近一个包含 `.git`、`.hg` 或 `.svn` 的父目录
- 如果一路往上都没有这些标记，就把当前选中的目录本身当作根
- 先开 `repo/docs/a/`，再开 `repo/docs/`：同一个端口
- 先开 `repo/docs/a/`，再开 `repo/`：同一个端口
- 先开 `repo/docs/a/`，再开仓库外的别的目录：不同端口

## 更新

重复执行同一条安装命令即可：

- 全部安装：`bash install.sh`
- 只装 VS Code：`bash install.sh --vscode`
- 只装 Finder：`bash install.sh --finder`
- 远程只装 VS Code：`curl -fsSL https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/master/install.sh | bash -s -- --vscode`

## 常见问题

- VS Code 里还是旧菜单：执行 `Developer: Restart Extension Host`
- Finder 里没看到入口：请对文件夹项右键，不要在空白处右键
- 浏览器没有打开：先确认本机 `PATH` 里能找到 Node.js

## 文档

- [文档首页](docs/README.zh-CN.md)
- [架构](docs/architecture.zh-CN.md)
- [路线图](docs/roadmap.zh-CN.md)
- [测试计划](docs/test-plan.zh-CN.md)
