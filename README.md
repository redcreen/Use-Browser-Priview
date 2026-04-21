# Use Browser Priview

[English](README.md) | [中文](README.zh-CN.md)

Use Browser Priview is a standalone browser-based file and Markdown preview toolchain for local folders. It is being carved out of the old editor-bound implementation so the same preview experience can be launched from:

- macOS Finder right-click on a folder
- Codex / VS Code editor right-click on Markdown
- future editor adapters that can contribute a context-menu command

## Outcome

Build one reusable preview product instead of repeatedly hiding the logic inside one editor extension.

The target user action is simple:

`Use Browser Priview`

Wherever that action appears, it should open the selected folder or file in a browser and provide the same navigation, Markdown rendering, image/video preview, and directory browsing behavior.

## Current Scope

- standalone macOS install path
- Finder Quick Action for folders
- first editor adapter for Codex / VS Code
- browser preview for directories, Markdown, text, images, and video
- session reuse so the same workspace keeps reusing the same local port when possible

## Install

Run from the repo root:

```bash
bash install.sh
```

What it installs now:

- the first Codex / VS Code adapter into `~/.vscode/extensions`
- the macOS Finder Quick Action `Use Browser Priview`
- removes legacy `redcreen.workspace-doc-browser-*` installs so VS Code keeps a single `Use Browser Priview` entry

## Minimal Configuration

Minimum local requirements:

- macOS for the Finder Quick Action path
- Node.js available locally
- Codex / VS Code 1.100 or newer for the first editor adapter

After install, restart the extension host once:

```text
Developer: Restart Extension Host
```

## Quick Start

1. Clone the repo locally.
2. Run `bash install.sh`.
3. In Codex / VS Code, run `Developer: Restart Extension Host`.
4. Use either of these entry points:
- Finder: right-click a folder item, then choose `Use Browser Priview`
- Codex / VS Code: right-click a Markdown file, then choose `Use Browser Priview`

The current VS Code surface is intentionally right-click only. It does not keep a status-bar `Docs Live` button or a command-palette shortcut.

## Project Shape

- `adapters/vscode/`
  First editor adapter. This is the current Codex / VS Code integration layer.
- `install.sh`
  Local installer for the adapter plus the macOS Finder Quick Action.
- `docs/`
  Public project docs.
- `.codex/`
  Live maintainer control surface.

## Documentation Map

- [Docs Home](docs/README.md)
- [Architecture](docs/architecture.md)
- [Roadmap](docs/roadmap.md)
- [Test Plan](docs/test-plan.md)
- [Development Plan](docs/reference/use-browser-priview/development-plan.md)

## Current Architecture Direction

This first standalone cut intentionally optimizes for extraction speed:

- the preview runtime still lives inside the first VS Code adapter package
- the Finder launcher reuses that runtime instead of inventing a second renderer
- the next architecture milestone is to extract a shared runtime package so future editor adapters do not depend on the VS Code adapter layout

## Status

This repository is now the new product home for Use Browser Priview. The previous `project-assistant` integration is the source it was extracted from, not the long-term home.
