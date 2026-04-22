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
| Overall Progress | 5 / 6 execution tasks complete |
| Current Phase | Shared runtime extracted and baseline human-usable. |
| Active Slice | `shared runtime extraction` |
| Current Objective | keep one shared preview runtime behind Finder, VS Code / Codex, and Codex app launch surfaces |
| Active Slice Exit Signal | `packages/runtime/` is the runtime truth and installed surfaces consume it without regressing behavior |
| Clear Next Move | EL-6 start the first additional editor adapter on top of the extracted runtime |
| Next Candidate Slice | `editor adapter expansion` |

## Current Position

| Item | Current Value | Meaning |
| --- | --- | --- |
| Current Phase | Shared runtime extracted and baseline human-usable. | Current maintainer-facing phase |
| Active Slice | `shared runtime extraction` | The slice tied to the current execution line |
| Current Execution Line | keep launch surfaces thin and route all preview behavior through `packages/runtime/` | What the repo is trying to preserve now |
| Validation | `npm test`, `bash install.sh`, and fast project-assistant gates stay green after runtime changes | The checks that must stay true before moving on |

## Execution Task Progress

| Order | Task | Status |
| --- | --- | --- |
| 1 | EL-1 create the standalone repo and baseline control surface | done |
| 2 | EL-2 move the first runnable adapter code into the new repo | done |
| 3 | EL-3 replace template docs with real project docs and install entrypoints | done |
| 4 | EL-4 validate Finder and Codex / VS Code install paths from this repo | done |
| 5 | EL-5 extract the shared preview runtime into `packages/runtime/` | done |
| 6 | EL-6 start the first additional editor adapter on top of the shared runtime | next |

## Milestone Overview

| Milestone | Status | Goal | Depends On | Exit Criteria |
| --- | --- | --- | --- | --- |
| Stage 1: Standalone Repo Baseline | complete | make this repo independently understandable and installable | extracted adapter code | docs, installer, and first adapter validations are real |
| Stage 2: Shared Runtime Extraction | complete | remove runtime coupling to the VS Code adapter layout | stage 1 baseline | shared runtime exists and adapters consume it |
| Stage 3: Additional Editor Adapters | next | support more host editors | shared runtime | at least one more editor adapter exists |

## Ordered Execution Queue

| Order | Slice | Status | Objective | Validation |
| --- | --- | --- | --- | --- |
| 1 | `stage-1 standalone baseline` | complete | make the extracted repo independently understandable and installable | docs validators and adapter syntax checks pass |
| 2 | `shared runtime extraction` | complete | move preview runtime out of the VS Code adapter layout | runtime package exists and current behavior stays stable |
| 3 | `editor adapter expansion` | next | add adapters beyond Codex / VS Code | adapter install and validation flow is documented |

## Milestone Details

No milestone drill-down could be derived from the roadmap yet.

## Current Next Step

| Next Move | Why |
| --- | --- |
| EL-6 start the first additional editor adapter on top of the shared runtime | The standalone product is now independently installable and internally decoupled; the next leverage point is proving that `packages/runtime/` really supports more than one editor surface. |
