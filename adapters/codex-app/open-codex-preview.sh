#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$HOME/.codex/workspace-doc-browser/codex-app"
LOG_FILE="$LOG_DIR/codex-app.log"
mkdir -p "$LOG_DIR"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >>"$LOG_FILE"
}

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

notify_error() {
  local message="${1:-Use Browser Priview failed.}"
  /usr/bin/osascript -e "display alert \"Use Browser Priview\" message \"${message//\"/\\\"}\" as critical" >/dev/null 2>&1 || true
}

main() {
  log "[codex-wrapper] args=$*"

  local target_path="${1:-}"
  if [ -z "$target_path" ]; then
    log "[codex-wrapper] missing path"
    notify_error "No file or folder was selected."
    return 1
  fi

  local node_bin=""
  if ! node_bin="$(resolve_node_bin)"; then
    log "[codex-wrapper] node not found"
    notify_error "Node.js was not found. Install Node.js first."
    return 1
  fi

  log "[codex-wrapper] node=$node_bin"
  log "[codex-wrapper] target=$target_path"
  "$node_bin" "$SCRIPT_DIR/open-finder-preview.js" "$target_path" >>"$LOG_FILE" 2>&1
}

main "$@"
