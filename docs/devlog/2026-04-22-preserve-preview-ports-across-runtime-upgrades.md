# Preserve preview ports across runtime upgrades

- Date: 2026-04-22
- Status: resolved

## Problem

The same project root was silently switching to a new preview port after runtime code changes, which broke the user-facing rule that one project root should keep one preview session and one port across Finder and VS Code / Codex.

## Thinking

Port reuse was previously gated by codeStamp equality, so upgraded runtimes pruned the old session and immediately allocated a fresh ephemeral port. That matched an internal implementation boundary, but it violated the product contract because users still see one project and expect the same browser entrypoint to survive upgrades when the old port can be reclaimed. The durable rule therefore needed to move into the shared session layer and the project governance files, not stay as an implicit assumption in adapter code.

## Solution

Extended the shared session resolver to surface a preferredPort for stale same-root sessions, then taught both the Finder launcher and the VS Code adapter to stop stale processes, wait for the old port to release, and preferentially bind that original port before falling back. Added regression coverage for same-root stale-session reuse, updated README and test-plan language, and recorded the rule in .codex/brief.md and .codex/status.md so future changes are reviewed against the user-facing contract.

## Validation

npm test; bash install.sh; python3 /Users/redcreen/.codex/skills/project-assistant/scripts/validate_gate_set.py /Users/redcreen/Project/Use\ Browser\ Priview --profile fast

## Follow-Ups

- none

## Related Files

- adapters/vscode/session-store.js, adapters/vscode/extension.js, adapters/vscode/open-finder-preview.js, tests/validate-port-reuse-after-upgrade.mjs, .codex/brief.md, .codex/status.md
