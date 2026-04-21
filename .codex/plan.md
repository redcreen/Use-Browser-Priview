# Project Plan

## Current Phase

Standalone extraction and first runnable baseline.

## Current Execution Line

- Objective: turn the extracted repo into a real standalone product baseline
- Plan Link: stage-1 standalone baseline
- Runway: one checkpoint-sized execution line
- Progress: 2 / 5 tasks complete
- Stop Conditions:
  - blocker requires human direction
  - validation fails and changes the direction
  - business, compatibility, or cost decision requires user judgment
- Validation:
  - current execution line is reflected in `status.md`
  - next checkpoint is explicit

## Execution Tasks

- [x] EL-1 create the standalone repo and baseline control surface
- [x] EL-2 move the first runnable adapter code into the new repo
- [ ] EL-3 replace template docs with real project docs and install entrypoints
- [ ] EL-4 validate Finder and Codex / VS Code install paths from this repo
- [ ] EL-5 refresh next checkpoint around shared runtime extraction

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
- Signal: `yellow`
- Signal Basis: architecture supervision is guarding against local-only fixes; the current slice is close to a repeated-fix or symptom-only pattern
- Problem Class: architecture supervision is still mostly a policy, not yet a fully encoded operating surface
- Root Cause Hypothesis: the repo may still drift toward local fixes because the architecture judgment is not yet encoded as a reusable state
- Correct Layer: control surface and validation gates
- Rejected Shortcut: relying on free-form prose instead of a reusable architecture-review state
- Automatic Review Trigger: the current slice is close to a repeated-fix or symptom-only pattern
- Escalation Gate: raise but continue

## Escalation Model

- Continue Automatically: implementation and validation work stay within the current direction and do not alter business behavior
- Raise But Continue: the assistant sees architectural drift or scope pressure but can still converge within the agreed direction
- Require User Decision: product behavior, compatibility, performance, cost, or UX tradeoffs would change the intended direction

## Slices
- Slice: stage-1 standalone baseline
  - Objective: make the extracted repo independently understandable, installable, and runnable
  - Dependencies: extracted adapter code, repo docs, local install path
  - Risks: the repo still reads like an internal transplant instead of a standalone product
  - Validation: docs validators pass and the first adapter syntax checks pass
  - Exit Condition: users can install and understand the project from this repo alone

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
