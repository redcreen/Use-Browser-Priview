# Reduce preview jank on deep note pages

- Date: 2026-04-22
- Status: resolved

## Problem

Opening deep note pages under workspace/sytle-images/xiaohongshu/notes felt slow even when the Markdown file itself was tiny. The preview tree was still causing visible browser jank and there was no durable perf log to explain whether the time was spent in server I/O, network fetches, or browser rendering.

## Thinking

Endpoint timings showed the raw Markdown and preview shell were already fast, so the main suspect shifted to sidebar behavior. The large notes directory had 422 author folders, and the active-path tree logic was loading and rendering that whole sibling set just to keep the current branch visible. The old auto-open details state was also being misread as a user-driven expand action, which silently upgraded the branch view back to a full directory load. Durable perf logs were needed so the same class of regression can be diagnosed without re-learning the code path.

## Solution

Added a local preview perf log at ~/Library/Application Support/Use Browser Priview/preview-perf.log with a server-side /__workspace_doc_browser__/perf endpoint plus browser-side tree-fetch, tree-render, file-load, and longtask reporting. Changed active-path tree loading so large ancestor directories use branch mode and only return the focused child until the user explicitly expands that directory. Separated auto-open branch state from manual openFolders state so initial details toggles no longer promote branch-only directories back to full 422-sibling loads. Added regression tests for focused large-directory loading and the perf-log endpoint, then updated the usage and test-plan docs.

## Validation

npm test; bash install.sh; WORKSPACE_DOC_BROWSER_NO_OPEN=1 node adapters/vscode/open-finder-preview.js /Users/redcreen/Project/style\ engine/workspace/sytle-images/xiaohongshu/notes/素艺/unknown-date-69a76941000000001a02d33d/note-69a76941000000001a02d33d.md; open -g http://127.0.0.1:65043/workspace/sytle-images/xiaohongshu/notes/%E7%B4%A0%E8%89%BA/unknown-date-69a76941000000001a02d33d/note-69a76941000000001a02d33d.md; preview-perf.log confirmed workspace/sytle-images/xiaohongshu/notes switched from full 422-entry loads to branch-mode requests with returnedCount=1

## Follow-Ups

- Watch later logs to decide whether the fixed 3-second tree refresh cadence still needs a visibility-aware backoff.

## Related Files

- packages/runtime/browser-preview.js, tests/validate-focused-tree-loading.mjs, tests/validate-preview-perf-log-contract.mjs, docs/usage.md, docs/usage.zh-CN.md, docs/test-plan.md, docs/test-plan.zh-CN.md
