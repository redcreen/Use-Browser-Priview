#!/usr/bin/env bash
set -euo pipefail

DEFAULT_RELEASE_REF="${USE_BROWSER_PRIVIEW_RELEASE_REF:-v0.0.2}"
DEFAULT_ARCHIVE_SOURCE="https://codeload.github.com/redcreen/Use-Browser-Priview/tar.gz/refs/tags/${DEFAULT_RELEASE_REF}"
REPO_ROOT=""
ADAPTER_DIR=""
EXTENSIONS_DIR="${USE_BROWSER_PRIVIEW_VSCODE_EXTENSIONS_DIR:-$HOME/.vscode/extensions}"
SUPPORT_DIR="${USE_BROWSER_PRIVIEW_SUPPORT_DIR:-$HOME/Library/Application Support/Use Browser Priview}"
FINDER_RUNTIME_DIR="${USE_BROWSER_PRIVIEW_FINDER_RUNTIME_DIR:-$SUPPORT_DIR/finder-runtime}"
BOOTSTRAP_TEMP_DIR=""

usage() {
  cat <<'EOF'
Use Browser Priview installer

Usage:
  bash install.sh [--all]
  bash install.sh --vscode
  bash install.sh --finder
  bash install.sh --codex-app
  bash install.sh --help

Remote:
  curl -fsSL https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/master/install.sh | bash
  curl -fsSL https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/master/install.sh | bash -s -- --vscode
  curl -fsSL https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/master/install.sh | bash -s -- --codex-app

Modes:
  --all      Install both the VS Code adapter and Finder Quick Action
  --vscode   Install only the VS Code / Codex adapter
  --finder   Install only the Finder Quick Action
  --codex-app Install the experimental Codex app Open With patch
EOF
}

cleanup() {
  if [ -n "$BOOTSTRAP_TEMP_DIR" ] && [ -d "$BOOTSTRAP_TEMP_DIR" ]; then
    rm -rf "$BOOTSTRAP_TEMP_DIR"
  fi
}

trap cleanup EXIT

resolve_repo_root() {
  if [ -n "${BASH_SOURCE[0]:-}" ]; then
    cd "$(dirname "${BASH_SOURCE[0]}")" && pwd
    return
  fi
  pwd
}

bootstrap_repo() {
  local archive_source="${USE_BROWSER_PRIVIEW_ARCHIVE_SOURCE:-$DEFAULT_ARCHIVE_SOURCE}"
  local archive_path=""
  local extract_dir=""
  local extracted_root=""

  if [ -z "$archive_source" ]; then
    echo "Missing install archive source." >&2
    exit 1
  fi

  BOOTSTRAP_TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/use-browser-priview-install-XXXXXX")"
  archive_path="$BOOTSTRAP_TEMP_DIR/source.tar.gz"
  extract_dir="$BOOTSTRAP_TEMP_DIR/extracted"
  mkdir -p "$extract_dir"

  if [ -f "$archive_source" ]; then
    cp "$archive_source" "$archive_path"
  else
    curl -fsSL "$archive_source" -o "$archive_path"
  fi

  tar -xzf "$archive_path" -C "$extract_dir"

  if [ -f "$extract_dir/adapters/vscode/package.json" ]; then
    extracted_root="$extract_dir"
  else
    extracted_root="$(find "$extract_dir" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  fi

  if [ -z "$extracted_root" ] || [ ! -f "$extracted_root/adapters/vscode/package.json" ]; then
    echo "Downloaded install source does not contain adapters/vscode/package.json." >&2
    exit 1
  fi

  REPO_ROOT="$extracted_root"
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
    --codex-app)
      MODE="codex-app"
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

REPO_ROOT="$(resolve_repo_root)"
if [ ! -f "$REPO_ROOT/adapters/vscode/package.json" ]; then
  bootstrap_repo
fi
ADAPTER_DIR="$REPO_ROOT/adapters/vscode"

if [ ! -f "$ADAPTER_DIR/package.json" ]; then
  echo "Missing VS Code adapter package: $ADAPTER_DIR/package.json" >&2
  exit 1
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

install_codex_app() {
  if [ "$(uname -s)" != "Darwin" ]; then
    echo "Codex app patch install requires macOS." >&2
    exit 1
  fi
  bash "$REPO_ROOT/adapters/codex-app/install-codex-app.sh"
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
  codex-app)
    install_codex_app
    ;;
esac
