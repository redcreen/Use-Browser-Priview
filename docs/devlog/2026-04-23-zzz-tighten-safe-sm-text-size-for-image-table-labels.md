# ZZZ tighten safe sm text size for image-table labels

- Date: 2026-04-23
- Status: resolved

## Problem

The earlier `sm` reduction still left some image-table stat lines wide enough to wrap under thumbnail grids. On pages like `search-results.images.md`, the remaining line wraps made the card rows look noisy even though the safe-size syntax itself worked correctly.

## Thinking

This was partly a scale-choice issue, but not only that. The `sm` tier is used almost entirely for compact metadata, not body copy, so it can bias toward fitting dense labels into narrow grid cells. But the user-facing problem lived specifically in image-browser tables, so that layout also needed table-specific metadata-row treatment instead of relying forever on smaller global text alone.

## Solution

Lowered `markdown-size-sm` again from 0.8em to 0.68em, then added a specialized image-grid table layout that detects image-browser markdown tables and renders their stats rows as compact no-wrap metadata rows with tighter padding and line-height. Updated the safe text-size contract, the image-table rendering regression, and the English/Chinese usage docs so the repo now records both the smaller `sm` tier and the dedicated image-table layout.

## Validation

npm test; bash install.sh; python3 /Users/redcreen/.codex/skills/project-assistant/scripts/validate_gate_set.py "." --profile fast

## Follow-Ups

- If image-table labels still wrap after this, prefer refining the dedicated image-grid metadata row layout before shrinking `sm` indefinitely again.

## Related Files

- packages/runtime/browser-preview.js, tests/validate-safe-text-size-contract.mjs, tests/validate-image-table-safe-text-size-rendering.mjs, docs/usage.md, docs/usage.zh-CN.md
