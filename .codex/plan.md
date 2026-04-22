# Project Plan

## Current Phase

Shared runtime baseline hardened for human-usable preview performance.

## Current Execution Line

- Objective: keep deep note-page previews responsive without regressing shared-runtime behavior or port reuse
- Plan Link: preview performance hardening
- Runway: one hardening pass
- Progress: 3 / 3 tasks complete
- Stop Conditions:
  - blocker requires human direction
  - validation fails and changes the direction
  - business, compatibility, or cost decision requires user judgment
- Validation:
  - current execution line is reflected in `status.md`
  - next checkpoint is explicit

## Execution Tasks

- [x] EL-1 add durable preview performance logging for browser and tree activity
- [x] EL-2 stop large active-path directories from eagerly loading full sibling sets
- [x] EL-3 update docs, tests, and devlog so the performance contract stays durable

## Development Log Capture

- Trigger Level: high
- Auto-Capture When:
  - the root-cause hypothesis changes
  - a reusable mechanism replaces repeated local fixes
  - a retrofit changes governance, architecture, or release policy
  - a tradeoff or rejected shortcut is likely to matter in future work
- Skip When:
  - the change is mechanical or formatting-only
  - no durable reasoning changed
  - the work simply followed an already-approved path
  - the change stayed local and introduced no durable tradeoff

## Architecture Supervision
- Signal: `green`
- Signal Basis: the repo now has one extracted preview runtime that ships into every installed surface, so the next scaling proof is whether new editor adapters can stay thin on top of it
- Problem Class: shared runtime extraction and multi-surface convergence
- Root Cause Hypothesis: if preview behavior drifts back into one host adapter, future surfaces will clone behavior and regress into layout coupling again
- Correct Layer: `packages/runtime/` as the only preview engine, thin launchers, and durable install/test coverage
- Rejected Shortcut: leaving the runtime split only at the VS Code shell boundary and continuing to ship adapter-local runtime copies
- Automatic Review Trigger: no automatic trigger is currently active
- Escalation Gate: continue automatically

## Escalation Model

- Continue Automatically: implementation and validation work stay within the current direction and do not alter business behavior
- Raise But Continue: the assistant sees architectural drift or scope pressure but can still converge within the agreed direction
- Require User Decision: product behavior, compatibility, performance, cost, or UX tradeoffs would change the intended direction

## Slices
- Slice: preview performance hardening
  - Objective: keep deep note-page previews responsive without regressing shared-runtime behavior or port reuse
  - Dependencies: shared runtime extraction and the existing hot-load install chain
  - Risks: large active-path directories can silently fall back to full sibling loads, or future regressions can reintroduce browser jank without leaving durable evidence
  - Validation: `npm test`, `bash install.sh`, and perf logs on real note pages confirm large ancestor directories use branch-mode loading until the user explicitly expands them
  - Exit Condition: preview-perf logs show large active-path directories loading only the focused child on first render and the new tests stay green

- Slice: standalone baseline release closeout
  - Objective: make the repo releaseable as its own tagged product baseline
  - Dependencies: working installers, stable patch rollback, durable docs, and green release gates
  - Risks: release surfaces can diverge from the shipped installer behavior if versioned docs are not kept in sync
  - Validation: release profile gates pass and the tag points to the same install surface the docs describe
  - Exit Condition: a tagged standalone release exists and the repo can reinstall from that release tag

- Slice: preview runtime hot-reload convergence
  - Objective: keep routine preview feature changes hot-loadable inside an already-active VS Code / Codex adapter without restarting Extension Host
  - Dependencies: the standalone baseline release and the existing same-root port preservation rules
  - Risks: Finder can accidentally import editor-only modules, or docs can regress back to telling users to restart the host for updates
  - Validation: `npm test`, `bash install.sh`, and the fast project-assistant gate all pass while installed VS Code and Finder copies match the repo
  - Exit Condition: the adapter uses a stable shell/runtime split, Finder loads the same runtime contract safely, and user-facing install/update docs describe hot updates instead of host restarts

- Slice: shared runtime extraction
  - Objective: move preview runtime out of the VS Code adapter layout into a shared layer
  - Dependencies: stage-1 standalone baseline
  - Risks: Finder and editor launchers stay coupled to one adapter package
  - Validation: a shared runtime package exists and current behavior stays stable after extraction
  - Exit Condition: Finder and editor adapters no longer depend on the VS Code adapter file layout

- Slice: editor adapter expansion
  - Objective: add more editor adapters without rewriting preview behavior each time
  - Dependencies: shared runtime extraction
  - Risks: every new editor repeats the same coupling problem
  - Validation: at least one additional editor adapter is documented and implemented
  - Exit Condition: the repo can add new editors through adapters rather than by cloning the whole runtime
