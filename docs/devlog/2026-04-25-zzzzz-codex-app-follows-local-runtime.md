# 2026-04-25 Codex App Follows Local Runtime

## Summary

- changed the optional Codex app patch so a local-repo install keeps a live reference back to this repo instead of depending only on a copied runtime snapshot
- updated the installed Codex wrapper to prefer `source-repo/adapters/vscode/open-finder-preview.js` when that local source repo is still available
- kept snapshot installs working by falling back to the installed copied runtime when no local source repo link exists

## Why

- the previous fix still required `bash install.sh` after local runtime edits because the Codex app menu path launched a copied runtime under `~/Library/Application Support/Use Browser Priview/codex-app`
- from a user perspective that was the wrong contract: once the patch is installed from the local repo, later local runtime changes should just work without another install step
- the stale behavior only needed to remain for snapshot installs, where no durable local repo path exists to follow

## Verification

- `node tests/validate-install-flows.mjs`
- `node tests/validate-codex-app-patch.mjs`
- `npm test`
- `bash install.sh`
- `python3 /Users/redcreen/.codex/skills/project-assistant/scripts/validate_gate_set.py '/Users/redcreen/Project/Use Browser Priview' --profile fast`
