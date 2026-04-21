# Project Brief

## Delivery Tier
- Tier: `medium`
- Why this tier: multi-session maintenance needs a lightweight but durable control surface
- Last reviewed: TODO

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

## Definition of Done

- this repo has real README, architecture, roadmap, and test-plan docs
- macOS Finder Quick Action can be installed from this repo
- Codex / VS Code right-click adapter can be installed from this repo
- the repo has a clear next step for extracting a shared runtime
