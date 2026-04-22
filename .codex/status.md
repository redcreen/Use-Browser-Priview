# Project Status

## Delivery Tier
- Tier: `medium`
- Why this tier: multi-session maintenance needs a lightweight but durable control surface
- Last reviewed: 2026-04-22

## Current Phase

Preview runtime hot-reload convergence.

## Active Slice

preview runtime hot-reload convergence

## Current Execution Line

- Objective: keep preview feature changes hot-loadable without restarting Extension Host while preserving Finder reuse and same-root port rules
- Plan Link: preview runtime hot-reload convergence
- Runway: one runtime-shell convergence pass
- Progress: 3 / 3 tasks complete
- Stop Conditions:
  - blocker requires human direction
  - validation fails and changes the direction
  - business, compatibility, or cost decision requires user judgment

## Execution Tasks

- [x] EL-1 split the VS Code adapter shell from the preview runtime so feature work can hot-load without restarting Extension Host
- [x] EL-2 keep Finder and shared-session flows on the same runtime contract without importing `vscode`
- [x] EL-3 update install/docs/governance language so host restart is no longer the update path

## Development Log Capture
- Trigger Level: high
- Pending Capture: no
- Reason: latest devlog already captures the most recent durable reasoning
- Last Entry: `docs/devlog/2026-04-22-support-safe-text-sizes-inside-markdown-tables.md`

## Architecture Supervision
- Signal: `green`
- Signal Basis: the main remaining product risk is update behavior inside an already-open editor window; same-root port reuse and durable docs already exist, but runtime code still needs a stable hot-load boundary
- Root Cause Hypothesis: when preview behavior, parsing, or session logic lives directly in the extension host entry module, routine feature changes regress back to host restarts or leak editor-only dependencies into Finder
- Correct Layer: stable adapter shell, hot-loaded preview runtime, Finder-safe shared runtime exports, durable docs, and governance rules
- Automatic Review Trigger: no automatic trigger is currently active
- Escalation Gate: continue automatically

## Current Escalation State
- Current Gate: continue automatically
- Reason: the current release line stays inside the agreed product boundary and no user-level tradeoff is open
- Next Review Trigger: review again when a runtime change requires editing the shell instead of the hot-loaded runtime boundary

## Done

- standalone repo created
- first runnable adapter code moved into the repo
- Codex app patch playbook captured in [.codex/codex-app-patch-playbook.md](codex-app-patch-playbook.md)
- release governance, version surface, and release docs aligned with the standalone repo
- same-root preview port preservation across runtime upgrades encoded in code and docs

## In Progress

shared runtime extraction planning
future host-bundle changes that may touch the stable shell boundary

## Blockers / Open Decisions

None.

## Next 3 Actions
1. Keep routine preview work inside `adapters/vscode/extension-runtime.js` so host restarts do not re-enter the update path.
2. Start shared runtime extraction without regressing the new shell/runtime hot-load boundary.
3. Re-check install surfaces after future host updates so the first-install fallback stays distinct from runtime hot updates.
