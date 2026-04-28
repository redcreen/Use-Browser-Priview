# 2026-04-28 Codex Patch And VS Code Root Regression

## Summary

- updated the Codex app Open With patch matcher for the current Codex bundle shape where the open-target registry is now `var Cd=[...],wd=t.Or("open-in-targets")`
- restored the local Codex app patch on disk and verified the packaged app now contains the `Use Browser Priview` target again
- changed the VS Code / Codex adapter root selection so file previews first use the nearest `.git`, `.hg`, or `.svn` project root, and fall back upward only as far as `~/` when no marker exists

## Why

- Codex app had updated and removed the injected menu target; the old patch locator no longer matched the new bundled registry shape
- VS Code previews for directly opened Markdown files could treat the file's own directory as the preview root, producing URLs such as `/file.md` and breaking relative image links that expected the project root
- the product rule is user-visible: project previews should use the project root, not an implementation-local file directory

## Verification

- `node tests/validate-codex-app-patch.mjs`
- `node tests/validate-vscode-workspace-root-contract.mjs`
- `npm test`
- `bash install.sh`
- `bash install.sh --codex-app`
- `node adapters/codex-app/patch-codex-open-with.js status`
