import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const sourceRepoRoot = path.resolve(path.dirname(__filename), "..");

async function waitForExit(child, attempts = 120, delayMs = 100) {
  await new Promise((resolve, reject) => {
    let settled = false;
    let remaining = attempts;

    const finish = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    child.once("exit", () => finish());
    child.once("error", finish);

    const poll = () => {
      if (settled) {
        return;
      }
      remaining -= 1;
      if (remaining <= 0) {
        finish(new Error("Timed out waiting for the stale preview server to exit."));
        return;
      }
      setTimeout(poll, delayMs);
    };

    poll();
  });
}

async function waitForPortReady(port, attempts = 120, delayMs = 100) {
  await new Promise((resolve, reject) => {
    let remaining = attempts;

    const tryConnect = () => {
      const socket = net.createConnection({ port, host: "127.0.0.1" });
      const finish = (error) => {
        socket.destroy();
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      };

      socket.once("connect", () => finish());
      socket.once("error", () => {
        remaining -= 1;
        if (remaining <= 0) {
          finish(new Error(`Timed out waiting for test server on port ${port} to become ready.`));
          return;
        }
        setTimeout(tryConnect, delayMs);
      });
    };

    tryConnect();
  });
}

async function allocateEphemeralPort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : null;
      server.close((error) => {
        if (error) {
          reject(error);
        } else if (!port) {
          reject(new Error("Failed to allocate an ephemeral test port."));
        } else {
          resolve(port);
        }
      });
    });
  });
}

async function main() {
  const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), "use-browser-priview-port-upgrade-"));
  const tempHome = path.join(sandboxRoot, "home");
  const tempRepo = path.join(sandboxRoot, "repo");
  const tempSupportDir = path.join(sandboxRoot, "support");
  const selectedFile = path.join(tempRepo, "docs", "guide.md");
  const oldCodeStamp = "old-code-stamp";
  let staleServer = null;
  let canonicalRepoRoot = "";
  let nextSessionPid = null;

  try {
    fs.mkdirSync(path.join(tempRepo, ".git"), { recursive: true });
    fs.mkdirSync(path.dirname(selectedFile), { recursive: true });
    fs.writeFileSync(selectedFile, "# Guide\n", "utf8");
    canonicalRepoRoot = fs.realpathSync.native(tempRepo);
    const oldPort = await allocateEphemeralPort();

    staleServer = spawn(process.execPath, [
      "-e",
      `
        const http = require("http");
        const server = http.createServer((req, res) => {
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("stale");
        });
        server.listen(${oldPort}, "127.0.0.1");
      `,
    ], {
      stdio: "ignore",
    });

    const sharedSessionFile = path.join(tempSupportDir, "shared-sessions.json");
    fs.mkdirSync(path.dirname(sharedSessionFile), { recursive: true });
    fs.writeFileSync(sharedSessionFile, `${JSON.stringify({
      [canonicalRepoRoot]: {
        workspaceRoot: canonicalRepoRoot,
        workspaceRootRealPath: canonicalRepoRoot,
        port: oldPort,
        pid: staleServer.pid,
        browserOpened: true,
        codeStamp: oldCodeStamp,
      },
    }, null, 2)}\n`, "utf8");

    await waitForPortReady(oldPort);

    const outputUrl = execFileSync("node", ["adapters/vscode/open-finder-preview.js", selectedFile], {
      cwd: sourceRepoRoot,
      env: {
        ...process.env,
        HOME: tempHome,
        USE_BROWSER_PRIVIEW_SUPPORT_DIR: tempSupportDir,
        WORKSPACE_DOC_BROWSER_NO_OPEN: "1",
      },
      encoding: "utf8",
      stdio: "pipe",
    }).trim();

    await waitForExit(staleServer);

    assert(outputUrl.startsWith(`http://127.0.0.1:${oldPort}/`), "Expected the upgraded preview flow to reclaim the original port for the same project root.");
    assert(outputUrl.endsWith("/docs/guide.md"), "Expected the preview target to remain the selected Markdown file.");

    const sharedSessions = JSON.parse(fs.readFileSync(sharedSessionFile, "utf8"));
    assert.equal(sharedSessions[canonicalRepoRoot].port, oldPort, "Expected the shared session record to preserve the reclaimed port.");
    assert.notEqual(sharedSessions[canonicalRepoRoot].pid, staleServer.pid, "Expected the upgraded session to be backed by a new server process.");
    nextSessionPid = sharedSessions[canonicalRepoRoot].pid;

    try {
      process.kill(nextSessionPid, "SIGTERM");
    } catch {}
  } finally {
    if (staleServer) {
      try {
        process.kill(staleServer.pid, "SIGTERM");
      } catch {}
    }
    if (nextSessionPid) {
      try {
        process.kill(nextSessionPid, "SIGTERM");
      } catch {}
    }
    fs.rmSync(sandboxRoot, { recursive: true, force: true });
  }

  console.log("validate-port-reuse-after-upgrade: ok");
}

await main();
