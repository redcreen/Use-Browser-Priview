# Use Browser Priview

[English](README.md) | [中文](README.zh-CN.md)

This is the first editor adapter for Use Browser Priview.

It adds browser preview entry points inside Codex / VS Code:

- status bar entry
- Markdown editor right click
- Markdown tab title right click

## Prerequisites

- VS Code 1.100 or newer

## Install

From the standalone repo root:

```bash
bash install.sh
```

Then in Codex / VS Code run:

```text
Developer: Restart Extension Host
```

## What It Adds

- a left-side status-bar button: `Use Browser Priview`
- a command palette entry: `Use Browser Preview`
- browser rendering for directories, Markdown, text, images, and video
- local preview session reuse
- browser-side navigation that feels closer to a repository browser than to a plain raw server

## Notes

- this adapter is the first extraction step, not the final shared-runtime shape
- the preview currently runs from a lightweight local backend and does not require `mkdocs`
