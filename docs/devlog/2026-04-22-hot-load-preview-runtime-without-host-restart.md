# Hot-load preview runtime without host restart

- Date: 2026-04-22
- Status: resolved

## Problem

Preview feature changes were still effectively tied to restarting the VS Code / Codex Extension Host. That violated the product rule that routine runtime updates should apply from the user's next preview action without asking them to restart the host process.

## Thinking

The root problem was architectural, not just wording. The adapter entry file mixed stable command registration with the mutable preview runtime, so even ordinary renderer or session changes pushed updates back through the host lifecycle. Finder also needed to consume the same runtime logic, which meant a direct `require("vscode")` dependency inside the shared runtime would break non-editor entry points. The fix therefore had to establish a stable shell/runtime boundary and keep editor-only imports lazy.

## Solution

Split the adapter into a thin `extension.js` shell and a hot-loaded `extension-runtime.js` implementation, then added `runtime-loader.js` so the shell can detect runtime file changes and swap controllers on the next preview action without restarting the Extension Host. Moved Finder to load the same runtime exports through that loader, and changed `extension-runtime.js` to lazy-load `vscode` only when the editor path actually needs it. Updated installer messaging, public docs, test-plan coverage, and `.codex` governance so "reopen window only for first-install discovery" is distinct from "runtime updates hot-load automatically."

## Validation

`npm test`; `bash install.sh`; `python3 /Users/redcreen/.codex/skills/project-assistant/scripts/validate_gate_set.py "/Users/redcreen/Project/Use Browser Priview" --profile fast`

## Follow-Ups

- keep routine preview feature work inside `packages/runtime/browser-preview.js` so hot updates stay within the stable shell boundary and do not fork by host

## Related Files

- `adapters/vscode/extension.js`, `adapters/vscode/extension-runtime.js`, `adapters/vscode/runtime-loader.js`, `packages/runtime/browser-preview.js`, `packages/runtime/runtime-loader.js`, `install.sh`, `README.md`, `README.zh-CN.md`, `.codex/brief.md`, `.codex/status.md`
