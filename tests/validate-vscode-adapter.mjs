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
const runtimeSource = fs.readFileSync(
  path.join(repoRoot, "adapters", "vscode", "extension-runtime.js"),
  "utf8",
);
const sharedRuntimeSource = fs.readFileSync(
  path.join(repoRoot, "packages", "runtime", "browser-preview.js"),
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
  "workbench.action.restartExtensionHost",
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
assert(
  extensionSource.includes("loadRuntimeModule({ fresh: true })"),
  "Expected extension.js to load the runtime dynamically so the Extension Host does not need a restart for runtime updates.",
);
assert(
  extensionSource.includes("computeAdapterCodeStamp"),
  "Expected extension.js to track adapter-layer hot updates separately from the shared runtime code stamp.",
);
assert(
  extensionSource.includes("Preview runtime changed on disk. The next preview action will use the latest code without restarting Extension Host."),
  "Expected extension.js to advertise hot updates without restarting the Extension Host.",
);
assert(
  runtimeSource.includes("class WorkspaceDocBrowser"),
  "Expected extension-runtime.js to keep the VS Code bridge implementation.",
);
assert(
  sharedRuntimeSource.includes("function buildRawFileServerScript(") &&
    sharedRuntimeSource.includes("function buildBootstrapViewerHtml("),
  "Expected packages/runtime/browser-preview.js to keep the shared preview runtime implementation.",
);

console.log("validate-vscode-adapter: ok");
