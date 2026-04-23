# 2026-04-23 Preview Supervisor For Host-Independent Sessions

## Summary

- added `packages/runtime/preview-supervisor.js` so preview backends run under a dedicated supervisor instead of depending on a plain raw server child
- switched both the Finder launcher and the VS Code / Codex bridge to spawn preview sessions through that supervisor
- documented the new durability model and added a regression test that kills the real preview child and verifies that the supervisor restarts it on the same port

## Why

- overnight failures can still happen even when the browser tab stays open, because the browser is only a client and does not supervise the preview backend
- VS Code / Codex, Finder, and the browser should not all need to remain alive at the same time for the same preview port to survive

## Verification

- `npm test`
- `bash install.sh`
- `python3 /Users/redcreen/.codex/skills/project-assistant/scripts/validate_gate_set.py '/Users/redcreen/Project/Use Browser Priview' --profile fast`
