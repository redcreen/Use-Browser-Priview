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

function createSandbox() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "use-browser-priview-install-"));
  return {
    tempRoot,
    extensionsDir: path.join(tempRoot, "extensions"),
    supportDir: path.join(tempRoot, "support"),
    workflowDir: path.join(tempRoot, "Library", "Services", "Use Browser Priview.workflow"),
  };
}

function buildEnv(sandbox) {
  return {
    ...process.env,
    HOME: sandbox.tempRoot,
    USE_BROWSER_PRIVIEW_VSCODE_EXTENSIONS_DIR: sandbox.extensionsDir,
    USE_BROWSER_PRIVIEW_SUPPORT_DIR: sandbox.supportDir,
    USE_BROWSER_PRIVIEW_FINDER_WORKFLOW_DIR: sandbox.workflowDir,
    USE_BROWSER_PRIVIEW_SKIP_SYSTEM_REFRESH: "1",
  };
}

function runInstall(args, sandbox) {
  return execFileSync("bash", ["install.sh", ...args], {
    cwd: repoRoot,
    env: buildEnv(sandbox),
    encoding: "utf8",
    stdio: "pipe",
  });
}

function expectedExtensionDir(sandbox) {
  return path.join(
    sandbox.extensionsDir,
    `${adapterPackage.publisher}.${adapterPackage.name}-${adapterPackage.version}`,
  );
}

function expectedFinderRuntimeDir(sandbox) {
  return path.join(sandbox.supportDir, "finder-runtime");
}

function seedLegacyExtension(sandbox) {
  const legacyDir = path.join(sandbox.extensionsDir, "redcreen.workspace-doc-browser-0.0.1");
  fs.mkdirSync(legacyDir, { recursive: true });
  fs.writeFileSync(path.join(legacyDir, "package.json"), "{}\n", "utf8");
  return legacyDir;
}

function assertExtensionInstalled(sandbox) {
  const installDir = expectedExtensionDir(sandbox);
  assert(fs.existsSync(installDir), "Expected VS Code adapter install directory to exist.");
  assert.equal(
    fs.readFileSync(path.join(installDir, "extension.js"), "utf8"),
    fs.readFileSync(path.join(repoRoot, "adapters", "vscode", "extension.js"), "utf8"),
    "Installed extension.js should match the adapter source.",
  );
  assert(
    fs.existsSync(path.join(installDir, "session-store.js")),
    "Expected VS Code install to include session-store.js for cross-surface reuse.",
  );
}

function assertFinderInstalled(sandbox) {
  const runtimeDir = expectedFinderRuntimeDir(sandbox);
  const workflowDir = sandbox.workflowDir;
  const workflowSource = fs.readFileSync(path.join(workflowDir, "Contents", "Resources", "document.wflow"), "utf8");

  assert(fs.existsSync(path.join(runtimeDir, "open-finder-preview.js")), "Expected Finder runtime to include open-finder-preview.js.");
  assert(fs.existsSync(path.join(runtimeDir, "open-finder-preview.sh")), "Expected Finder runtime to include open-finder-preview.sh.");
  assert(fs.existsSync(path.join(runtimeDir, "session-store.js")), "Expected Finder runtime to include session-store.js.");
  assert(fs.existsSync(path.join(workflowDir, "Contents", "Info.plist")), "Expected Finder workflow Info.plist.");
  assert(
    workflowSource.includes(path.join(runtimeDir, "open-finder-preview.sh")),
    "Expected Finder workflow to point to the installed runtime wrapper.",
  );
}

function assertMissing(targetPath, message) {
  assert(!fs.existsSync(targetPath), message);
}

function testHelp() {
  const output = execFileSync("bash", ["install.sh", "--help"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert(output.includes("--vscode"), "Expected --help output to mention --vscode.");
  assert(output.includes("--finder"), "Expected --help output to mention --finder.");
}

function testVscodeOnly() {
  const sandbox = createSandbox();
  const legacyDir = seedLegacyExtension(sandbox);
  try {
    const output = runInstall(["--vscode"], sandbox);
    assert(output.includes("Installed VS Code / Codex adapter"), "Expected VS Code install output.");
    assert(output.includes("Restart Extension Host"), "Expected VS Code install to remind users to restart the extension host.");
    assertExtensionInstalled(sandbox);
    assertMissing(legacyDir, "Expected legacy workspace-doc-browser copy to be removed.");
    assertMissing(sandbox.workflowDir, "VS Code-only install should not create a Finder workflow.");
    assertMissing(expectedFinderRuntimeDir(sandbox), "VS Code-only install should not create Finder runtime files.");
  } finally {
    fs.rmSync(sandbox.tempRoot, { recursive: true, force: true });
  }
}

function testFinderOnly() {
  const sandbox = createSandbox();
  try {
    const output = runInstall(["--finder"], sandbox);
    assert(output.includes("Installed Finder Quick Action"), "Expected Finder install output.");
    assertFinderInstalled(sandbox);
    assertMissing(sandbox.extensionsDir, "Finder-only install should not create VS Code extension directories.");
  } finally {
    fs.rmSync(sandbox.tempRoot, { recursive: true, force: true });
  }
}

function testAllInstall() {
  const sandbox = createSandbox();
  const legacyDir = seedLegacyExtension(sandbox);
  try {
    const output = runInstall([], sandbox);
    assert(output.includes("Installed VS Code / Codex adapter"), "Expected all-install output to include the VS Code adapter.");
    assert(output.includes("Installed Finder Quick Action"), "Expected all-install output to include the Finder Quick Action.");
    assertExtensionInstalled(sandbox);
    assertFinderInstalled(sandbox);
    assertMissing(legacyDir, "Expected all-install mode to remove the legacy workspace-doc-browser copy.");
  } finally {
    fs.rmSync(sandbox.tempRoot, { recursive: true, force: true });
  }
}

testHelp();
testVscodeOnly();
testFinderOnly();
testAllInstall();

console.log("validate-install-flows: ok");
