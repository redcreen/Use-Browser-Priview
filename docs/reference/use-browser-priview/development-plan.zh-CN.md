# Use Browser Priview 开发计划

[English](development-plan.md) | [中文](development-plan.zh-CN.md)

## 目的

这份文档是给维护者看的 durable 详细执行计划，位置在 `docs/roadmap` 之下、AI 控制面之上。

它回答的不是“今天聊天里说了什么”，而是：

`接下来先做什么、从哪里恢复、每个里程碑下面到底落什么细节。`

## 相关文档

- [../../roadmap.zh-CN.md](../../roadmap.zh-CN.md)
- [../../test-plan.zh-CN.md](../../test-plan.zh-CN.md)

## 怎么使用这份计划

1. 先看 roadmap，理解总体进展与下一阶段。
2. 再看这里的“总体进展”“执行任务进度”和“顺序执行队列”，理解今天该从哪里恢复。
3. 只有在维护自动化本身时，才需要继续下钻到内部控制文档。

## 总体进展

| 项目 | 当前值 |
| --- | --- |
| 总体进度 | 2 / 5 个 execution task 完成 |
| 当前阶段 | Standalone extraction and first runnable baseline. |
| 当前切片 | `stage-1 standalone baseline` |
| 当前目标 | turn the extracted repo into a real standalone product baseline |
| 当前切片退出条件 | docs、安装入口和首批验证在这个仓库里对齐 |
| 明确下一步动作 | EL-3 replace template docs with real project docs and install entrypoints |
| 下一候选切片 | `shared runtime extraction` |

## 当前位置

| 项目 | 当前值 | 说明 |
| --- | --- | --- |
| 当前阶段 | Standalone extraction and first runnable baseline. | 当前维护阶段 |
| 当前切片 | `stage-1 standalone baseline` | 当前执行线绑定的切片 |
| 当前执行线 | turn the extracted repo into a real standalone product baseline | 当前真正要收口的工作 |
| 当前验证 | repo 文档、安装入口和首批 adapter 语法检查保持一致 | 这条线继续前需要保持为真的验证入口 |

## 执行任务进度

| 顺序 | 任务 | 状态 |
| --- | --- | --- |
| 1 | EL-1 create the standalone repo and baseline control surface | 已完成 |
| 2 | EL-2 move the first runnable adapter code into the new repo | 已完成 |
| 3 | EL-3 replace template docs with real project docs and install entrypoints | 下一步 |
| 4 | EL-4 validate Finder and Codex / VS Code install paths from this repo | 下一步 |
| 5 | EL-5 refresh next checkpoint around shared runtime extraction | 已排队 |

## 阶段总览

| 阶段 | 状态 | 目标 | 依赖 | 退出条件 |
| --- | --- | --- | --- | --- |
| Stage 1：独立仓库基线 | 当前 | 让这个仓库独立可理解、可安装 | 已抽出的 adapter 代码 | 文档、安装脚本和首批 adapter 验证真实可用 |
| Stage 2：共享 Runtime 抽离 | 下一步 | 去掉对 VS Code adapter 布局的 runtime 依赖 | stage 1 基线 | 出现共享 runtime，且 adapter 改为消费它 |
| Stage 3：更多编辑器适配 | 已排队 | 支持更多宿主编辑器 | 共享 runtime | 至少出现一个新的 editor adapter |

## 顺序执行队列

| 顺序 | 切片 | 当前状态 | 目标 | 验证 |
| --- | --- | --- | --- | --- |
| 1 | `stage-1 standalone baseline` | 当前 | 让抽离后的仓库独立可理解、可安装 | docs validators 和 adapter 语法检查通过 |
| 2 | `shared runtime extraction` | 下一步 | 把 preview runtime 从 VS Code adapter 布局里抽出来 | 出现共享 runtime 包，且当前行为稳定 |
| 3 | `editor adapter expansion` | 已排队 | 支持更多 editor adapter | adapter 安装和验证流程有文档 |

## 里程碑细节

当前还没有从 roadmap 里解析出可下钻的里程碑。

## 当前下一步

| 下一步 | 为什么做 |
| --- | --- |
| EL-3 replace template docs with real project docs and install entrypoints | 这是当前第一条未完成 execution task，也是这个仓库能否真正以独立产品姿态存在的前提。 |
