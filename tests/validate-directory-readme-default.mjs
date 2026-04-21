import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const sourceRepoRoot = path.resolve(path.dirname(__filename), "..");

function request(targetUrl) {
  return new Promise((resolve, reject) => {
    const req = http.request(targetUrl, { method: "GET" }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body,
        });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function safeKill(pid) {
  if (!pid) {
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {}
}

async function main() {
  const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), "use-browser-priview-directory-readme-"));
  const tempHome = path.join(sandboxRoot, "home");
  const tempRepo = path.join(sandboxRoot, "repo");
  const tempSupportDir = path.join(sandboxRoot, "support");
  const selectedSubdir = path.join(tempRepo, "docs", "guides");
  fs.mkdirSync(path.join(tempRepo, ".git"), { recursive: true });
  fs.mkdirSync(selectedSubdir, { recursive: true });
  fs.writeFileSync(path.join(tempRepo, "README.md"), "# Root\n", "utf8");
  fs.writeFileSync(path.join(selectedSubdir, "README.md"), "# Guides\n", "utf8");

  let spawnedPid = null;
  try {
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

    assert(
      outputUrl.endsWith("/docs/guides/README.md"),
      "Expected directory selection to open the directory README by default.",
    );

    const sharedSessionPath = path.join(tempSupportDir, "shared-sessions.json");
    const sharedSessions = JSON.parse(fs.readFileSync(sharedSessionPath, "utf8"));
    spawnedPid = Object.values(sharedSessions)[0]?.pid || null;

    const directDirectoryResponse = await request(new URL("/docs/guides/", outputUrl));
    assert.equal(directDirectoryResponse.statusCode, 302, "Expected direct directory navigation to redirect.");
    assert.equal(
      directDirectoryResponse.headers.location,
      "/docs/guides/README.md",
      "Expected direct directory navigation to land on the directory README.",
    );

    const rootDirectoryResponse = await request(new URL("/", outputUrl));
    assert.equal(rootDirectoryResponse.statusCode, 302, "Expected workspace root navigation to redirect.");
    assert.equal(
      rootDirectoryResponse.headers.location,
      "/README.md",
      "Expected workspace root navigation to land on the root README.",
    );
  } finally {
    safeKill(spawnedPid);
    fs.rmSync(sandboxRoot, { recursive: true, force: true });
  }

  console.log("validate-directory-readme-default: ok");
}

await main();
