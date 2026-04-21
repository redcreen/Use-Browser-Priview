# Use Browser Priview

[English](README.md) | [中文](README.zh-CN.md)

Use Browser Priview opens local folders and Markdown files in your browser with one consistent preview experience.

## What You Get

- Finder folder right-click: `Use Browser Priview`
- VS Code / Codex Markdown right-click: `Use Browser Priview`
- rendered Markdown preview
- directory browsing in the browser
- image, video, and text preview
- local session reuse so the same workspace tends to keep the same port
- the same project root reuses one local preview port across Finder and VS Code / Codex when possible

## Requirements

- macOS
- Node.js available locally
- VS Code / Codex 1.100 or newer if you want the editor integration

## Install

### VS Code / Codex One-Line Install

Recommended if you only want the editor right-click entry and want a single command you can paste:

```bash
curl -fsSL https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/master/install.sh | bash -s -- --vscode
```

After install, run this once in VS Code / Codex:

```text
Developer: Restart Extension Host
```

### Install In The VS Code Extensions UI

If you want to install from the Extensions view instead of Terminal:

1. Prepare a `.vsix` package for this extension.
2. Open the Extensions view in VS Code.
3. Click `...` in the top-right corner.
4. Choose `Install from VSIX...`.
5. Pick the `.vsix` file and then run `Developer: Restart Extension Host`.

The extension is not published to the public VS Code Marketplace yet, so the current supported UI path is `Install from VSIX...`, not search-and-install by name.

### Install Everything

Terminal:

```bash
bash install.sh
```

or directly from GitHub:

```bash
curl -fsSL https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/master/install.sh | bash
```

Finder:

- double-click [install.command](install.command)

This installs:

- the VS Code / Codex adapter
- the Finder Quick Action

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
curl -fsSL https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/master/install.sh | bash -s -- --vscode
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

## How To Use

### In VS Code / Codex

1. Open a local Markdown file.
2. Right-click in the editor, Explorer, or file tab title.
3. Choose `Use Browser Priview`.

The VS Code surface is right-click only. There is no status-bar button and no command-palette shortcut.

### In Finder

1. Right-click a folder item.
2. Choose `Use Browser Priview`.

The stable Finder path is folder-item right-click. Blank-area Finder right-click is not supported by the current Quick Action mechanism.

Port reuse follows the project root, not the folder you clicked:

- project root = the nearest parent that contains `.git`, `.hg`, or `.svn`
- if no such marker exists, the selected folder itself becomes the root
- open `repo/docs/a/` and then `repo/docs/`: same port
- open `repo/docs/a/` and then `repo/`: same port
- open `repo/docs/a/` and then a folder outside that repo: different port

## Update

Run the same install command again:

- everything: `bash install.sh`
- VS Code only: `bash install.sh --vscode`
- Finder only: `bash install.sh --finder`
- remote VS Code only: `curl -fsSL https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/master/install.sh | bash -s -- --vscode`

## Troubleshooting

- VS Code still shows the old menu: run `Developer: Restart Extension Host`
- Finder entry does not appear: right-click a folder item, not blank space
- Browser does not open: make sure Node.js is installed and available in `PATH`

## Docs

- [Docs Home](docs/README.md)
- [Architecture](docs/architecture.md)
- [Roadmap](docs/roadmap.md)
- [Test Plan](docs/test-plan.md)
