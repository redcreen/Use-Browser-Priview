# Use Browser Priview

[English](README.md) | [中文](README.zh-CN.md)

这是 Use Browser Priview 的第一批 editor adapter。

它会在 Codex / VS Code 里补三个浏览器预览入口：

- 状态栏入口
- Markdown 编辑区右键
- Markdown 标签页右键

## 前置条件

- VS Code 1.100 或更新版本

## 安装

在独立仓库根目录执行：

```bash
bash install.sh
```

然后在 Codex / VS Code 里执行：

```text
Developer: Restart Extension Host
```

## 它增加了什么

- 状态栏左侧的 `Use Browser Priview` 按钮
- 命令面板入口：`Use Browser Preview`
- 目录、Markdown、文本、图片、视频的浏览器渲染
- 本地预览会话复用
- 更接近仓库浏览器，而不是单纯 raw server 的页面导航体验

## 补充说明

- 这只是第一阶段的 adapter 抽离，不是最终共享 runtime 形态
- 当前预览走的是轻量本地后端，不依赖 `mkdocs`
