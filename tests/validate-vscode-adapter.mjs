import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const commandId = "redcreen.useBrowserPriview.open";

const adapterPackage = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "adapters", "vscode", "package.json"), "utf8"),
);
const extensionSource = fs.readFileSync(
  path.join(repoRoot, "adapters", "vscode", "extension.js"),
  "utf8",
);

assert.deepEqual(
  adapterPackage.activationEvents,
  [`onCommand:${commandId}`],
  "VS Code adapter should activate only from the context-menu command.",
);

for (const menuId of ["editor/context", "explorer/context", "editor/title/context"]) {
  const items = adapterPackage.contributes?.menus?.[menuId] || [];
  assert(
    items.some((item) => item.command === commandId),
    `Expected ${menuId} to expose ${commandId}.`,
  );
}

assert(
  (adapterPackage.contributes?.menus?.commandPalette || []).some(
    (item) => item.command === commandId && item.when === "false",
  ),
  "Expected command palette contribution to be hidden so only right-click entry points remain.",
);

for (const forbiddenFragment of [
  "createStatusBarItem",
  "onDidChangeWorkspaceFolders",
  "onDidChangeActiveTextEditor",
  "updateStatusBar(",
  "Workspace Doc Browser:",
]) {
  assert(
    !extensionSource.includes(forbiddenFragment),
    `Did not expect extension.js to contain ${forbiddenFragment}.`,
  );
}

assert(
  extensionSource.includes("registerCommand(COMMAND_ID"),
  "Expected extension.js to keep the command handler registration.",
);

console.log("validate-vscode-adapter: ok");
