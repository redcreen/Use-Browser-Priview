import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const sourceRepoRoot = path.resolve(path.dirname(__filename), "..");
const require = createRequire(import.meta.url);
const { computeRuntimeCodeStamp } = require(path.join(sourceRepoRoot, "packages", "runtime", "runtime-loader.js"));

async function allocateListeningPort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address !== "object") {
        reject(new Error("Failed to allocate a listening port."));
        return;
      }
      resolve({ port: address.port, server });
    });
  });
}

async function main() {
  const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), "use-browser-priview-shared-session-"));
  const tempHome = path.join(sandboxRoot, "home");
  const tempRepo = path.join(sandboxRoot, "repo");
  const tempSupportDir = path.join(sandboxRoot, "support");
  const selectedSubdir = path.join(tempRepo, "docs", "guides");
  fs.mkdirSync(path.join(tempRepo, ".git"), { recursive: true });
  fs.mkdirSync(selectedSubdir, { recursive: true });

  const codeStamp = computeRuntimeCodeStamp();

  const { port, server } = await allocateListeningPort();
  const sharedSessionFile = path.join(tempSupportDir, "shared-sessions.json");

  try {
    fs.mkdirSync(path.dirname(sharedSessionFile), { recursive: true });
    fs.writeFileSync(sharedSessionFile, `${JSON.stringify({
      [tempRepo]: {
        workspaceRoot: tempRepo,
        workspaceRootRealPath: tempRepo,
        port,
        pid: process.pid,
        browserOpened: true,
        codeStamp,
      },
    }, null, 2)}\n`, "utf8");

    const outputUrl = execFileSync("node", ["adapters/vscode/open-finder-preview.js", selectedSubdir], {
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

    assert(outputUrl.startsWith(`http://127.0.0.1:${port}/`), "Expected Finder flow to reuse the shared session port.");
    assert(outputUrl.endsWith("/docs/guides/"), "Expected Finder flow to retarget the existing session to the selected subdirectory.");

    const sharedSessions = JSON.parse(fs.readFileSync(sharedSessionFile, "utf8"));
    assert.equal(sharedSessions[tempRepo].port, port, "Expected shared session port to remain unchanged after Finder reuse.");
  } finally {
    server.close();
    fs.rmSync(sandboxRoot, { recursive: true, force: true });
  }

  console.log("validate-finder-shared-session-reuse: ok");
}

await main();
