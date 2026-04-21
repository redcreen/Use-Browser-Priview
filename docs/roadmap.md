# Roadmap

[English](roadmap.md) | [中文](roadmap.zh-CN.md)

## Overall Progress

| Item | Current Value |
| --- | --- |
| Stage Progress | 1 / 4 stages in progress |
| Current Stage | Stage 1: Standalone Repo Baseline |
| Current Objective | turn the extracted repo into a real standalone product baseline |
| Next Queued Slice | `shared runtime extraction` |
| Detailed Drill-Down | [reference/use-browser-priview/development-plan.md](reference/use-browser-priview/development-plan.md) |

## Milestone Rules

- Each stage represents one durable product milestone.
- A stage is only complete when its stated exit conditions are actually true.
- Detailed execution ordering belongs in the [development plan](reference/use-browser-priview/development-plan.md), not in the stage titles here.

## Stage 1: Standalone Repo Baseline

Status: in progress

Goal:
- move ownership out of `project-assistant`
- keep the current preview behavior runnable in a standalone repo
- provide one local installer for macOS plus the first editor adapter

Exit:
- repo has real docs
- repo has a local install entry
- Finder and Codex / VS Code paths both run from this repo

## Stage 2: Shared Runtime Extraction

Status: next

Goal:
- extract browser preview runtime into a shared package
- stop making Finder launchers depend on a VS Code adapter file layout
- define a stable runtime API for future adapters

Exit:
- shared runtime package exists
- Finder and VS Code adapter both consume that runtime
- renderer behavior stays consistent after extraction

## Stage 3: Additional Editor Adapters

Status: queued

Goal:
- support more editors that can contribute a context-menu action
- preserve one product name and one browser-preview behavior family

Exit:
- at least one non-Codex editor adapter is added
- adapter install and validation flow are documented

## Stage 4: Packaging and Release

Status: queued

Goal:
- add releaseable install flows
- version the repo as a standalone product
- publish install docs that no longer reference `project-assistant`

Exit:
- release procedure exists in this repo
- install links point to this repo rather than the source repo
