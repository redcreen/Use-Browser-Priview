# Use Browser Priview

[English](README.md) | [中文](README.zh-CN.md)

Use Browser Priview opens local folders and Markdown files in your browser with one consistent preview experience.

## Quick Start

For the common path, install the editor right-click entry with one command:

```bash
curl -fsSL https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/v0.0.3/install.sh | bash -s -- --vscode
```

Runtime updates after activation hot-load without restarting the Extension Host. If this is the first install in an already-open VS Code / Codex window and the menu does not appear yet, reopen the window once.

If you want everything on macOS, run:

```bash
bash install.sh
```

## What You Get

- Finder folder right-click: `Use Browser Priview`
- VS Code / Codex Markdown right-click: `Use Browser Priview`
- optional Codex app link right-click: `Open With` -> `Use Browser Priview`
- rendered Markdown preview
- rendered HTML page preview for `.htm` / `.html`
- directory browsing in the browser
- if a directory contains `README.md`, preview opens that README first
- browser back / forward restores the previous page position
- image, video, and text preview
- local session reuse so the same workspace keeps the same port
- the same project root keeps one local preview port across Finder, VS Code / Codex, and runtime upgrades whenever the old port can be reclaimed
- a dedicated preview supervisor keeps the backend alive and restarts the preview child when possible after host reloads or child crashes

## Requirements

- macOS
- Node.js available locally
- VS Code / Codex 1.100 or newer if you want the editor integration

## Minimal Configuration

- VS Code / Codex only: macOS + Node.js + `bash install.sh --vscode`
- Finder only: macOS + Node.js + `bash install.sh --finder`
- Codex app link-menu patch: macOS + Node.js + a locally installed `Codex.app` + `bash install.sh --codex-app`

## Install

### VS Code / Codex One-Line Install

Recommended if you only want the editor right-click entry and want a single command you can paste:

```bash
curl -fsSL https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/v0.0.3/install.sh | bash -s -- --vscode
```

Runtime updates after activation hot-load without restarting the Extension Host. If this is the first install in an already-open VS Code / Codex window and the menu does not appear yet, reopen the window once.

### Install In The VS Code Extensions UI

If you want to install from the Extensions view instead of Terminal:

1. Prepare a `.vsix` package for this extension.
2. Open the Extensions view in VS Code.
3. Click `...` in the top-right corner.
4. Choose `Install from VSIX...`.
5. Pick the `.vsix` file.

If the right-click menu does not appear in an already-open window after the first install, reopen VS Code / Codex once. Runtime updates after activation hot-load without restarting the Extension Host.

The extension is not published to the public VS Code Marketplace yet, so the current supported UI path is `Install from VSIX...`, not search-and-install by name.

### Install Everything

Terminal:

```bash
bash install.sh
```

or directly from GitHub:

```bash
curl -fsSL https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/v0.0.3/install.sh | bash
```

Finder:

- double-click [install.command](install.command)

This installs:

- the VS Code / Codex adapter
- the Finder Quick Action

It does not patch the Codex desktop app menu. That stays opt-in.

### Install VS Code / Codex Only

Terminal:

```bash
bash install.sh --vscode
```

or

```bash
npm run install:vscode
```

or directly from GitHub:

```bash
curl -fsSL https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/v0.0.3/install.sh | bash -s -- --vscode
```

Finder:

- double-click [install-vscode.command](install-vscode.command)

### Install Finder Only

Terminal:

```bash
bash install.sh --finder
```

or

```bash
npm run install:finder
```

Finder:

- double-click [install-finder.command](install-finder.command)

### Optional Codex App Link-Menu Patch

Use this only if you want `Use Browser Priview` inside Codex app's own file-link right-click menu.

If you install that patch from this local repo, the installed Codex wrapper keeps a live link back to this repo and will pick up later runtime changes automatically. Snapshot installs still refresh the runtime under `~/Library/Application Support/Use Browser Priview/codex-app` on later plain `bash install.sh`, `bash install.sh --vscode`, or `bash install.sh --finder` runs, so you do not need to repatch every time.

Terminal:

```bash
bash install.sh --codex-app
```

or directly from GitHub:

```bash
curl -fsSL https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/v0.0.3/install.sh | bash -s -- --codex-app
```

Finder:

- double-click [install-codex-app.command](install-codex-app.command)

This patch is intentionally separate from the normal install flow because it modifies the local `Codex.app` bundle. Re-run it after Codex updates if the menu disappears.

The installer keeps a clean backup app bundle and swaps the app bundle atomically on install / uninstall. It does not rewrite `Resources/app.asar` in place.

To remove the patch later:

```bash
bash adapters/codex-app/uninstall-codex-app.sh
```

## How To Use

For the full user guide, see [Usage Guide](docs/usage.md).

### In VS Code / Codex

1. Open a local Markdown file.
2. Right-click in the editor, Explorer, or file tab title.
3. Choose `Use Browser Priview`.

The VS Code surface is right-click only. There is no status-bar button and no command-palette shortcut.

Local `.htm` / `.html` files opened through the preview stay rendered as HTML pages instead of falling back to plain text.

If the target is a directory and that directory contains `README.md`, preview opens that README first. The directory listing remains the fallback when no README is present.

Back / forward inside the same preview tab restores the previously remembered scroll position instead of always jumping back to the top.

Markdown text size uses a safe whitelist syntax instead of arbitrary HTML or inline CSS:

```md
[[size:lg|This sentence is larger.]]

:::size-xl
This whole block is larger.
You can still use **bold** and [links](./README.md) inside it.
:::
```

Supported sizes: `sm`, `base`, `lg`, `xl`, `2xl`.

### In Finder

1. Right-click a folder item.
2. Choose `Use Browser Priview`.

The stable Finder path is folder-item right-click. Blank-area Finder right-click is not supported by the current Quick Action mechanism.

Port reuse follows the project root, not the folder you clicked:

- project root = the nearest parent that contains `.git`, `.hg`, or `.svn`
- for VS Code / Codex file previews, if no such marker exists, the root falls back upward only as far as `~/`
- for Finder folder selections without a project marker, the selected folder itself remains the root
- open `repo/docs/a/` and then `repo/docs/`: same port
- open `repo/docs/a/` and then `repo/`: same port
- update the runtime and open the same repo again: same port, as long as the old port can be reclaimed
- open `repo/docs/a/` and then a folder outside that repo: different port
- when a directory contains `README.md`, preview lands on that README instead of stopping on the directory listing first

### In Codex App Link Menus

1. Install the optional Codex app patch.
2. Fully quit and reopen Codex.
3. Right-click a file link inside Codex.
4. Open `Open With` -> `Use Browser Priview`.

## Update

Run the same install command again:

- everything: `bash install.sh`
- VS Code only: `bash install.sh --vscode`
- Finder only: `bash install.sh --finder`
- Codex app patch only: `bash install.sh --codex-app`
- remote VS Code only: `curl -fsSL https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/v0.0.3/install.sh | bash -s -- --vscode`

## Troubleshooting

- VS Code still shows the old menu right after the first install: reopen the current VS Code / Codex window once
- runtime code changed but the next preview still looks old: trigger `Use Browser Priview` again so the active adapter swaps to the latest runtime
- Finder entry does not appear: right-click a folder item, not blank space
- Codex app still behaves like an older build: if the patch was installed from this local repo, reopen the preview once and it should follow the repo automatically; if it was installed from a snapshot, run a normal `bash install.sh` to refresh the installed `codex-app` runtime; re-run `--codex-app` only after Codex itself updates
- Codex app patch needs to be removed: run `bash adapters/codex-app/uninstall-codex-app.sh`, then fully quit and reopen Codex
- Browser does not open: make sure Node.js is installed and available in `PATH`

## Docs

- [Docs Home](docs/README.md)
- [Usage Guide](docs/usage.md)
- [Architecture](docs/architecture.md)
- [Roadmap](docs/roadmap.md)
- [Test Plan](docs/test-plan.md)
- [Release Process](RELEASE.md)
