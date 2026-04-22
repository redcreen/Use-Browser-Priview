# Add dedicated usage guide for preview workflows

- Date: 2026-04-22
- Status: resolved

## Problem

README already contained the core install and usage flow, but user-facing instructions were starting to mix everyday usage details with installation and release information. The new safe Markdown text-size syntax also needed a durable place that users can find later without scanning the whole README.

## Thinking

A dedicated usage guide is the right layer for repeatable user operations and supported authoring syntax. It keeps README concise, gives docs home a clearer entry for daily use, and reduces the chance that future feature docs are buried inside long installation sections. Because public docs are bilingual in this repo, the guide also needs an English and Chinese pair with matching links from README and docs home.

## Solution

Added docs/usage.md and docs/usage.zh-CN.md as a focused usage guide covering VS Code, Finder, Codex app link menus, project-root port reuse, and the safe Markdown text-size syntax. Linked the new guide from README, README.zh-CN.md, docs/README.md, and docs/README.zh-CN.md so users can reach it from both the product landing page and the docs home.

## Validation

python3 /Users/redcreen/.codex/skills/project-assistant/scripts/validate_gate_set.py /Users/redcreen/Project/Use\ Browser\ Priview --profile fast

## Follow-Ups

- none

## Related Files

- docs/usage.md, docs/usage.zh-CN.md, README.md, README.zh-CN.md, docs/README.md, docs/README.zh-CN.md
