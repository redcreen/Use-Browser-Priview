import assert from "node:assert/strict";
import cp from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), "use-browser-priview-focused-tree-"));
const workspaceRoot = path.join(sandboxRoot, "repo");
const port = await allocatePort();

fs.mkdirSync(path.join(workspaceRoot, ".git"), { recursive: true });
fs.mkdirSync(path.join(workspaceRoot, "notes"), { recursive: true });
for (let index = 0; index < 140; index += 1) {
  const authorDirectory = path.join(workspaceRoot, "notes", `author-${String(index).padStart(3, "0")}`);
  fs.mkdirSync(authorDirectory, { recursive: true });
  fs.writeFileSync(path.join(authorDirectory, "README.md"), `# Author ${index}\n`, "utf8");
}

const child = cp.spawn(process.execPath, ["-e", buildRawFileServerScript(workspaceRoot, port)], {
  cwd: workspaceRoot,
  env: process.env,
  stdio: "ignore",
});

try {
  await waitForPortReady(port);

  const fullItems = await fetch(`http://127.0.0.1:${port}/__workspace_doc_browser__/tree?path=notes`).then((response) => response.json());
  assert(fullItems.length > 100, "Expected the full tree response to include the large sibling set.");

  const focusedItems = await fetch(`http://127.0.0.1:${port}/__workspace_doc_browser__/tree?path=notes&mode=branch&focusChild=notes%2Fauthor-042`).then((response) => response.json());
  assert.equal(focusedItems.length, 1, "Expected branch-mode tree loading to return only the focused child for large directories.");
  assert.equal(focusedItems[0].path, "notes/author-042", "Expected branch-mode tree loading to preserve the active child path.");
} finally {
  if (!child.killed) {
    child.kill("SIGTERM");
  }
  fs.rmSync(sandboxRoot, { recursive: true, force: true });
}

console.log("validate-focused-tree-loading: ok");
