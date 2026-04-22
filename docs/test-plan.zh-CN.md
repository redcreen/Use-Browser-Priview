# 测试计划

[English](test-plan.md) | [中文](test-plan.zh-CN.md)

## 范围与风险

这个项目当前的主要风险有三类：

- 目录、Markdown、图片、视频、raw 文件等预览行为是否一致
- Finder 和编辑器两个入口是否真的进入同一套预览模型
- 同一 workspace 的端口复用是否稳定，是否能在升级后继续保持同一个端口且不悄悄堆出旧进程

## 验收用例

| 用例 | 前置 | 操作 | 预期结果 |
| --- | --- | --- | --- |
| Finder 文件夹预览 | 已安装 Finder Quick Action | 对文件夹项右键执行 `Use Browser Priview` | 浏览器打开的是当前选中文件夹，而不是别的仓库根目录 |
| Codex / VS Code Markdown 预览 | 已安装编辑器 adapter，且已打开本地 Markdown | 在编辑器里右键执行 `Use Browser Priview` | 浏览器打开当前 Markdown 的预览页 |
| 只装 VS Code | 当前没有 adapter 或存在旧 `workspace-doc-browser` 副本 | 执行 `bash install.sh --vscode`，重启扩展宿主后在 VS Code 里对 Markdown 右键 | 新 adapter 安装成功，旧 `workspace-doc-browser` 副本被清理，且只剩一个 `Use Browser Priview` 右键入口 |
| VS Code 远程一条命令安装 | 机器可以通过 curl 访问公开仓库 | 执行 `curl -fsSL https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/master/install.sh \| bash -s -- --vscode`，重启扩展宿主后在 VS Code 里对 Markdown 右键 | 不需要先 clone 仓库也能完成安装，并且 VS Code 右键入口可用 |
| 只装 Finder | macOS，尚未安装 Finder 路径 | 执行 `bash install.sh --finder`，然后在 Finder 里对文件夹项右键 | Finder Quick Action 出现且可用，不依赖 VS Code 扩展安装 |
| 全量安装 | macOS，干净环境或历史安装环境 | 执行 `bash install.sh` | VS Code 和 Finder 两条入口一次安装完成 |
| 安装 Codex app patch | macOS，已安装 Codex 桌面 app | 执行 `bash install.sh --codex-app`，彻底退出并重开 Codex，然后在 Codex 里对文件链接右键 | `Open With` 里出现 `Use Browser Priview`，且不影响普通 VS Code / Finder 安装路径 |
| 回滚 Codex app patch | macOS，已安装 Codex app patch | 执行 `bash adapters/codex-app/uninstall-codex-app.sh`，然后彻底退出并重开 Codex | Codex 回到 clean backup bundle，并且不再带 patch 启动 |
| 跨入口端口复用 | 已经从 VS Code 或 Finder 打开过同一个仓库的预览 | 再从另一条入口打开这个仓库里的子目录 | 复用已有预览服务，只切换到新的目标路径，不再额外起第二个端口 |
| 代码升级后的端口复用 | 同一个项目根已经占用一个预览端口 | 升级运行时代码后，再从 Finder 或 VS Code / Codex 打开同一个仓库 | 先停掉旧进程，再在可回收时继续使用原端口，不悄悄换成新端口 |
| 目录浏览 | 浏览器已经打开目录页 | 点击子目录 | 进入目录列表页，仍然保持同一套预览模型 |
| 目录 README 默认落点 | 目录内存在 `README.md` | 从 Finder、VS Code / Codex，或浏览器内目录链接打开该目录 | 直接落到同目录的 `README.md`，不先停在目录列表页 |
| 安全 Markdown 字号 | Markdown 中包含 `[[size:lg|...]]`、`:::size-xl` 块，或表格单元格里的 `[[size:sm|...]]` | 在浏览器预览中打开该 Markdown | 白名单字号 token 会在普通段落、整块内容和 Markdown 表格里正确生效，不需要开放任意 HTML / 内联 CSS |
| Markdown 尖括号链接目标 | Markdown 中存在 `[标题](<../../path/to/file.md>)` 或带 `&` 查询参数的外链 | 点击链接 | 相对路径正常解析，不残留 `&gt;` / `&amp;` 这类 HTML 实体 |
| 前进后退位置恢复 | 浏览器已经在同一个预览标签页里打开过多个页面 | 向下滚动后进入下一个页面，再执行浏览器后退 / 前进 | 返回页面时恢复到之前记住的滚动位置，而不是回到顶部 |
| Markdown 相对链接 | 浏览器已经打开 Markdown | 点击相对 Markdown 链接 | 目标 Markdown 继续以渲染页打开，不变成 raw 下载 |
| HTML 页面预览 | 浏览器打开 `.htm` 或 `.html` 文件 | 通过预览流打开该文件 | 该文件按 HTML 页面渲染，而不是纯文本 |
| 图片预览 | 当前目录包含图片 | 点击图片文件 | 在浏览器内打开图片预览 |
| 视频预览 | 当前目录包含视频 | 点击视频文件 | 在浏览器内打开播放器，并支持拖动播放 |
| 端口复用 | 同一 workspace 被重复打开 | 从 Finder 或编辑器重复触发两次 | 代码版本不变时优先复用已有 session 和端口 |

## 自动化覆盖

- `npm test`
- `bash install.sh --help`
- 远程安装 smoke test：`cat install.sh | bash -s -- --vscode`，并配合 `USE_BROWSER_PRIVIEW_ARCHIVE_SOURCE=<archive>`
- `node --check adapters/vscode/extension.js`
- `node --check adapters/vscode/open-finder-preview.js`
- `bash -n adapters/vscode/open-finder-preview.sh`
- `bash -n adapters/vscode/install-macos-finder-quick-action.sh`
- `node --check adapters/codex-app/patch-codex-open-with.js`
- `bash -n adapters/codex-app/open-codex-preview.sh`
- `bash -n adapters/codex-app/install-codex-app.sh`
- `bash -n adapters/codex-app/uninstall-codex-app.sh`
- `bash -n install.command`
- `bash -n install-vscode.command`
- `bash -n install-finder.command`
- `bash -n install-codex-app.command`
- 本地 smoke test：`WORKSPACE_DOC_BROWSER_NO_OPEN=1 node adapters/vscode/open-finder-preview.js <path>`
- HTML 预览约束：`node tests/validate-html-preview-contract.mjs`
- 目录 README 默认落点约束：`node tests/validate-directory-readme-default.mjs`
- Markdown 链接目标归一化约束：`node tests/validate-markdown-link-href-normalization-contract.mjs`
- 代码升级后端口复用约束：`node tests/validate-port-reuse-after-upgrade.mjs`
- 安全 Markdown 字号约束：`node tests/validate-safe-text-size-contract.mjs`
- 前进后退位置恢复约束：`node tests/validate-scroll-restoration-contract.mjs`
- 共享 session 复用约束：`node tests/validate-shared-session-store.mjs`
- Codex 桌面 patch 约束：`node tests/validate-codex-app-patch.mjs`

## 手工检查

- Finder 对文件夹项右键时能看到 `Use Browser Priview`
- Finder 触发后浏览器有明确可见动作，而不是静默没反应
- Codex / VS Code 右键时只会看到一个 `Use Browser Priview`
- 安装可选 patch 并重开 Codex 后，在 Codex 文件链接右键的 `Open With` 里能看到 `Use Browser Priview`
- Codex / VS Code 不再出现 `Docs Live` 或 `Use Browser Priview` 状态栏按钮
- Finder 和编辑器两个入口打开后，看到的是同一类浏览器预览体验

## 测试数据与夹具

- 一个有多层 Markdown 的文档仓库
- 一个含图片的目录
- 一个含视频的目录
- 一个含软链接目录的目录
- 一个包含中文等非 ASCII 名称的工作区

## 发布门禁

- Finder Quick Action 在 macOS 上安装成功
- Codex / VS Code adapter 能通过 `bash install.sh --vscode` 装上，并清掉旧的 `workspace-doc-browser` 副本
- Codex / VS Code adapter 也能通过远程一条命令安装，不依赖本地先 clone 仓库
- Finder Quick Action 能通过 `bash install.sh --finder` 装上，且不依赖 VS Code 扩展安装
- `bash install.sh` 能一次安装两条入口
- `bash install.sh --codex-app` 能单独 patch Codex app，而不改变普通 VS Code / Finder 安装语义
- Codex patch 安装同时要保留 clean backup bundle，卸载时能从这份 backup 恢复
- Finder 和 VS Code / Codex 对同一个项目根会复用同一个端口
- 同一个项目根在代码升级后，只要旧端口可回收，就继续使用原端口
- 上面的核心验收用例在一台新机器上通过
