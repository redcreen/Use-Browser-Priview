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

const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), "use-browser-priview-lazy-tree-"));
const workspaceRoot = path.join(sandboxRoot, "repo");
const port = await allocatePort();

fs.mkdirSync(path.join(workspaceRoot, ".git"), { recursive: true });
fs.mkdirSync(path.join(workspaceRoot, "docs", "guides"), { recursive: true });
fs.mkdirSync(path.join(workspaceRoot, "notes"), { recursive: true });
fs.writeFileSync(path.join(workspaceRoot, "README.md"), "# Root\n", "utf8");
fs.writeFileSync(path.join(workspaceRoot, "docs", "README.md"), "# Docs\n", "utf8");
fs.writeFileSync(path.join(workspaceRoot, "docs", "guides", "page.md"), "# Guide\n", "utf8");
fs.writeFileSync(path.join(workspaceRoot, "notes", "todo.txt"), "todo\n", "utf8");

const child = cp.spawn(process.execPath, ["-e", buildRawFileServerScript(workspaceRoot, port)], {
  cwd: workspaceRoot,
  env: process.env,
  stdio: "ignore",
});

try {
  await waitForPortReady(port);

  const rootItems = await fetch(`http://127.0.0.1:${port}/__workspace_doc_browser__/tree`).then((response) => response.json());
  assert(Array.isArray(rootItems), "Expected root tree response to be a JSON array.");
  const docsEntry = rootItems.find((item) => item.kind === "directory" && item.path === "docs");
  assert(docsEntry, "Expected root tree response to include the top-level docs directory.");
  assert.equal(docsEntry.hasChildren, true, "Expected top-level directories to expose lazy child availability.");
  assert(!("children" in docsEntry), "Expected root tree response to avoid eager recursive children.");
  assert(!JSON.stringify(rootItems).includes("docs/guides/page.md"), "Expected root tree response to omit deep descendants.");

  const docsItems = await fetch(`http://127.0.0.1:${port}/__workspace_doc_browser__/tree?path=docs`).then((response) => response.json());
  const guidesEntry = docsItems.find((item) => item.kind === "directory" && item.path === "docs/guides");
  assert(guidesEntry, "Expected lazy tree response for docs/ to include the guides subdirectory.");

  const guideItems = await fetch(`http://127.0.0.1:${port}/__workspace_doc_browser__/tree?path=docs/guides`).then((response) => response.json());
  assert(
    guideItems.some((item) => item.kind === "markdown" && item.sourcePath === "docs/guides/page.md"),
    "Expected lazy tree response for docs/guides to include its markdown file.",
  );
} finally {
  if (!child.killed) {
    child.kill("SIGTERM");
  }
  fs.rmSync(sandboxRoot, { recursive: true, force: true });
}

console.log("validate-lazy-tree-loading: ok");
