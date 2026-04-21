# Architecture

[English](architecture.md) | [中文](architecture.zh-CN.md)

## Intent

Use Browser Priview is a product, not just one editor extension.

The architecture must preserve one consistent browser-preview experience while allowing multiple launch surfaces.

## Top-Level Layers

### 1. Preview Runtime

The preview runtime is the durable engine that knows how to:

- inspect a selected path
- serve directories, Markdown, text, images, and video
- render browser pages with navigation
- map relative links inside Markdown
- reuse live sessions and ports when possible

### 2. Launch Surfaces

Launch surfaces are the entry points that invoke the runtime:

- macOS Finder Quick Action
- Codex / VS Code context menu
- Codex app internal file-link `Open With` menu via an explicit local patch
- future editor adapters

Launch surfaces should stay thin. They should select the correct target and then hand off to the runtime. They should not reimplement rendering rules.

### 3. Adapter Packages

Each host-specific adapter is packaged independently so it can match the host's install and UX model:

- `adapters/vscode/`: first editor adapter
- `adapters/codex-app/`: isolated installer / rollback path for the optional Codex desktop patch
- future adapters: other editors that support context-menu extensions

The Codex desktop patch path uses a staged app-bundle swap with a clean backup bundle. It does not mutate `Resources/app.asar` in place.

## Current Transitional State

The repo has just been extracted from a VS Code-centric implementation. The current state is intentionally transitional:

- the first runnable preview runtime still lives with the VS Code adapter code
- the Finder launcher reuses that runtime rather than creating a second implementation
- the next architecture milestone is to extract a shared runtime package that all adapters can consume directly

This is acceptable for the first standalone cut because it removes repo ownership coupling first, then removes internal runtime coupling second.

## Boundary Rules

- Browser rendering rules belong to the preview runtime, not to Finder-only or editor-only code.
- Host adapters may decide `which path to open`, but not `how Markdown is rendered`.
- Session reuse policy belongs to the runtime or a shared launcher layer, not to one editor only.
- Finder-specific UX concerns such as selection discovery or browser activation stay inside the Finder launcher path.
- Editor-specific UX concerns such as context-menu contribution stay inside the editor adapter.
- Codex desktop patching concerns stay inside `adapters/codex-app/` so the normal VS Code / Finder paths do not inherit app-bundle patch logic.
- The current VS Code adapter is intentionally right-click only. Persistent UI such as startup-driven `Docs Live` status indicators stays out of the adapter surface.

## Future Extraction Target

The target steady-state shape is:

- `packages/runtime/`
- `adapters/finder/`
- `adapters/vscode/`
- `adapters/<future-editor>/`

The current repo is not there yet. The first milestone is to make the product independent and runnable; the second milestone is to finish the runtime extraction.
