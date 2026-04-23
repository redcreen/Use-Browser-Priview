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

## Current Runtime Shape

The shared runtime is now extracted into `packages/runtime/`:

- `packages/runtime/browser-preview.js`: shared browser preview engine and raw server builder
- `packages/runtime/session-store.js`: shared same-root session and port reuse rules
- `packages/runtime/runtime-loader.js`: shared runtime code stamp and fresh-load entry
- `packages/runtime/preview-supervisor.js`: shared preview backend supervisor that keeps the actual port-listening child alive and restarts it when needed

The host-specific surfaces now sit on top of that layer:

- `adapters/vscode/extension.js`: stable Extension Host shell with hot-update detection
- `adapters/vscode/extension-runtime.js`: thin VS Code bridge that turns editor context into shared runtime calls
- `adapters/vscode/open-finder-preview.js`: Finder/Codex-app launcher that targets the same shared runtime

This means Finder and VS Code no longer depend on `adapters/vscode/extension.js` or one adapter-owned session-store file as their runtime truth.

## Boundary Rules

- Browser rendering rules belong to the preview runtime, not to Finder-only or editor-only code.
- Host adapters may decide `which path to open`, but not `how Markdown is rendered`.
- Session reuse policy belongs to the runtime or a shared launcher layer, not to one editor only.
- Finder-specific UX concerns such as selection discovery or browser activation stay inside the Finder launcher path.
- Editor-specific UX concerns such as context-menu contribution stay inside the editor adapter.
- Codex desktop patching concerns stay inside `adapters/codex-app/` so the normal VS Code / Finder paths do not inherit app-bundle patch logic.
- The current VS Code adapter is intentionally right-click only. Persistent UI such as startup-driven `Docs Live` status indicators stays out of the adapter surface.

## Next Extraction Target

The current steady-state shape is:

- `packages/runtime/`
- `adapters/vscode/`
- `adapters/codex-app/`
- Finder Quick Action runtime installed from the repo

The next structure target is:

- `adapters/finder/`
- `adapters/<future-editor>/`

The remaining architecture work is no longer "extract the shared runtime"; it is "add more launch surfaces on top of the extracted runtime without forking behavior."
