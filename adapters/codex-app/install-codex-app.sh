#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VSCODE_ADAPTER_DIR="$REPO_ROOT/adapters/vscode"
CODEX_ADAPTER_DIR="$REPO_ROOT/adapters/codex-app"
SUPPORT_DIR="${USE_BROWSER_PRIVIEW_SUPPORT_DIR:-$HOME/Library/Application Support/Use Browser Priview}"
CODEX_RUNTIME_DIR="${USE_BROWSER_PRIVIEW_CODEX_RUNTIME_DIR:-$SUPPORT_DIR/codex-app}"

resolve_node_bin() {
  if [ -n "${WORKSPACE_DOC_BROWSER_NODE_BIN:-}" ] && [ -x "${WORKSPACE_DOC_BROWSER_NODE_BIN:-}" ]; then
    printf '%s\n' "$WORKSPACE_DOC_BROWSER_NODE_BIN"
    return 0
  fi

  for candidate in "/usr/local/bin/node" "/opt/homebrew/bin/node" "/usr/bin/node"; do
    if [ -x "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi

  return 1
}

install_runtime() {
  local runtime_dir="$1"
  rm -rf "$runtime_dir"
  mkdir -p "$runtime_dir"
  cp "$VSCODE_ADAPTER_DIR/extension.js" "$runtime_dir/"
  cp "$VSCODE_ADAPTER_DIR/open-finder-preview.js" "$runtime_dir/"
  cp "$VSCODE_ADAPTER_DIR/session-store.js" "$runtime_dir/"
  cp "$VSCODE_ADAPTER_DIR/package.json" "$runtime_dir/"
  cp "$CODEX_ADAPTER_DIR/open-codex-preview.sh" "$runtime_dir/"
  chmod +x "$runtime_dir/open-codex-preview.sh"
}

main() {
  if [ "$(uname -s)" != "Darwin" ]; then
    echo "Codex app patch install requires macOS." >&2
    exit 1
  fi

  local node_bin=""
  if ! node_bin="$(resolve_node_bin)"; then
    echo "Node.js was not found. Install Node.js first." >&2
    exit 1
  fi

  install_runtime "$CODEX_RUNTIME_DIR"
  "$node_bin" "$CODEX_ADAPTER_DIR/patch-codex-open-with.js" install

  echo "Installed Codex app patch -> $CODEX_RUNTIME_DIR"
  echo "Next step: fully quit and reopen Codex"
}

main "$@"
