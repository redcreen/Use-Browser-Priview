# ZZZ tighten safe sm text size for image-table labels

- Date: 2026-04-23
- Status: resolved

## Problem

The earlier `sm` reduction still left some image-table stat lines wide enough to wrap under thumbnail grids. On pages like `search-results.images.md`, the remaining line wraps made the card rows look noisy even though the safe-size syntax itself worked correctly.

## Thinking

This was still a scale-choice issue, not a parser bug. The `sm` tier is used almost entirely for compact metadata, not body copy, so it should bias toward fitting dense labels into narrow grid cells. Reducing the whitelist scale again is simpler and safer than introducing another syntax tier for the same use case.

## Solution

Lowered `markdown-size-sm` again from 0.8em to 0.68em, updated the safe text-size contract so the compact scale is locked in code, and refreshed the English and Chinese usage docs to state explicitly that `sm` is an extra-compact metadata label size intended to prevent line wraps in image-table stats.

## Validation

npm test; bash install.sh; python3 /Users/redcreen/.codex/skills/project-assistant/scripts/validate_gate_set.py "." --profile fast

## Follow-Ups

- If image-table labels still wrap after this, the next adjustment should tighten the table-cell typography or allow a dedicated metadata-specific token instead of shrinking `sm` indefinitely.

## Related Files

- packages/runtime/browser-preview.js, tests/validate-safe-text-size-contract.mjs, docs/usage.md, docs/usage.zh-CN.md
