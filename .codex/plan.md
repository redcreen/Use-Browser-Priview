# Project Plan

## Current Phase

Preview runtime hot-reload convergence.

## Current Execution Line

- Objective: keep preview feature changes hot-loadable without restarting Extension Host while preserving Finder reuse and same-root port rules
- Plan Link: preview runtime hot-reload convergence
- Runway: one runtime-shell convergence pass
- Progress: 3 / 3 tasks complete
- Stop Conditions:
  - blocker requires human direction
  - validation fails and changes the direction
  - business, compatibility, or cost decision requires user judgment
- Validation:
  - current execution line is reflected in `status.md`
  - next checkpoint is explicit

## Execution Tasks

- [x] EL-1 split the VS Code adapter shell from the preview runtime so feature work can hot-load without restarting Extension Host
- [x] EL-2 keep Finder and shared-session flows on the same runtime contract without importing `vscode`
- [x] EL-3 update install/docs/governance language so host restart is no longer the update path

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
- Signal Basis: a stable shell/runtime boundary now carries routine preview changes, while Finder consumes the same runtime contract without importing editor-only modules
- Problem Class: runtime hot-update and cross-surface convergence
- Root Cause Hypothesis: when mutable preview behavior lives in the extension host entrypoint, feature work regresses into host restarts and non-editor consumers inherit editor-only dependencies
- Correct Layer: stable shell, hot-loaded runtime, Finder-safe exports, and durable install/docs guidance
- Rejected Shortcut: keeping all preview logic in `extension.js` and treating host restart as the update mechanism
- Automatic Review Trigger: no automatic trigger is currently active
- Escalation Gate: continue automatically

## Escalation Model

- Continue Automatically: implementation and validation work stay within the current direction and do not alter business behavior
- Raise But Continue: the assistant sees architectural drift or scope pressure but can still converge within the agreed direction
- Require User Decision: product behavior, compatibility, performance, cost, or UX tradeoffs would change the intended direction

## Slices
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
