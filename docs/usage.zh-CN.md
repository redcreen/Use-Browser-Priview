# 使用说明

[English](usage.md) | [中文](usage.zh-CN.md)

## 从 VS Code / Codex 打开

1. 打开一个本地 Markdown 文件或目录。
2. 在编辑区、Explorer，或者标签页标题上右键。
3. 选择 `Use Browser Priview`。

说明：
- VS Code / Codex 目前只保留右键入口。
- 没有状态栏按钮。
- 没有命令面板快捷入口。
- 激活后，运行时代码更新会自动热加载，不需要重启 Extension Host。

## 从 Finder 打开

1. 对一个文件夹项右键。
2. 选择 `Use Browser Priview`。

说明：
- 当前稳定支持的是“文件夹项右键”。
- Finder 空白处右键不在当前 Quick Action 的可支持范围内。

## 从 Codex App 链接右键打开

1. 先安装可选的 Codex app patch。
2. 完全退出并重新打开 Codex。
3. 在 Codex 里对一个文件链接右键。
4. 进入 `Open With` -> `Use Browser Priview`。

## 预览会做什么

- Markdown 会按文档页渲染。
- `.htm` / `.html` 会按 HTML 页面渲染。
- 图片、视频、文本文件会内联预览。
- 如果目录里有 `README.md`，会先打开这个 README。
- 同一个预览标签页里，浏览器前进 / 后退会恢复之前的页面位置。
- 在同一个 workspace 里切换左侧导航项时，侧栏会尽量保持原来的滚动位置，不再每次跳回顶部。

## 项目根与端口复用

端口复用以项目根为准，不以你点开的子目录为准。

- 项目根 = 最近一个包含 `.git`、`.hg` 或 `.svn` 的父目录
- 如果一路往上都没有这些标记，就把当前选中的目录本身当作根
- 同一个项目根在 Finder 和 VS Code / Codex 之间共用一个预览端口
- 运行时代码升级后，只要旧端口能被回收，同一个项目根仍然继续使用原端口
- 仓库外的别的目录会启动不同端口

## 大目录的加载方式

如果当前页面位于一个很大的目录树里，左侧树不会在首屏把所有同级目录一次性全部展开。

- 会先保证当前激活路径可见
- 很大的同级目录集合会保持按需加载
- 只有你手动展开那个目录时，才会去加载完整同级列表
- 这样可以避免笔记型仓库在每次刷新时都重复渲染几百个兄弟目录
- 如果你手动关闭了当前分支，这个关闭状态会保持到你主动重新展开为止；再去展开兄弟目录，也不会把你刚关掉的分支偷偷重新打开

## 安全 Markdown 字号

Markdown 字号控制使用安全白名单语法，不开放任意 HTML 或内联 CSS。

### 行内写法

```md
普通正文里也可以写 [[size:lg|更大的字]]。
```

### 整块写法

```md
:::size-xl
这一整段都会更大。
里面仍然可以写 **加粗**、`代码` 和 [链接](./README.md)。
:::
```

### 支持的字号

- `sm`
- `base`
- `lg`
- `xl`
- `2xl`

其中 `sm` 现在是更紧凑的小号字，适合图片表格里的赞藏数据、辅助说明这类密集元信息。

### 限制

- 不支持任意 `<span style="font-size: ...">`
- 不支持任意内联 CSS
- 只支持上面这几个固定 token

### 表格中的写法

安全字号语法现在也支持写在 Markdown 表格单元格里：

```md
| [[size:sm|3.4w赞·2101藏·V]] | [[size:sm|2.1w赞·2588藏]] |
```

图片链接和字号 token 也可以混在同一个表格里：

```md
| [![](<../../notes/demo/note-01.jpg>)](<../../notes/demo/note.md>) | [![](<../../notes/demo/note-02.jpg>)](<../../notes/demo/note-02.md>) |
| [[size:sm|3.4w赞·2101藏·V]] | [[size:sm|2.1w赞·2588藏]] |
```

## 常见问题

- VS Code 里首次安装后还是没看到菜单：重开当前 VS Code / Codex 窗口一次
- 运行时代码已经更新，但下一次预览看起来还是旧的：再触发一次 `Use Browser Priview`，让当前适配器切到最新 runtime
- Finder 里没看到入口：请对文件夹项右键，不要在空白处右键
- Codex app 菜单里没看到 `Use Browser Priview`：执行 `--codex-app` 后彻底退出并重开 Codex
- 浏览器没有打开：先确认本机 `PATH` 里能找到 Node.js
- 某个页面仍然明显卡顿：查看 `~/Library/Application Support/Use Browser Priview/preview-perf.log`，重点看 `tree-request`、`tree-render`、`file-load`、`longtask`
