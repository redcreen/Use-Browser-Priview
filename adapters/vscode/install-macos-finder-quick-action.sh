#!/usr/bin/env bash
set -euo pipefail

EXTENSION_DIR="${1:-$(cd "$(dirname "$0")" && pwd)}"
WORKFLOW_NAME="Use Browser Priview"
WORKFLOW_DIR="$HOME/Library/Services/${WORKFLOW_NAME}.workflow"
RESOURCES_DIR="$WORKFLOW_DIR/Contents/Resources"
LAUNCHER_PATH="$EXTENSION_DIR/open-finder-preview.js"
WRAPPER_PATH="$EXTENSION_DIR/open-finder-preview.sh"
NODE_BIN="$(command -v node 2>/dev/null || true)"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "Skipping Finder Quick Action install: macOS only"
  exit 0
fi

if [ ! -f "$LAUNCHER_PATH" ]; then
  echo "Missing launcher script: $LAUNCHER_PATH" >&2
  exit 1
fi

if [ ! -f "$WRAPPER_PATH" ]; then
  echo "Missing finder wrapper script: $WRAPPER_PATH" >&2
  exit 1
fi

mkdir -p "$RESOURCES_DIR"

cat >"$WORKFLOW_DIR/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleIdentifier</key>
  <string>ai.redcreen.use-browser-priview.finder</string>
  <key>CFBundleName</key>
  <string>${WORKFLOW_NAME}</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>NSServices</key>
  <array>
    <dict>
      <key>NSMenuItem</key>
      <dict>
        <key>default</key>
        <string>${WORKFLOW_NAME}</string>
      </dict>
      <key>NSMessage</key>
      <string>runWorkflowAsService</string>
      <key>NSSendFileTypes</key>
      <array>
        <string>public.item</string>
        <string>public.folder</string>
        <string>public.directory</string>
      </array>
    </dict>
  </array>
</dict>
</plist>
PLIST

cat >"$RESOURCES_DIR/document.wflow" <<'WFLOW'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>actions</key>
  <array>
    <dict>
      <key>action</key>
      <dict>
        <key>ActionBundlePath</key>
        <string>/System/Library/Automator/Run Shell Script.action</string>
        <key>ActionName</key>
        <string>Run Shell Script</string>
        <key>ActionParameters</key>
        <dict>
          <key>CheckedForUserDefaultShell</key>
          <true/>
          <key>COMMAND_STRING</key>
          <string>export WORKSPACE_DOC_BROWSER_NODE_BIN="__NODE_BIN__"
"__WRAPPER_PATH__" "$@"</string>
          <key>inputMethod</key>
          <integer>1</integer>
          <key>shell</key>
          <string>/bin/zsh</string>
          <key>source</key>
          <string></string>
        </dict>
        <key>AMAccepts</key>
        <dict>
          <key>Container</key>
          <string>List</string>
          <key>Optional</key>
          <false/>
          <key>Types</key>
          <array>
            <string>com.apple.cocoa.path</string>
          </array>
        </dict>
        <key>AMActionVersion</key>
        <string>2.0.3</string>
        <key>AMApplication</key>
        <array>
          <string>Automator</string>
        </array>
        <key>AMParameterProperties</key>
        <dict>
          <key>CheckedForUserDefaultShell</key>
          <dict/>
          <key>COMMAND_STRING</key>
          <dict/>
          <key>inputMethod</key>
          <dict/>
          <key>shell</key>
          <dict/>
          <key>source</key>
          <dict/>
        </dict>
        <key>AMProvides</key>
        <dict>
          <key>Container</key>
          <string>List</string>
          <key>Types</key>
          <array>
            <string>com.apple.cocoa.path</string>
          </array>
        </dict>
        <key>BundleIdentifier</key>
        <string>com.apple.RunShellScript</string>
        <key>Category</key>
        <array>
          <string>AMCategoryUtilities</string>
        </array>
        <key>CFBundleVersion</key>
        <string>2.0.3</string>
        <key>Class Name</key>
        <string>RunShellScriptAction</string>
        <key>CanShowWhenRun</key>
        <true/>
        <key>CanShowSelectedItemsWhenRun</key>
        <false/>
      </dict>
    </dict>
  </array>
  <key>AMApplicationBuild</key>
  <string>346</string>
  <key>AMApplicationVersion</key>
  <string>2.3</string>
  <key>AMDocumentVersion</key>
  <string>2</string>
  <key>workflowMetaData</key>
  <dict>
    <key>serviceApplicationBundleID</key>
    <string></string>
    <key>serviceApplicationPath</key>
    <string></string>
    <key>serviceInputTypeIdentifier</key>
    <string>com.apple.Automator.fileSystemObject</string>
    <key>serviceOutputTypeIdentifier</key>
    <string>com.apple.Automator.nothing</string>
    <key>serviceProcessesInput</key>
    <integer>0</integer>
    <key>workflowTypeIdentifier</key>
    <string>com.apple.Automator.servicesMenu</string>
  </dict>
</dict>
</plist>
WFLOW

python3 - "$RESOURCES_DIR/document.wflow" "$WRAPPER_PATH" "$NODE_BIN" <<'PY'
from pathlib import Path
import sys

workflow_path = Path(sys.argv[1])
wrapper_path = sys.argv[2]
node_bin = sys.argv[3]
workflow_path.write_text(
    workflow_path.read_text(encoding="utf-8").replace("__WRAPPER_PATH__", wrapper_path).replace("__NODE_BIN__", node_bin),
    encoding="utf-8",
)
PY

cat >"$WORKFLOW_DIR/Contents/version.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>BuildVersion</key>
  <string>1</string>
  <key>ProjectName</key>
  <string>${WORKFLOW_NAME}</string>
  <key>SourceVersion</key>
  <string>1</string>
</dict>
</plist>
PLIST

chmod +x "$LAUNCHER_PATH"
chmod +x "$WRAPPER_PATH"
plutil -lint "$WORKFLOW_DIR/Contents/Info.plist" >/dev/null
plutil -lint "$RESOURCES_DIR/document.wflow" >/dev/null
plutil -lint "$WORKFLOW_DIR/Contents/version.plist" >/dev/null
touch "$HOME/Library/Services"
/System/Library/CoreServices/pbs -update >/dev/null 2>&1 || true
killall pbs >/dev/null 2>&1 || true
/System/Library/CoreServices/pbs >/dev/null 2>&1 &
disown || true
killall Finder >/dev/null 2>&1 || true
echo "Installed Finder Quick Action -> $WORKFLOW_DIR"
