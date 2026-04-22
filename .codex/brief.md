# Project Brief

## Delivery Tier
- Tier: `medium`
- Why this tier: multi-session maintenance needs a lightweight but durable control surface
- Last reviewed: 2026-04-22

## Outcome

Create a standalone Use Browser Priview product that can launch the same browser-based local preview from Finder, Codex / VS Code, and future editor adapters.

## Scope

- extract the existing browser-preview implementation into an independent repo
- keep the current Finder Quick Action path working from this repo
- keep the current Codex / VS Code right-click path working from this repo
- define the target architecture for future editor adapters

## Non-Goals

- do not finish every future editor adapter in the first cut
- do not fully extract the shared runtime package before the standalone repo is usable
- do not invent a second renderer for Finder

## Constraints

- preserve current working behavior where possible instead of redesigning the renderer
- the first standalone cut must still work on macOS locally
- the new repo must be able to install itself without depending on the old repo at runtime
- the same project root must keep one preview port across Finder, VS Code / Codex, and runtime upgrades whenever the old port can be reclaimed
- preview runtime feature changes must hot-load inside an already-active VS Code / Codex adapter without restarting the Extension Host
- `packages/runtime/` must remain the single preview-runtime truth; host adapters and launchers should stay thin

## Definition of Done

- this repo has real README, architecture, roadmap, and test-plan docs
- macOS Finder Quick Action can be installed from this repo
- Codex / VS Code right-click adapter can be installed from this repo
- the repo has a clear next step for extracting a shared runtime
