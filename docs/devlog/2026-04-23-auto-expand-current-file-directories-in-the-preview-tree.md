# Auto-expand current file directories in the preview tree

- Date: 2026-04-23
- Status: resolved

## Problem

Opening a file preview like docs/architecture.zh-CN.md could still leave the sidebar collapsed at its parent directory. That shortened the sidebar tree, hid the active file, and made saved sidebar scroll positions more likely to clamp back to the top.

## Thinking

The lazy tree logic only treated active directories and branch-only ancestors as open. For file pages, the current file parent directory was loaded into the cache but never rendered open, so the tree model and the cached data diverged. From the user perspective this looked like both a missing auto-expand rule and a scroll restoration bug.

## Solution

Updated the tree renderer so file previews always auto-expand the current file parent directory while preserving branch-only lazy loading for higher ancestors. Added a dedicated regression test that opens docs/architecture.zh-CN.md in the bootstrap viewer and verifies that docs/ is rendered open with the active file visible. Updated the test plan to make this expectation explicit.

## Validation

npm test; bash install.sh; python3 /Users/redcreen/.codex/skills/project-assistant/scripts/validate_gate_set.py "." --profile fast

## Follow-Ups

- If sidebar jumping still reproduces after this, the next refinement should anchor restoration to the clicked tree item itself, not only raw scrollTop.

## Related Files

- packages/runtime/browser-preview.js, tests/validate-current-directory-auto-expansion.mjs, docs/test-plan.md, docs/test-plan.zh-CN.md, package.json
