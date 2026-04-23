import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), "use-browser-priview-supervisor-"));
const supportDir = path.join(sandboxRoot, "support");
process.env.USE_BROWSER_PRIVIEW_SUPPORT_DIR = supportDir;

const {
  spawnPreviewSupervisor,
  SUPERVISOR_LOG_FILE,
} = await import(path.join(repoRoot, "packages", "runtime", "preview-supervisor.js"));
const {
  findFreePort,
  waitForPortReady,
  waitForPortReleased,
} = await import(path.join(repoRoot, "packages", "runtime", "browser-preview.js"));

function getListeningPid(port) {
  try {
    const stdout = execFileSync(
      "lsof",
      ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"],
      {
        encoding: "utf8",
        stdio: "pipe",
      },
    ).trim();
    const firstLine = stdout.split(/\r?\n/).find(Boolean) || "";
    return firstLine ? Number(firstLine) : 0;
  } catch {
    return 0;
  }
}

async function waitForDifferentListenerPid(port, previousPid, attempts = 80, delayMs = 100) {
  for (let index = 0; index < attempts; index += 1) {
    const nextPid = getListeningPid(port);
    if (nextPid && nextPid !== previousPid) {
      return nextPid;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Timed out waiting for port ${port} to be re-listened by a different pid.`);
}

const port = await findFreePort();
const supervisor = spawnPreviewSupervisor(repoRoot, port, {
  detached: false,
  stdio: "ignore",
  env: process.env,
});

try {
  await waitForPortReady(port, 80, 100);

  const firstListenerPid = getListeningPid(port);
  assert(firstListenerPid > 0, "Expected the preview child process to listen on the allocated port.");
  assert.notEqual(firstListenerPid, supervisor.pid, "Expected the supervisor pid to differ from the HTTP listener pid.");

  process.kill(firstListenerPid, "SIGTERM");
  const restartedListenerPid = await waitForDifferentListenerPid(port, firstListenerPid);
  assert.notEqual(restartedListenerPid, firstListenerPid, "Expected the supervisor to restart the preview child on the same port.");

  const supervisorLog = fs.readFileSync(SUPERVISOR_LOG_FILE, "utf8");
  assert(supervisorLog.includes('"event":"child-start"'), "Expected the supervisor log to capture child starts.");
  assert(supervisorLog.includes('"event":"child-exit"'), "Expected the supervisor log to capture child exits.");
} finally {
  try {
    process.kill(supervisor.pid, "SIGTERM");
  } catch {}
  await waitForPortReleased(port, 80, 100);
  fs.rmSync(sandboxRoot, { recursive: true, force: true });
}

console.log("validate-preview-supervisor-restart: ok");
