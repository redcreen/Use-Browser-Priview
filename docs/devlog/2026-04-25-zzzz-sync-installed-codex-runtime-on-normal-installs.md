# 2026-04-25 Sync Installed Codex Runtime On Normal Installs

## Summary

- fixed a stale-runtime gap where links opened from the optional Codex app patch could still use old preview code after normal repo installs
- updated `install.sh` so standard install flows now refresh an already-installed `~/Library/Application Support/Use Browser Priview/codex-app` runtime automatically
- added install-flow coverage and updated user docs to explain that Codex runtime sync now happens during ordinary installs

## Why

- the project that failed was `style engine`, but the screenshot and failing open-path came from Codex app, not Finder or the VS Code adapter
- the file itself and the preview backend were healthy; the mismatch was between the repo/runtime and the separately installed Codex app runtime bundle

## Verification

- `node tests/validate-install-flows.mjs`
- `npm test`
- `bash install.sh`
- `python3 /Users/redcreen/.codex/skills/project-assistant/scripts/validate_gate_set.py '/Users/redcreen/Project/Use Browser Priview' --profile fast`
