# Project Status

## Delivery Tier
- Tier: `medium`
- Why this tier: multi-session maintenance needs a lightweight but durable control surface
- Last reviewed: 2026-04-22

## Current Phase

Shared runtime baseline hardened for human-usable preview performance.

## Active Slice

preview performance hardening

## Current Execution Line

- Objective: keep deep note-page previews responsive without regressing shared-runtime behavior or port reuse
- Plan Link: preview performance hardening
- Runway: one hardening pass
- Progress: 3 / 3 tasks complete
- Stop Conditions:
  - blocker requires human direction
  - validation fails and changes the direction
  - business, compatibility, or cost decision requires user judgment

## Execution Tasks

- [x] EL-1 add durable preview performance logging for browser and tree activity
- [x] EL-2 stop large active-path directories from eagerly loading full sibling sets
- [x] EL-3 update docs, tests, and devlog so the performance contract stays durable

## Development Log Capture
- Trigger Level: high
- Pending Capture: no
- Reason: latest devlog already captures the most recent durable reasoning
- Last Entry: `docs/devlog/2026-04-28-codex-patch-and-vscode-root-regression.md`

## Architecture Supervision
- Signal: `green`
- Signal Basis: shared runtime extraction is now the durable truth, so the main remaining risk has shifted from internal coupling to proving the runtime supports more than one editor adapter cleanly
- Root Cause Hypothesis: if future work slips preview rules back into one host adapter, the repo will regress into duplicate behavior and hidden install-path coupling
- Correct Layer: `packages/runtime/` as the only preview engine, thin launch surfaces, and install/test coverage that copies the shared runtime into every shipped surface
- Automatic Review Trigger: no automatic trigger is currently active
- Escalation Gate: continue automatically

## Current Escalation State
- Current Gate: continue automatically
- Reason: the current release line stays inside the agreed product boundary and no user-level tradeoff is open
- Next Review Trigger: review again when a new launch surface cannot stay thin on top of `packages/runtime/`

## Done

- standalone repo created
- first runnable adapter code moved into the repo
- Codex app patch playbook captured in [.codex/codex-app-patch-playbook.md](codex-app-patch-playbook.md)
- release governance, version surface, and release docs aligned with the standalone repo
- same-root preview port preservation across runtime upgrades encoded in code and docs
- shared preview runtime extracted into `packages/runtime/`
- installed VS Code, Finder, and Codex-app paths now carry the shared runtime instead of an adapter-local copy
- deep note-page previews now keep large active-path directories on branch-only loading until the user explicitly expands them
- preview performance logging now lands in `~/Library/Application Support/Use Browser Priview/preview-perf.log`

## In Progress

editor adapter expansion planning
future host-bundle changes that may touch install surfaces

## Blockers / Open Decisions

None.

## Next 3 Actions
1. Start the first non-Codex editor adapter on top of `packages/runtime/`.
2. Keep preview feature work inside `packages/runtime/browser-preview.js` so behavior does not fork by host.
3. Re-check install surfaces after future host updates so the shared runtime still ships into every surface correctly.
