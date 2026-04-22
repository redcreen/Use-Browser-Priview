# Add safe Markdown text-size syntax

- Date: 2026-04-22
- Status: resolved

## Problem

Markdown in Use Browser Priview had fixed body and heading sizes, so users could not intentionally enlarge a short highlight or a whole block without switching to raw HTML. Allowing arbitrary HTML or inline CSS would solve that superficially but would weaken the renderer's safety and predictability.

## Thinking

The right product boundary is a whitelist-based syntax that keeps Markdown authoring simple while preventing arbitrary style injection. Because this previewer uses a custom lightweight renderer instead of a full Markdown-plus-HTML engine, the safest option is to add explicit inline and block directives that map to fixed CSS classes. That keeps rendering deterministic, docs teachable, and future maintenance localized to one parser path.

## Solution

Added safe text-size directives to the Markdown renderer: inline `[[size:lg|...]]` and block `:::size-xl ... :::`, backed by a fixed whitelist of `sm`, `base`, `lg`, `xl`, and `2xl`. The renderer now replaces those directives with dedicated preview classes, while still escaping arbitrary HTML. Added a regression contract test and updated README plus test-plan in both languages with the supported syntax and constraints.

## Validation

npm test; bash install.sh

## Follow-Ups

- none

## Related Files

- adapters/vscode/extension.js, tests/validate-safe-text-size-contract.mjs, README.md, README.zh-CN.md, docs/test-plan.md, docs/test-plan.zh-CN.md, package.json
