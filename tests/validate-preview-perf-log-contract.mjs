import assert from "node:assert/strict";
import cp from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const supportRoot = fs.mkdtempSync(path.join(os.tmpdir(), "use-browser-priview-perf-log-"));
process.env.USE_BROWSER_PRIVIEW_SUPPORT_DIR = supportRoot;

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");

const { buildRawFileServerScript, waitForPortReady } = await import(path.join(repoRoot, "packages", "runtime", "browser-preview.js"));

async function allocatePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address !== "object") {
        reject(new Error("Failed to allocate an ephemeral port."));
        return;
      }
      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), "use-browser-priview-perf-server-"));
const workspaceRoot = path.join(sandboxRoot, "repo");
const port = await allocatePort();
const perfLogFile = path.join(supportRoot, "preview-perf.log");

fs.mkdirSync(path.join(workspaceRoot, ".git"), { recursive: true });
fs.writeFileSync(path.join(workspaceRoot, "README.md"), "# Root\n", "utf8");

const child = cp.spawn(process.execPath, ["-e", buildRawFileServerScript(workspaceRoot, port)], {
  cwd: workspaceRoot,
  env: process.env,
  stdio: "ignore",
});

try {
  await waitForPortReady(port);

  const response = await fetch(`http://127.0.0.1:${port}/__workspace_doc_browser__/perf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event: "unit-test",
      durationMs: 12.5,
    }),
  });
  assert.equal(response.status, 204, "Expected perf endpoint to accept browser perf reports.");

  const lines = fs.readFileSync(perfLogFile, "utf8").trim().split("\n").filter(Boolean);
  assert(lines.length >= 1, "Expected perf endpoint to append at least one log line.");
  const latestEntry = JSON.parse(lines.at(-1));
  assert.equal(latestEntry.event, "unit-test", "Expected perf log entry to preserve the reported event name.");
  assert.equal(latestEntry.durationMs, 12.5, "Expected perf log entry to preserve the reported duration.");
} finally {
  if (!child.killed) {
    child.kill("SIGTERM");
  }
  fs.rmSync(sandboxRoot, { recursive: true, force: true });
  fs.rmSync(supportRoot, { recursive: true, force: true });
  delete process.env.USE_BROWSER_PRIVIEW_SUPPORT_DIR;
}

console.log("validate-preview-perf-log-contract: ok");
