import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");

const {
  createSessionRecord,
  deleteSessionRecord,
  resolveReusableSessionRecord,
  storeSessionRecord,
} = await import(path.join(repoRoot, "adapters", "vscode", "session-store.js"));

async function main() {
  const reachablePorts = new Set([43111, 43112]);
  const killedPids = [];
  const requestedRoot = path.join(path.sep, "tmp", "demo-repo", "docs", "guides");
  const parentRoot = path.join(path.sep, "tmp", "demo-repo");
  const childRoot = path.join(path.sep, "tmp", "demo-repo", "docs");
  const codeStamp = "stamp-1";

  const sessionMap = {
    [parentRoot]: {
      workspaceRoot: parentRoot,
      workspaceRootRealPath: parentRoot,
      port: 43111,
      pid: 101,
      codeStamp,
    },
    [childRoot]: {
      workspaceRoot: childRoot,
      workspaceRootRealPath: childRoot,
      port: 43112,
      pid: 102,
      serverCodeStamp: codeStamp,
    },
    [path.join(path.sep, "tmp", "stale-repo")]: {
      workspaceRoot: path.join(path.sep, "tmp", "stale-repo"),
      workspaceRootRealPath: path.join(path.sep, "tmp", "stale-repo"),
      port: 49999,
      pid: 103,
      codeStamp: "old-stamp",
    },
  };

  const resolved = await resolveReusableSessionRecord(sessionMap, {
    requestedRoot,
    codeStamp,
    async isPortReachable(port) {
      return reachablePorts.has(port);
    },
    safeKill(pid) {
      killedPids.push(pid);
    },
  });

  assert.equal(resolved.bestReusableSession.workspaceRoot, childRoot, "Expected the closest matching project root to win.");
  assert.equal(resolved.bestReusableSession.port, 43112, "Expected to reuse the closer child-root session.");
  assert.equal(resolved.changed, true, "Expected stale sessions to be pruned.");
  assert.deepEqual(killedPids, [103], "Expected only stale mismatched sessions to be terminated.");

  const stored = storeSessionRecord({}, {
    workspaceRoot: parentRoot,
    port: 43111,
    pid: 201,
    browserOpened: true,
  }, codeStamp, requestedRoot);

  assert(Object.keys(stored).length >= 2, "Expected alias storage to keep both canonical root and requested root entries.");

  const deleted = deleteSessionRecord(stored, parentRoot);
  assert.equal(deleted.changed, true, "Expected deleteSessionRecord to remove matching aliases.");
  assert.equal(Object.keys(deleted.sessions).length, 0, "Expected all aliases for the same root to be removed.");

  const record = createSessionRecord({
    workspaceRoot: parentRoot,
    port: 43111,
    pid: 201,
    browserOpened: true,
  }, codeStamp);

  assert.equal(record.codeStamp, codeStamp, "Expected shared session records to carry the current code stamp.");
  assert.equal(record.workspaceRoot, parentRoot, "Expected shared session records to preserve the original workspace root.");

  console.log("validate-shared-session-store: ok");
}

await main();
