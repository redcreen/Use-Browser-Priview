# ZZ lower safe sm text size scale

- Date: 2026-04-23
- Status: resolved

## Problem

The safe Markdown text-size whitelist already exposed `sm`, but it still rendered too close to the base body size for dense metadata rows. In image-table stats and compact side notes, `sm` did not visually read as a meaningfully smaller tier.

## Thinking

This was not a syntax or rendering bug. The issue was the scale choice: `sm` was defined at 0.88em, which was only a light trim against the 17px base text. For the preview product, `sm` is mainly used for high-density metadata, so the smallest tier should be noticeably smaller while staying readable.

## Solution

Lowered the `markdown-size-sm` CSS scale from 0.88em to 0.8em, strengthened the safe text-size contract test so it locks the compact scale directly, and updated the usage docs in both languages to clarify that `sm` is intended for dense metadata such as image-table stats and auxiliary notes.

## Validation

npm test; bash install.sh; python3 /Users/redcreen/.codex/skills/project-assistant/scripts/validate_gate_set.py "." --profile fast

## Follow-Ups

- If users still want another tier below `sm`, add it as a new explicit whitelist token instead of continuing to overload `sm`.

## Related Files

- packages/runtime/browser-preview.js, tests/validate-safe-text-size-contract.mjs, docs/usage.md, docs/usage.zh-CN.md
