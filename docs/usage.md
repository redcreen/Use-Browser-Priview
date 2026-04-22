# Usage Guide

[English](usage.md) | [中文](usage.zh-CN.md)

## Open From VS Code / Codex

1. Open a local Markdown file or folder.
2. Right-click in the editor, Explorer, or file tab title.
3. Choose `Use Browser Priview`.

Notes:
- VS Code / Codex only exposes the right-click entry.
- There is no status-bar button.
- There is no command-palette shortcut.
- Runtime updates after activation hot-load without restarting the Extension Host.

## Open From Finder

1. Right-click a folder item.
2. Choose `Use Browser Priview`.

Notes:
- The stable Finder path is folder-item right-click.
- Blank-area Finder right-click is not supported by the current Quick Action mechanism.

## Open From Codex App Link Menus

1. Install the optional Codex app patch.
2. Fully quit and reopen Codex.
3. Right-click a file link inside Codex.
4. Open `Open With` -> `Use Browser Priview`.

## What The Preview Does

- Markdown renders as a document page.
- `.htm` / `.html` render as HTML pages.
- Images, video, and text files render inline.
- If a directory contains `README.md`, preview opens that README first.
- Browser back / forward restores the previous page position inside the same preview tab.

## Project Root And Port Reuse

Port reuse follows the project root, not the subdirectory you clicked.

- project root = the nearest parent that contains `.git`, `.hg`, or `.svn`
- if no such marker exists, the selected folder itself becomes the root
- the same project root keeps one preview port across Finder and VS Code / Codex
- after runtime upgrades, the same project root still keeps the same port when that old port can be reclaimed
- a folder outside that project root starts a different preview port

## Large Directory Behavior

Large directories on the active path do not eagerly render every sibling on first load.

- the preview tree keeps the active branch visible
- very large sibling sets stay on-demand until you manually expand that directory
- manual expand still loads the full directory listing when you ask for it
- this avoids re-rendering hundreds of sibling folders on every refresh for note-style repositories

## Safe Markdown Text Sizes

Markdown text size uses a safe whitelist syntax instead of arbitrary HTML or inline CSS.

### Inline

```md
Normal text and [[size:lg|larger text]] in the same paragraph.
```

### Block

```md
:::size-xl
This whole block is larger.
You can still use **bold**, `code`, and [links](./README.md).
:::
```

### Supported Sizes

- `sm`
- `base`
- `lg`
- `xl`
- `2xl`

### Limits

- arbitrary `<span style="font-size: ...">` is not supported
- arbitrary inline CSS is not supported
- only the fixed size tokens above are supported

### Table Cells

Safe text-size syntax also works inside Markdown table cells:

```md
| [[size:sm|3.4w likes · 2101 saves]] | [[size:sm|2.1w likes · 2588 saves]] |
```

You can mix image links and text-size tokens in the same table:

```md
| [![](<../../notes/demo/note-01.jpg>)](<../../notes/demo/note.md>) | [![](<../../notes/demo/note-02.jpg>)](<../../notes/demo/note-02.md>) |
| [[size:sm|3.4w likes · 2101 saves]] | [[size:sm|2.1w likes · 2588 saves]] |
```

## Troubleshooting

- VS Code still shows no menu right after the first install: reopen the current VS Code / Codex window once
- runtime code changed but the next preview still looks old: trigger `Use Browser Priview` again so the active adapter swaps to the latest runtime
- Finder entry does not appear: right-click a folder item, not blank space
- Codex app menu does not show `Use Browser Priview`: fully quit and reopen Codex after `--codex-app`
- Browser does not open: make sure Node.js is installed and available in `PATH`
- preview still feels slow on one page: inspect `~/Library/Application Support/Use Browser Priview/preview-perf.log` for `tree-request`, `tree-render`, `file-load`, and `longtask`
