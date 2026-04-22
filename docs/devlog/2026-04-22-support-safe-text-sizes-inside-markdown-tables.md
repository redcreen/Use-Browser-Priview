# Support safe text sizes inside Markdown tables

- Date: 2026-04-22
- Status: resolved

## Problem

Safe Markdown text-size syntax worked in normal paragraphs and blocks, but Markdown table parsing split cells on every pipe character. That made `[[size:...|...]]` break inside tables, which is a poor fit for image-grid documents that naturally pair images with compact metric rows.

## Thinking

Changing users to a second table-only syntax would add cognitive overhead and fragment the authoring model. The simpler product behavior is to keep one size syntax everywhere and make table parsing preserve those tokens before splitting columns. Because the renderer is custom and lightweight, the safest implementation is a narrow protection and restore pass around known safe size tokens rather than a full table parser rewrite.

## Solution

Added a protect-and-restore step around table row parsing so `[[size:sm|...]]` survives Markdown table splitting. Updated the safe text-size contract to cover table support, revised the usage guide in English and Chinese with table examples, and expanded the test plan to state that safe size tokens now work in table cells too.

## Validation

npm test; bash install.sh; python3 /Users/redcreen/.codex/skills/project-assistant/scripts/validate_gate_set.py . --profile fast

## Follow-Ups

- none

## Related Files

- adapters/vscode/extension.js, tests/validate-safe-text-size-contract.mjs, docs/usage.md, docs/usage.zh-CN.md, docs/test-plan.md, docs/test-plan.zh-CN.md
