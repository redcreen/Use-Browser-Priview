import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");

const adapterPackage = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "adapters", "vscode", "package.json"), "utf8"),
);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "use-browser-priview-install-"));
const extensionsDir = path.join(tempRoot, "extensions");
const legacyDir = path.join(extensionsDir, "redcreen.workspace-doc-browser-0.0.1");

fs.mkdirSync(legacyDir, { recursive: true });
fs.writeFileSync(path.join(legacyDir, "package.json"), "{}\n", "utf8");

try {
  execFileSync("bash", ["install.sh"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      USE_BROWSER_PRIVIEW_VSCODE_EXTENSIONS_DIR: extensionsDir,
      USE_BROWSER_PRIVIEW_SKIP_FINDER_INSTALL: "1",
    },
    encoding: "utf8",
    stdio: "pipe",
  });

  const installDir = path.join(
    extensionsDir,
    `${adapterPackage.publisher}.${adapterPackage.name}-${adapterPackage.version}`,
  );

  assert(fs.existsSync(installDir), "Expected install.sh to copy the VS Code adapter.");
  assert(!fs.existsSync(legacyDir), "Expected install.sh to remove the legacy workspace-doc-browser copy.");

  const installedPackage = JSON.parse(
    fs.readFileSync(path.join(installDir, "package.json"), "utf8"),
  );

  assert.equal(installedPackage.name, adapterPackage.name, "Installed package name should match adapter package.");
  assert.equal(
    fs.readFileSync(path.join(installDir, "extension.js"), "utf8"),
    fs.readFileSync(path.join(repoRoot, "adapters", "vscode", "extension.js"), "utf8"),
    "Installed extension.js should match the adapter source.",
  );
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log("validate-install-local: ok");
