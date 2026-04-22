# Make manual sidebar collapse override branch auto-open

- Date: 2026-04-23
- Status: resolved

## Problem

When a page lived inside an auto-expanded branch such as 宋锦, collapsing that branch and then expanding a sibling directory could reopen the original branch. The sidebar also felt jumpy because the current branch reappeared above the clicked target during rerender.

## Thinking

Two separate auto-open rules were fighting the user. First, branch-only directories stayed tagged as promotion targets even after they were already open, which made some current-branch directories hard to close. Second, rerenders had no memory that a user had explicitly collapsed an auto-opened branch, so the active-path heuristics immediately reopened it on the next sibling expansion.

## Solution

Limited branch promotion to closed branch-only placeholders, added a suppressedAutoOpenFolders set in the preview runtime, and made explicit user collapse override active-branch and current-directory auto-open rules until the user reopens that branch. Added a regression test that collapses the current branch, expands a sibling directory, and verifies that the collapsed branch stays closed while sidebar scroll remains stable. Updated usage and test-plan docs to record that manual collapse wins over auto-open.

## Validation

npm test; bash install.sh; python3 /Users/redcreen/.codex/skills/project-assistant/scripts/validate_gate_set.py "." --profile fast

## Follow-Ups

- If sidebar jumpiness still appears after this, the next refinement should restore against the clicked tree node position itself, not only the sidebar scrollTop.

## Related Files

- packages/runtime/browser-preview.js, tests/validate-manual-collapse-beats-auto-open.mjs, docs/test-plan.md, docs/test-plan.zh-CN.md, docs/usage.md, docs/usage.zh-CN.md, package.json
