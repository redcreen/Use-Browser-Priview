# Use Browser Priview Development Plan

[English](development-plan.md) | [中文](development-plan.zh-CN.md)

## Purpose

This document is the durable maintainer-facing execution plan that sits below `docs/roadmap.md` and above the AI control surfaces.

It answers one practical question:

`what should happen next, where should maintainers resume, and what detail sits underneath each roadmap milestone?`

## Related Documents

- [../../roadmap.md](../../roadmap.md)
- [../../test-plan.md](../../test-plan.md)

## How To Use This Plan

1. Read the roadmap first to understand overall progress and the next stage.
2. Read `Overall Progress`, `Execution Task Progress`, and `Ordered Execution Queue` here to know where to resume.
3. Only drop into the internal control docs when you are maintaining the automation itself.

## Overall Progress

| Item | Current Value |
| --- | --- |
| Overall Progress | 2 / 5 execution tasks complete |
| Current Phase | Standalone extraction and first runnable baseline. |
| Active Slice | `stage-1 standalone baseline` |
| Current Objective | turn the extracted repo into a real standalone product baseline |
| Active Slice Exit Signal | docs, install path, and first validations are aligned in this repo |
| Clear Next Move | EL-3 replace template docs with real project docs and install entrypoints |
| Next Candidate Slice | `shared runtime extraction` |

## Current Position

| Item | Current Value | Meaning |
| --- | --- | --- |
| Current Phase | Standalone extraction and first runnable baseline. | Current maintainer-facing phase |
| Active Slice | `stage-1 standalone baseline` | The slice tied to the current execution line |
| Current Execution Line | turn the extracted repo into a real standalone product baseline | What the repo is trying to finish now |
| Validation | repo docs, installer, and first adapter checks stay aligned | The checks that must stay true before moving on |

## Execution Task Progress

| Order | Task | Status |
| --- | --- | --- |
| 1 | EL-1 create the standalone repo and baseline control surface | done |
| 2 | EL-2 move the first runnable adapter code into the new repo | done |
| 3 | EL-3 replace template docs with real project docs and install entrypoints | next |
| 4 | EL-4 validate Finder and Codex / VS Code install paths from this repo | next |
| 5 | EL-5 refresh next checkpoint around shared runtime extraction | queued |

## Milestone Overview

| Milestone | Status | Goal | Depends On | Exit Criteria |
| --- | --- | --- | --- | --- |
| Stage 1: Standalone Repo Baseline | current | make this repo independently understandable and installable | extracted adapter code | docs, installer, and first adapter validations are real |
| Stage 2: Shared Runtime Extraction | next | remove runtime coupling to the VS Code adapter layout | stage 1 baseline | shared runtime exists and adapters consume it |
| Stage 3: Additional Editor Adapters | queued | support more host editors | shared runtime | at least one more editor adapter exists |

## Ordered Execution Queue

| Order | Slice | Status | Objective | Validation |
| --- | --- | --- | --- | --- |
| 1 | `stage-1 standalone baseline` | current | make the extracted repo independently understandable and installable | docs validators and adapter syntax checks pass |
| 2 | `shared runtime extraction` | next | move preview runtime out of the VS Code adapter layout | runtime package exists and current behavior stays stable |
| 3 | `editor adapter expansion` | queued | add adapters beyond Codex / VS Code | adapter install and validation flow is documented |

## Milestone Details

No milestone drill-down could be derived from the roadmap yet.

## Current Next Step

| Next Move | Why |
| --- | --- |
| EL-3 replace template docs with real project docs and install entrypoints | This is the first open execution task and is required before the repo can honestly present itself as a standalone product. |
