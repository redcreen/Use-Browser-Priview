# Use Browser Priview

[English](README.md) | [中文](README.zh-CN.md)

This is the first editor adapter for Use Browser Priview.

It adds browser preview entry points inside Codex / VS Code:

- Markdown file right click in Explorer
- Markdown editor right click
- Markdown tab title right click

## Prerequisites

- VS Code 1.100 or newer

## Install

From the standalone repo root:

```bash
bash install.sh --vscode
```

Then in Codex / VS Code run:
Runtime updates after activation hot-load without restarting the Extension Host. If this is the first install in an already-open Codex / VS Code window and the menu does not appear yet, reopen the window once.

## What It Adds

- right-click entry points only
- browser rendering for directories, Markdown, text, images, and video
- local preview session reuse
- browser-side navigation that feels closer to a repository browser than to a plain raw server

## Notes

- this adapter is the first extraction step, not the final shared-runtime shape
- the preview currently runs from a lightweight local backend and does not require `mkdocs`
- legacy `workspace-doc-browser` installs are removed by `bash install.sh --vscode` so VS Code keeps a single context-menu action
