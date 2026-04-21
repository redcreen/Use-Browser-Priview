#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
ADAPTER_DIR="$REPO_ROOT/adapters/vscode"
EXTENSIONS_DIR="${USE_BROWSER_PRIVIEW_VSCODE_EXTENSIONS_DIR:-$HOME/.vscode/extensions}"
SUPPORT_DIR="${USE_BROWSER_PRIVIEW_SUPPORT_DIR:-$HOME/Library/Application Support/Use Browser Priview}"
FINDER_RUNTIME_DIR="${USE_BROWSER_PRIVIEW_FINDER_RUNTIME_DIR:-$SUPPORT_DIR/finder-runtime}"

usage() {
  cat <<'EOF'
Use Browser Priview installer

Usage:
  bash install.sh [--all]
  bash install.sh --vscode
  bash install.sh --finder
  bash install.sh --help

Modes:
  --all      Install both the VS Code adapter and Finder Quick Action
  --vscode   Install only the VS Code / Codex adapter
  --finder   Install only the Finder Quick Action
EOF
}

read_package_field() {
  local package_json="$1"
  local field="$2"
  python3 - "$package_json" "$field" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
print(payload[sys.argv[2]])
PY
}

if [ ! -f "$ADAPTER_DIR/package.json" ]; then
  echo "Missing VS Code adapter package: $ADAPTER_DIR/package.json" >&2
  exit 1
fi

MODE="all"
if [ "${1:-}" != "" ]; then
  case "$1" in
    --all)
      MODE="all"
      ;;
    --vscode)
      MODE="vscode"
      ;;
    --finder)
      MODE="finder"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
fi

if [ "$#" -ne 0 ]; then
  echo "Unexpected extra arguments: $*" >&2
  usage >&2
  exit 1
fi

remove_extension_family() {
  local extension_prefix="$1"
  local old_dir=""
  shopt -s nullglob
  for old_dir in "${EXTENSIONS_DIR}/${extension_prefix}-"*; do
    rm -rf "$old_dir"
  done
  shopt -u nullglob
}

publisher="$(read_package_field "$ADAPTER_DIR/package.json" publisher)"
name="$(read_package_field "$ADAPTER_DIR/package.json" name)"
version="$(read_package_field "$ADAPTER_DIR/package.json" version)"
extension_id="${publisher}.${name}"
install_tree() {
  local source_dir="$1"
  local target_dir="$2"
  rm -rf "$target_dir"
  mkdir -p "$target_dir"
  cp -R "$source_dir/." "$target_dir/"
}

install_vscode() {
  local target_dir="${EXTENSIONS_DIR}/${extension_id}-${version}"
  mkdir -p "$EXTENSIONS_DIR"
  remove_extension_family "$extension_id"
  remove_extension_family "redcreen.workspace-doc-browser"
  install_tree "$ADAPTER_DIR" "$target_dir"
  echo "Installed VS Code / Codex adapter -> $target_dir"
  echo "Next step: in Codex / VS Code run 'Developer: Restart Extension Host'"
}

install_finder() {
  local finder_installer="$FINDER_RUNTIME_DIR/install-macos-finder-quick-action.sh"
  if [ "$(uname -s)" != "Darwin" ]; then
    echo "Finder Quick Action install requires macOS." >&2
    exit 1
  fi
  install_tree "$ADAPTER_DIR" "$FINDER_RUNTIME_DIR"
  if [ ! -f "$finder_installer" ]; then
    echo "Missing Finder installer: $finder_installer" >&2
    exit 1
  fi
  bash "$finder_installer" "$FINDER_RUNTIME_DIR"
}

case "$MODE" in
  all)
    install_vscode
    install_finder
    ;;
  vscode)
    install_vscode
    ;;
  finder)
    install_finder
    ;;
esac
