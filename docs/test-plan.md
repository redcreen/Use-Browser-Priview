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
| VS Code only install | no current adapter or a legacy adapter copy present | Run `bash install.sh --vscode`, restart the extension host, then right-click Markdown in VS Code | The new adapter installs cleanly, legacy `workspace-doc-browser` copies are removed, and only one `Use Browser Priview` context action remains |
| Remote VS Code one-line install | machine has curl access to the public repo | Run `curl -fsSL https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/master/install.sh \| bash -s -- --vscode`, restart the extension host, then right-click Markdown in VS Code | The adapter installs without cloning the repo locally and the VS Code right-click entry works |
| Finder only install | macOS, Finder path not installed yet | Run `bash install.sh --finder`, then right-click a folder item in Finder | Finder Quick Action appears and works without requiring a VS Code extension install |
| Full install | macOS, clean machine or stale install | Run `bash install.sh` | VS Code and Finder entry points both install from one command |
| Codex app patch install | macOS, Codex desktop app installed | Run `bash install.sh --codex-app`, fully quit Codex, reopen it, then right-click a file link inside Codex | `Open With` contains `Use Browser Priview` without affecting the normal VS Code / Finder install paths |
| Codex app patch rollback | macOS, Codex app patch already installed | Run `bash adapters/codex-app/uninstall-codex-app.sh`, then fully quit and reopen Codex | Codex returns to the clean backup bundle and starts without the patch |
| Cross-surface port reuse | A repo preview is already open from VS Code or Finder | Open a child directory from the other surface inside the same repo | The existing preview service is reused and the browser lands on the new target path without allocating a second port |
| Directory browsing | browser already opened on a folder | Click into a child directory | Directory listing opens and stays in the same preview model |
| Markdown cross-link | browser already opened on a Markdown file | Click a relative Markdown link | Target Markdown opens as rendered preview, not a raw download |
| HTML page preview | browser opened on an `.htm` or `.html` file | Open the file through the preview flow | The file renders as an HTML page instead of plain text |
| Image preview | browser opened inside a folder containing images | Click an image file | Image preview opens inside the browser UI |
| Video preview | browser opened inside a folder containing videos | Click a video file | Video player opens and supports playback / seeking |
| Port reuse | same workspace opened twice | Trigger the preview twice from Finder or editor | Existing session is reused when the code stamp still matches |

## Automation Coverage

- `npm test`
- `bash install.sh --help`
- remote installer smoke test via `cat install.sh | bash -s -- --vscode` with `USE_BROWSER_PRIVIEW_ARCHIVE_SOURCE=<archive>`
- `node --check adapters/vscode/extension.js`
- `node --check adapters/vscode/open-finder-preview.js`
- `bash -n adapters/vscode/open-finder-preview.sh`
- `bash -n adapters/vscode/install-macos-finder-quick-action.sh`
- `node --check adapters/codex-app/patch-codex-open-with.js`
- `bash -n adapters/codex-app/open-codex-preview.sh`
- `bash -n adapters/codex-app/install-codex-app.sh`
- `bash -n adapters/codex-app/uninstall-codex-app.sh`
- `bash -n install.command`
- `bash -n install-vscode.command`
- `bash -n install-finder.command`
- `bash -n install-codex-app.command`
- local preview smoke test via `WORKSPACE_DOC_BROWSER_NO_OPEN=1 node adapters/vscode/open-finder-preview.js <path>`
- HTML preview contract via `node tests/validate-html-preview-contract.mjs`
- shared session reuse contract via `node tests/validate-shared-session-store.mjs`
- Codex desktop patch contract via `node tests/validate-codex-app-patch.mjs`

## Manual Checks

- Finder folder-item right click shows `Use Browser Priview`
- Finder launch visibly opens or activates the browser
- Codex / VS Code right click shows exactly one `Use Browser Priview`
- Codex app file-link right click shows `Open With` -> `Use Browser Priview` after the optional patch is installed and Codex is relaunched
- Codex / VS Code does not show a `Docs Live` or `Use Browser Priview` status-bar button
- editor right-click and Finder right-click both land in the same preview behavior family

## Test Data and Fixtures

- one repo with nested Markdown docs
- one folder with images
- one folder with videos
- one path containing symlinked directories
- one workspace with non-ASCII folder names

## Release Gate

- Finder Quick Action install succeeds on macOS
- Codex / VS Code adapter installs from `bash install.sh --vscode` and removes legacy `workspace-doc-browser` copies
- Codex / VS Code adapter also installs from the one-line remote command without requiring a local clone
- Finder Quick Action installs from `bash install.sh --finder` without requiring a VS Code extension install
- `bash install.sh` installs both surfaces together
- `bash install.sh --codex-app` patches Codex app without changing the normal VS Code / Finder install semantics
- Codex patch install also preserves a clean backup bundle and uninstall restores from that backup
- Finder and VS Code / Codex reuse the same port for the same project root
- core acceptance cases above pass on a fresh machine
