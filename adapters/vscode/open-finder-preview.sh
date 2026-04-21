#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$HOME/.codex/workspace-doc-browser/finder"
LOG_FILE="$LOG_DIR/finder.log"
mkdir -p "$LOG_DIR"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >>"$LOG_FILE"
}

get_finder_selection_paths() {
  /usr/bin/osascript <<'APPLESCRIPT'
set outputLines to {}
tell application "Finder"
  try
    repeat with selectedItem in selection
      try
        set end of outputLines to POSIX path of (selectedItem as alias)
      end try
    end repeat
  end try
end tell
set AppleScript's text item delimiters to linefeed
return outputLines as text
APPLESCRIPT
}

get_finder_front_window_path() {
  /usr/bin/osascript <<'APPLESCRIPT'
tell application "Finder"
  try
    if exists Finder window 1 then
      return POSIX path of (target of Finder window 1 as alias)
    end if
  end try
end tell
return ""
APPLESCRIPT
}

collect_target_paths() {
  local cli_paths=("$@")
  local finder_selection_raw=""
  local finder_front_path=""
  local -a selected_paths=()
  local line=""

  finder_selection_raw="$(get_finder_selection_paths 2>/dev/null || true)"
  while IFS= read -r line; do
    [ -n "$line" ] && selected_paths+=("$line")
  done <<<"$finder_selection_raw"
  finder_front_path="$(get_finder_front_window_path 2>/dev/null || true)"

  log "[finder-wrapper] cli_paths=${cli_paths[*]:-}"
  log "[finder-wrapper] finder_selection=${selected_paths[*]:-}"
  log "[finder-wrapper] finder_front=${finder_front_path:-}"

  if [ "${#selected_paths[@]}" -gt 0 ]; then
    printf '%s\n' "${selected_paths[@]}"
    return 0
  fi

  if [ "${#cli_paths[@]}" -gt 0 ]; then
    printf '%s\n' "${cli_paths[@]}"
    return 0
  fi

  if [ -n "$finder_front_path" ]; then
    printf '%s\n' "$finder_front_path"
    return 0
  fi
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
  log "[finder-wrapper] args=$*"
  local node_bin=""
  if ! node_bin="$(resolve_node_bin)"; then
    log "[finder-wrapper] node not found"
    notify_error "Node.js was not found. Install Node.js first."
    return 1
  fi
  log "[finder-wrapper] node=$node_bin"

  local -a target_paths=()
  local target_path=""
  while IFS= read -r target_path; do
    [ -n "$target_path" ] && target_paths+=("$target_path")
  done < <(collect_target_paths "$@")
  if [ "${#target_paths[@]}" -eq 0 ]; then
    log "[finder-wrapper] no selection received"
    notify_error "No folder was selected."
    return 1
  fi
  local status=0
  local selected_path=""
  for selected_path in "${target_paths[@]}"; do
    log "[finder-wrapper] launch $selected_path"
    "$node_bin" "$SCRIPT_DIR/open-finder-preview.js" "$selected_path" >>"$LOG_FILE" 2>&1 || status=$?
    log "[finder-wrapper] exit=$status target=$selected_path"
  done
  return "$status"
}

main "$@"
