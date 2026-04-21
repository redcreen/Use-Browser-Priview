# Project Plan

## Current Phase

Standalone baseline closeout and first tagged release.

## Current Execution Line

- Objective: close Stage 1, converge release-facing docs and governance, and ship the first standalone tagged baseline
- Plan Link: standalone baseline release closeout
- Runway: one release closeout pass
- Progress: 3 / 3 tasks complete
- Stop Conditions:
  - blocker requires human direction
  - validation fails and changes the direction
  - business, compatibility, or cost decision requires user judgment
- Validation:
  - current execution line is reflected in `status.md`
  - next checkpoint is explicit

## Execution Tasks

- [x] EL-1 converge release-facing docs, governance paths, and install surfaces
- [x] EL-2 validate repo, installer, and Codex patch gates for release
- [x] EL-3 tag the standalone baseline release from this repo

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
- Signal Basis: the standalone repo now carries its install, rollback, patch, and release contracts in durable files with passing validation
- Problem Class: release closeout and maintenance convergence
- Root Cause Hypothesis: the remaining complexity is future host-bundle churn, which is bounded by the patch playbook and clone-first validation path
- Correct Layer: adapter isolation, release docs, staged host patching, and validation gates
- Rejected Shortcut: cutting a tag without first converging the release-facing docs and recovery paths
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
