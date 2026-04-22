# Extract shared preview runtime

- Date: 2026-04-22
- Status: resolved

## Problem

The repo still described a multi-surface preview product, but the runtime truth was effectively trapped inside `adapters/vscode/`. Finder and Codex-app launchers were either depending on that adapter layout directly or carrying duplicated logic that would drift over time.

## Thinking

The hot-update shell/runtime split fixed one important user-facing problem, but it still left the architecture in an awkward halfway state: VS Code had a clean shell boundary, yet the durable preview engine was not clearly extracted as a shared package. The real product boundary needed to become "one runtime, many launch surfaces", not "one adapter that everybody else borrows from." That also meant the install layout had to ship the shared runtime into every surface, not just reference repo-relative paths that disappear after install.

## Solution

Created `packages/runtime/` as the shared preview-runtime layer with the browser preview engine, session store, and runtime loader. Rewired the VS Code bridge, Finder launcher, and Codex-app runtime install path onto that package, and added `runtime-paths.js` so both repo layout and installed layout resolve the same shared runtime cleanly. Updated install scripts, tests, architecture docs, roadmap, development plan, and `.codex` control surfaces so `packages/runtime/` is now the durable runtime truth and future editor adapters are expected to stay thin on top of it.

## Validation

`npm test`; `bash install.sh`; `python3 /Users/redcreen/.codex/skills/project-assistant/scripts/validate_gate_set.py "/Users/redcreen/Project/Use Browser Priview" --profile fast`

## Follow-Ups

- start the first non-Codex editor adapter to prove `packages/runtime/` scales beyond the current launch surfaces

## Related Files

- `packages/runtime/browser-preview.js`, `packages/runtime/runtime-loader.js`, `packages/runtime/session-store.js`, `adapters/vscode/extension-runtime.js`, `adapters/vscode/open-finder-preview.js`, `adapters/vscode/runtime-loader.js`, `adapters/vscode/runtime-paths.js`, `install.sh`, `adapters/codex-app/install-codex-app.sh`
