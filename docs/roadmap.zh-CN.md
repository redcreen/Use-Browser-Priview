# 路线图

[English](roadmap.md) | [中文](roadmap.zh-CN.md)

## 总体进展

| 项目 | 当前值 |
| --- | --- |
| 阶段进度 | 2 / 4 个阶段已完成 |
| 当前阶段 | Stage 2：共享 Runtime 抽离 |
| 当前目标 | 在不破坏共享 runtime 行为和端口复用的前提下，让深层笔记页预览保持流畅 |
| 下一已排队切片 | `editor adapter expansion` |
| 详细下钻 | [reference/use-browser-priview/development-plan.zh-CN.md](reference/use-browser-priview/development-plan.zh-CN.md) |

## 里程碑规则

- 每个 stage 代表一个 durable 的产品里程碑。
- 只有当该阶段的退出条件真实成立时，才算完成。
- 更细的执行顺序放在[开发计划](reference/use-browser-priview/development-plan.zh-CN.md)里，不塞进这里的 stage 标题。

## Stage 1：独立仓库基线

状态：已完成

目标：
- 从 `project-assistant` 中独立出仓库归属
- 在独立仓库里保留当前可运行的浏览器预览能力
- 提供一个本地安装入口，同时覆盖 macOS 和第一批 editor adapter

退出条件：
- 仓库有真实文档
- 仓库有本地安装入口
- Finder 和 Codex / VS Code 两条链都从这个仓库运行

## Stage 2：共享 Runtime 抽离

状态：已完成

目标：
- 把浏览器预览 runtime 抽成共享包
- 让 Finder 启动链不再依赖 VS Code adapter 的文件布局
- 定义后续 adapter 可复用的稳定 runtime API

退出条件：
- 出现共享 runtime 包
- Finder 和 VS Code adapter 都直接使用这套 runtime
- 抽离后渲染行为保持一致

## Stage 3：更多编辑器适配

状态：下一阶段

目标：
- 支持更多能扩展右键菜单的编辑器
- 保持统一产品名和统一浏览器预览体验

退出条件：
- 至少新增一个非 Codex 的 editor adapter
- adapter 的安装和验证流程有文档

## Stage 4：打包与发布

状态：排队中

目标：
- 增加可发布的安装流
- 把仓库作为独立产品做版本化
- 安装文档不再引用 `project-assistant`

退出条件：
- 本仓库内有 release 流程
- 一键安装链接指向本仓库而不是来源仓库
