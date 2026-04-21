#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
ADAPTER_DIR="$REPO_ROOT/adapters/vscode"
EXTENSIONS_DIR="${USE_BROWSER_PRIVIEW_VSCODE_EXTENSIONS_DIR:-$HOME/.vscode/extensions}"

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

mkdir -p "$EXTENSIONS_DIR"
publisher="$(read_package_field "$ADAPTER_DIR/package.json" publisher)"
name="$(read_package_field "$ADAPTER_DIR/package.json" name)"
version="$(read_package_field "$ADAPTER_DIR/package.json" version)"
extension_id="${publisher}.${name}"
target_dir="${EXTENSIONS_DIR}/${extension_id}-${version}"

shopt -s nullglob
for old_dir in "${EXTENSIONS_DIR}/${extension_id}-"*; do
  rm -rf "$old_dir"
done
shopt -u nullglob

mkdir -p "$target_dir"
cp -R "$ADAPTER_DIR/." "$target_dir/"
echo "Installed VS Code / Codex adapter -> $target_dir"

if [ "$(uname -s)" = "Darwin" ] && [ -f "$target_dir/install-macos-finder-quick-action.sh" ]; then
  bash "$target_dir/install-macos-finder-quick-action.sh" "$target_dir"
fi

echo "Next step: in Codex / VS Code run 'Developer: Restart Extension Host'"
