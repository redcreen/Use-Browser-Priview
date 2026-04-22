# Use Browser Priview

[English](README.md) | [中文](README.zh-CN.md)

这是 Use Browser Priview 的第一批 editor adapter。

它会在 Codex / VS Code 里补三个浏览器预览入口：

- Explorer 里对 Markdown 文件右键
- Markdown 编辑区右键
- Markdown 标签页右键

## 前置条件

- VS Code 1.100 或更新版本

## 安装

在独立仓库根目录执行：

```bash
bash install.sh --vscode
```

然后在 Codex / VS Code 里执行：
激活后，运行时代码更新会自动热加载，不需要重启 Extension Host。如果这是你在一个已经打开的 Codex / VS Code 窗口里的首次安装，而且菜单还没出现，重开一次窗口即可。

## 它增加了什么

- 仅保留右键入口
- 目录、Markdown、文本、图片、视频的浏览器渲染
- 本地预览会话复用
- 更接近仓库浏览器，而不是单纯 raw server 的页面导航体验

## 补充说明

- 这只是第一阶段的 adapter 抽离，不是最终共享 runtime 形态
- 当前预览走的是轻量本地后端，不依赖 `mkdocs`
- 执行 `bash install.sh --vscode` 时会自动清理旧的 `workspace-doc-browser` 安装，避免 VS Code 出现重复右键入口
