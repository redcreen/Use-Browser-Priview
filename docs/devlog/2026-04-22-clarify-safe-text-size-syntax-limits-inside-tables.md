# Clarify safe text-size syntax limits inside tables

- Date: 2026-04-22
- Status: resolved

## Problem

The new safe Markdown text-size syntax uses `|` as part of `[[size:...|...]]`, which is fine in normal paragraphs but conflicts with Markdown table column separators. Without an explicit example in the user docs, other agents are likely to copy that syntax into table cells and generate broken tables.

## Thinking

This is not a renderer bug in the current contract; it is a syntax-boundary rule that needs to be documented where agents learn supported authoring patterns. A concise correct-versus-wrong example in the usage guide is better than hiding the rule in code comments or expecting agents to infer it from parser details.

## Solution

Updated docs/usage.md and docs/usage.zh-CN.md to show that `[[size:...|...]]` must stay outside Markdown tables, added explicit wrong and correct examples, and documented that table cells should remain plain text unless a future table-safe syntax is added.

## Validation

python3 /Users/redcreen/.codex/skills/project-assistant/scripts/validate_gate_set.py . --profile fast

## Follow-Ups

- none

## Related Files

- docs/usage.md, docs/usage.zh-CN.md
