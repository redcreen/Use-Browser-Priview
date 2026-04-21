# Dogfooding Evidence

## Current Evidence Direction

- Direction: `Control surface and durable-doc alignment.`
- Status: `active`
- Why Now: align the control surface, define the next checkpoint, and run validation before closing the current execution line

## Evidence Collection Contract

- 采证必须优先引用真实 workspace、当前 gate 结果、宿主验证和 durable 控制面，而不是只凭聊天感受。
- 必须区分 self-repo / fixture / legacy-fixture / broader real-workspace evidence，避免把局部 happy path 误写成广泛 adoption。
- runtime / host / operator docs 摩擦必须先归类为 repo 层、宿主桥接层或 baseline 包装层，再决定是否升成主线。
- 更强宿主表面、release 包装升级和 `M15` 只能依据重复出现的 adoption 证据推进，不能因为单次不便或想象中的未来需求提前打开。
- 重要采证结论或 evidence-gated 决策变化应写入 devlog，避免下一次回来时只剩结论没有证据链。

## Evidence Snapshot

| Source | Scope | Current Signal | What It Currently Proves |
| --- | --- | --- | --- |
| skill repo live control truth | self-repo dogfood | post-M21 daemon-host baseline is active; `.codex/status.md` and `.codex/plan.md` show EL-1 and EL-2 closed | baseline narrative, gates, and recovery surfaces are aligned in the primary repo |
| daemon runtime regression path | runtime contract | `validate_daemon_runtime.py` exists and the status layer records startup-race hardening plus continue/progress/handoff coverage | runtime control already has concurrency-window evidence instead of only happy-path claims |
| daemon-host local fixture | representative fixture workspace | `validate_daemon_host_mvp.py` covers bootstrap / retrofit / docs-retrofit / validate-fast / progress / continue / handoff | the daemon-host baseline is proven on a clean local workspace, not only inside the skill repo |
| legacy rollout fixture | downgraded legacy workspace | `validate_daemon_legacy_rollout.py` proves upgrade-first continue / progress / handoff behavior on a downgraded fixture repo | old-generation repos still recover through the same baseline instead of forking a second path |
| VS Code host shell | host bridge | `validate_vscode_host_extension.py` and `integrations/vscode-host/` show the first host frontend is implemented and regression-tested | host evidence is real enough to stabilize, but not yet broad enough to justify a heavier host surface |

## Evidence Gaps

| Gap | Why It Still Matters | Current Handling |
| --- | --- | --- |
| broader real-workspace coverage | fixture and self-repo greens do not yet prove day-to-day adoption on multiple non-skill workspaces | next capture should add repeated evidence from more real local repos before release packaging or host expansion moves |
| repeated host friction classification | one-off host annoyances should not automatically turn into new UI work or a larger extension scope | only repeated friction across multiple workspaces should promote a host-surface follow-up |
| single foreground writer enforcement | the daemon already has a foreground lease, but the VS Code host does not yet enforce hard single-writer ownership | keep this as evidence-gated backlog until real adoption shows frequent write collisions |

## Evidence-Gated Decisions

| Decision Topic | Evidence Needed Before Promotion | Current Signal | Decision Now |
| --- | --- | --- | --- |
| release packaging uplift | broader workspaces stay green and do not expose repeated runtime / host / operator-doc regressions | current evidence is strong on self-repo + fixtures, but still thin on broader real-workspace adoption | keep release packaging as the next slice, not the current one |
| stronger host surfaces | the same host friction repeats across multiple real workspaces after the current VS Code shell is already stable | current evidence only proves the first host shell exists and passes regression validation | do not open webview-heavy or broader host work yet |
| M15 selective multi-executor scheduling | real adoption must prove the single-Codex PTL model is the bottleneck and write scopes are disjoint | current evidence still points to runtime / host stabilization, not throughput bottlenecks | keep M15 later / evidence-gated |
| single foreground writer per repo | real multi-host or multi-session conflicts must show the current soft lease is insufficient | current signal is only backlog-level concern; no durable adoption evidence says it should be mainline now | keep as follow-up backlog until evidence changes |

## Next Evidence Checks

1. 在更多真实本地 workspace 上继续 dogfood daemon-host baseline，并把 runtime / host / operator docs 摩擦记录回这份 evidence surface。
2. 每次记录新摩擦时，先区分它属于 repo 层、宿主桥接层还是 baseline 包装层，再决定是否改 roadmap 或 backlog。
3. 只有当这份 evidence surface 出现重复的 real-workspace 信号时，才提升 release packaging、强宿主表面或 `M15` 相关讨论。
