import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const extensionSource = fs.readFileSync(
  path.join(repoRoot, "adapters", "vscode", "extension.js"),
  "utf8",
);

for (const requiredFragment of [
  'const scrollStateKeyPrefix = "workspace-doc-browser.scroll:" + workspaceName + ":";',
  "workspaceDocBrowserEntryId",
  'window.history.scrollRestoration = "manual";',
  "window.sessionStorage",
  "window.addEventListener(\"scroll\", scheduleScrollPositionSave, { passive: true });",
  "window.addEventListener(\"pagehide\", persistScrollPosition);",
  "restoreSavedScrollPosition(5);",
  "scrollToCurrentHashTarget();",
]) {
  assert(
    extensionSource.includes(requiredFragment),
    `Expected extension.js to contain scroll restoration fragment: ${requiredFragment}`,
  );
}

console.log("validate-scroll-restoration-contract: ok");
