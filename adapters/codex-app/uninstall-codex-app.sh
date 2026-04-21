#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CODEX_ADAPTER_DIR="$SCRIPT_DIR"
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

main() {
  if [ "$(uname -s)" != "Darwin" ]; then
    echo "Codex app patch uninstall requires macOS." >&2
    exit 1
  fi

  local node_bin=""
  if ! node_bin="$(resolve_node_bin)"; then
    echo "Node.js was not found. Install Node.js first." >&2
    exit 1
  fi

  "$node_bin" "$CODEX_ADAPTER_DIR/patch-codex-open-with.js" uninstall
  rm -rf "$CODEX_RUNTIME_DIR"

  echo "Removed Codex app patch -> $CODEX_RUNTIME_DIR"
  echo "Next step: fully quit and reopen Codex"
}

main "$@"
