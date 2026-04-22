import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const runtimeSource = fs.readFileSync(
  path.join(repoRoot, "packages", "runtime", "browser-preview.js"),
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
    runtimeSource.includes(requiredFragment),
    `Expected browser-preview.js to contain scroll restoration fragment: ${requiredFragment}`,
  );
}

console.log("validate-scroll-restoration-contract: ok");
