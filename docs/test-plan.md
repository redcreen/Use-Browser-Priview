# Test Plan

[English](test-plan.md) | [中文](test-plan.zh-CN.md)

## Scope and Risk

This project is risky in three places:

- browser preview correctness across directories, Markdown, images, video, and raw-file fetches
- entry-point consistency across Finder and editor adapters
- session reuse correctness so the same workspace tends to keep the same port and does not silently accumulate stale servers

## Acceptance Cases
| Case | Setup | Action | Expected Result |
| --- | --- | --- | --- |
| Folder preview from Finder | macOS, Finder Quick Action installed | Right-click a folder item and run `Use Browser Priview` | Browser opens the selected folder, not an unrelated repo root |
| Markdown preview from Codex / VS Code | adapter installed, local Markdown file open | Right-click a Markdown editor and run `Use Browser Priview` | Browser opens the selected Markdown preview |
| Directory browsing | browser already opened on a folder | Click into a child directory | Directory listing opens and stays in the same preview model |
| Markdown cross-link | browser already opened on a Markdown file | Click a relative Markdown link | Target Markdown opens as rendered preview, not a raw download |
| Image preview | browser opened inside a folder containing images | Click an image file | Image preview opens inside the browser UI |
| Video preview | browser opened inside a folder containing videos | Click a video file | Video player opens and supports playback / seeking |
| Port reuse | same workspace opened twice | Trigger the preview twice from Finder or editor | Existing session is reused when the code stamp still matches |

## Automation Coverage

- `node --check adapters/vscode/extension.js`
- `node --check adapters/vscode/open-finder-preview.js`
- `bash -n adapters/vscode/open-finder-preview.sh`
- `bash -n adapters/vscode/install-macos-finder-quick-action.sh`
- local preview smoke test via `WORKSPACE_DOC_BROWSER_NO_OPEN=1 node adapters/vscode/open-finder-preview.js <path>`

## Manual Checks

- Finder folder-item right click shows `Use Browser Priview`
- Finder launch visibly opens or activates the browser
- Codex / VS Code right click shows `Use Browser Priview`
- editor right-click and Finder right-click both land in the same preview behavior family

## Test Data and Fixtures

- one repo with nested Markdown docs
- one folder with images
- one folder with videos
- one path containing symlinked directories
- one workspace with non-ASCII folder names

## Release Gate

- Finder Quick Action install succeeds on macOS
- Codex / VS Code adapter installs from `install.sh`
- core acceptance cases above pass on a fresh machine
