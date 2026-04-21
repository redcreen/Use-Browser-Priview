# Entry Routing

## Current Entry Direction

- Direction: `tool-first front door plus daemon-aware runtime control`
- Status: `active`
- Why Now: repo 现在既要把 `启动 / 整改 / 文档整改 / 继续 / 进展 / 开发日志 / 交接` 收成同一条工具前门，也要把 `daemon / queue` 这类运行时控制面放进同一条路由，让 daemon-host baseline 成为默认快路径，而不是让宿主或脚本再各自维护一套平行入口。

## Entry Routing Contract

- `启动 / 整改 / 文档整改 / 继续 / 进展 / 开发日志 / 交接 / daemon / queue` 的第一步都必须先走统一前门，而不是由 skill 或宿主手工拼多段脚本。
- 对维护者、CLI 和宿主来说，daemon-host baseline 现在就是默认快路径：优先调用 `project_assistant_entry.py` / `bin/project-assistant`，而不是直连后端脚本。
- `继续 / 进展 / 开发日志 / 交接` 必须先触发版本 preflight；旧控制面必须先补到当前代际，再允许继续读取真实状态。
- `启动 / 整改 / 文档整改` 必须走 transaction-style fast path，把 control-surface、docs、markdown governance 和默认门禁合并成一次前门调用。
- `daemon / queue` 必须继续复用同一条前门和同一套 runtime contract，而不是让宿主、CLI 和脚本各自发明新的控制协议。
- 统一前门只负责命令路由、版本 preflight / fast path、runtime dispatch 和结构化面板输出；真正的业务逻辑仍留在后端脚本。
- `bootstrap_entry.py`、`retrofit_entry.py`、`continue_entry.py`、`progress_entry.py`、`devlog_entry.py`、`handoff_entry.py` 继续保留给后端复用、验证与调试；它们不是默认 operator 入口。
- 自然语言 skill 负责把用户意图路由到统一前门，但不能再绕过统一前门自发生成第一屏。
- 宿主或插件级硬接入如果存在，应继续调用同一条统一前门，而不是复制一套平行逻辑。

## Front Door Layers

| Layer | Current Implementation | Responsibility |
| --- | --- | --- |
| natural-language routing | `SKILL.md` + prompt routing | 把用户说的 `项目助手 启动 / 整改 / 文档整改 / 继续 / 进展 / 开发日志 / 交接 / 守护进程 / 任务队列` 路由到同一条前门 |
| canonical tool front door | `scripts/project_assistant_entry.py` + `bin/project-assistant` | 统一解析模式、仓库路径和子命令别名 |
| mode backends | `bootstrap_entry.py` / `retrofit_entry.py` / `continue_entry.py` / `progress_entry.py` / `devlog_entry.py` / `handoff_entry.py` | 生成对应的事务化快路径或结构化第一屏；供前门复用，也供验证/调试直接调用 |
| runtime control backend | `daemon_entry.py` + `daemon_runtime.py` | 统一处理 daemon 生命周期、queue / events 查询和前台主写入线 lease |
| durable repo state | `.codex/*` + durable docs | 提供启动、整改、继续、进展和交接真正读取与写回的真相层 |

## Preflight Contract

| Mode | Preflight Rule | Why |
| --- | --- | --- |
| `bootstrap` | 直接进入 `bootstrap_entry.py` 事务化快路径（内部负责 control-surface、docs 与 `fast` 门禁） | 把空白项目初始化收成一次事务，不再让宿主串多轮脚本 |
| `retrofit` | 直接进入 `retrofit_entry.py` 事务化快路径（内部负责 control-surface、docs、Markdown governance 与 `fast` 门禁） | 把结构整改收成一次事务，并把深门禁留给收口轮次 |
| `docs-retrofit` | 与 `retrofit` 共用同一条 transaction fast path，并附带 docs intent | 文档整改默认也包含 Markdown governance，不再维护平行链路 |
| `continue` | 先跑 `sync_resume_readiness.py`；旧代际必须先升级 | 不让旧 `.codex` 真相直接误导继续输出 |
| `progress` | 先跑 `sync_resume_readiness.py`；再生成完整看板 | 不让维护者读到过时代际的全局进展 |
| `devlog` | 先跑 `sync_resume_readiness.py`；再刷新 live devlog capture state | 不让维护者根据过时的 Last Entry / Pending Capture 补错日志 |
| `handoff` | 先跑 `sync_resume_readiness.py`；再生成恢复包 | 不让交接包继续引用旧控制面结构 |
| `daemon` | 先 ensure 对应仓库的本地 runtime，再暴露结构化 daemon 状态 | 把 runtime 生命周期控制收成统一入口 |
| `queue` | 先连接同一仓库 runtime，再输出结构化 queue / task 状态 | 不让宿主和 CLI 各自发明平行查询逻辑 |

## Structured Output Contract

| Mode | First Output Must Be | Not Allowed First |
| --- | --- | --- |
| `bootstrap` | 结构化启动结果面板 | 先在 commentary 里拆着讲要跑哪些脚本 |
| `retrofit` | 结构化整改结果面板 | 让宿主先串多轮 sync 再回来说结果 |
| `docs-retrofit` | 结构化文档整改结果面板 | 单独维护另一条 docs-only 手工脚本链 |
| `continue` | 表格化 continue 面板 | 自由 prose 摘要 |
| `progress` | 表格化 maintainer dashboard | 只有自然语言长段落 |
| `devlog` | 结构化 devlog capture 面板或新条目路径 | 先让维护者自己猜当前是否该补日志 |
| `handoff` | 可复制的结构化交接面板 | 先解释再慢慢拼交接信息 |
| `daemon` | 结构化 daemon runtime 面板 | 直接暴露裸 socket 或隐藏内部状态 |
| `queue` | 结构化 queue / task 面板 | 让用户自己拼 runtime 文件路径猜状态 |

## Host / Tool Bridge Boundary

| Boundary | Repo Owns Today | Future Bridge |
| --- | --- | --- |
| tool-shaped entry | `project_assistant_entry.py` + CLI wrapper | 宿主或插件可以直接调用这条统一前门，减少重复 orchestration 回合 |
| runtime control | `daemon_entry.py` + `daemon_runtime.py` | 宿主应消费同一套 runtime contract，而不是直接操纵 runtime store |
| business logic | 后端脚本继续留在 skill repo | 宿主不应复制 bootstrap/retrofit/continue/progress/devlog/handoff/daemon/queue 逻辑 |
| hard host routing | 仅通过文档和统一前门定义边界 | 真正桌面级强绑定需由宿主 / 插件集成承接 |

## Next Entry Checks

1. 在代表性旧代际仓库上继续验证：`continue / progress / devlog / handoff` 会先升级再输出结构化面板。
2. 在空白仓库和真实整改仓库上持续 benchmark：默认 front door 应继续把宿主调用次数压到一次，而不是重新回退成多轮串脚本。
3. 持续验证 `daemon / queue` 会通过同一条统一前门暴露 runtime 状态，而不是绕回裸 runtime 文件或平行脚本入口。
4. 如果未来引入插件或宿主硬接入，必须继续复用统一前门，而不是复制另一套命令逻辑。
