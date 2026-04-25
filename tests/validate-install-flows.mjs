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

function runRemoteInstall(args, sandbox, archivePath) {
  return execFileSync(
    "bash",
    [
      "-lc",
      `cat ${JSON.stringify(path.join(repoRoot, "install.sh"))} | bash -s -- ${args.join(" ")}`.trim(),
    ],
    {
      cwd: sandbox.tempRoot,
      env: {
        ...buildEnv(sandbox),
        USE_BROWSER_PRIVIEW_ARCHIVE_SOURCE: archivePath,
      },
      encoding: "utf8",
      stdio: "pipe",
    },
  );
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

function expectedCodexRuntimeDir(sandbox) {
  return path.join(sandbox.supportDir, "codex-app");
}

function createSourceArchive(sandbox) {
  const archivePath = path.join(sandbox.tempRoot, "use-browser-priview-source.tar.gz");
  execFileSync(
    "tar",
    [
      "-czf",
      archivePath,
      "--exclude=.git",
      "--exclude=node_modules",
      "--exclude=*.tar.gz",
      "-C",
      repoRoot,
      ".",
    ],
    {
      cwd: repoRoot,
      stdio: "pipe",
    },
  );
  return archivePath;
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
    fs.existsSync(path.join(installDir, "extension-runtime.js")),
    "Expected VS Code install to include extension-runtime.js for hot-loaded preview logic.",
  );
  assert(
    fs.existsSync(path.join(installDir, "runtime-loader.js")),
    "Expected VS Code install to include runtime-loader.js for hot-loaded preview logic.",
  );
  assert(
    fs.existsSync(path.join(installDir, "runtime-paths.js")),
    "Expected VS Code install to include runtime-paths.js for repo/install runtime resolution.",
  );
  assert(
    fs.existsSync(path.join(installDir, "packages", "runtime", "browser-preview.js")),
    "Expected VS Code install to include the shared browser preview runtime.",
  );
  assert(
    fs.existsSync(path.join(installDir, "packages", "runtime", "runtime-loader.js")),
    "Expected VS Code install to include the shared runtime loader.",
  );
  assert(
    fs.existsSync(path.join(installDir, "packages", "runtime", "session-store.js")),
    "Expected VS Code install to include the shared session store.",
  );
  assert(
    fs.existsSync(path.join(installDir, "packages", "runtime", "preview-supervisor.js")),
    "Expected VS Code install to include the shared preview supervisor.",
  );
}

function assertFinderInstalled(sandbox) {
  const runtimeDir = expectedFinderRuntimeDir(sandbox);
  const workflowDir = sandbox.workflowDir;
  const workflowSource = fs.readFileSync(path.join(workflowDir, "Contents", "Resources", "document.wflow"), "utf8");

  assert(fs.existsSync(path.join(runtimeDir, "open-finder-preview.js")), "Expected Finder runtime to include open-finder-preview.js.");
  assert(fs.existsSync(path.join(runtimeDir, "open-finder-preview.sh")), "Expected Finder runtime to include open-finder-preview.sh.");
  assert(fs.existsSync(path.join(runtimeDir, "extension-runtime.js")), "Expected Finder runtime to include extension-runtime.js.");
  assert(fs.existsSync(path.join(runtimeDir, "runtime-loader.js")), "Expected Finder runtime to include runtime-loader.js.");
  assert(fs.existsSync(path.join(runtimeDir, "runtime-paths.js")), "Expected Finder runtime to include runtime-paths.js.");
  assert(fs.existsSync(path.join(runtimeDir, "packages", "runtime", "browser-preview.js")), "Expected Finder runtime to include the shared browser preview runtime.");
  assert(fs.existsSync(path.join(runtimeDir, "packages", "runtime", "runtime-loader.js")), "Expected Finder runtime to include the shared runtime loader.");
  assert(fs.existsSync(path.join(runtimeDir, "packages", "runtime", "session-store.js")), "Expected Finder runtime to include the shared session store.");
  assert(fs.existsSync(path.join(runtimeDir, "packages", "runtime", "preview-supervisor.js")), "Expected Finder runtime to include the shared preview supervisor.");
  assert(fs.existsSync(path.join(workflowDir, "Contents", "Info.plist")), "Expected Finder workflow Info.plist.");
  assert(
    workflowSource.includes(path.join(runtimeDir, "open-finder-preview.sh")),
    "Expected Finder workflow to point to the installed runtime wrapper.",
  );
}

function seedCodexRuntime(sandbox) {
  const runtimeDir = expectedCodexRuntimeDir(sandbox);
  fs.mkdirSync(path.join(runtimeDir, "packages", "runtime"), { recursive: true });
  fs.writeFileSync(path.join(runtimeDir, "open-finder-preview.js"), "old-open-finder\n", "utf8");
  fs.writeFileSync(path.join(runtimeDir, "runtime-paths.js"), "old-runtime-paths\n", "utf8");
  fs.writeFileSync(path.join(runtimeDir, "open-codex-preview.sh"), "#!/usr/bin/env bash\necho old\n", "utf8");
  fs.writeFileSync(path.join(runtimeDir, "packages", "runtime", "browser-preview.js"), "old-browser-preview\n", "utf8");
  return runtimeDir;
}

function assertCodexRuntimeSynced(sandbox) {
  const runtimeDir = expectedCodexRuntimeDir(sandbox);
  assert(fs.existsSync(runtimeDir), "Expected Codex app runtime directory to exist.");
  assert.equal(
    fs.readFileSync(path.join(runtimeDir, "open-finder-preview.js"), "utf8"),
    fs.readFileSync(path.join(repoRoot, "adapters", "vscode", "open-finder-preview.js"), "utf8"),
    "Expected Codex app runtime to refresh open-finder-preview.js from the repo.",
  );
  assert.equal(
    fs.readFileSync(path.join(runtimeDir, "runtime-paths.js"), "utf8"),
    fs.readFileSync(path.join(repoRoot, "adapters", "vscode", "runtime-paths.js"), "utf8"),
    "Expected Codex app runtime to refresh runtime-paths.js from the repo.",
  );
  assert.equal(
    fs.readFileSync(path.join(runtimeDir, "open-codex-preview.sh"), "utf8"),
    fs.readFileSync(path.join(repoRoot, "adapters", "codex-app", "open-codex-preview.sh"), "utf8"),
    "Expected Codex app runtime to refresh open-codex-preview.sh from the repo.",
  );
  assert.equal(
    fs.readFileSync(path.join(runtimeDir, "packages", "runtime", "browser-preview.js"), "utf8"),
    fs.readFileSync(path.join(repoRoot, "packages", "runtime", "browser-preview.js"), "utf8"),
    "Expected Codex app runtime to refresh the shared browser preview runtime from the repo.",
  );
  assert(
    fs.existsSync(path.join(runtimeDir, "packages", "runtime", "preview-supervisor.js")),
    "Expected Codex app runtime to include the shared preview supervisor.",
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
  assert(output.includes("--codex-app"), "Expected --help output to mention --codex-app.");
}

function testVscodeOnly() {
  const sandbox = createSandbox();
  const legacyDir = seedLegacyExtension(sandbox);
  seedCodexRuntime(sandbox);
  try {
    const output = runInstall(["--vscode"], sandbox);
    assert(output.includes("Installed VS Code / Codex adapter"), "Expected VS Code install output.");
    assert(output.includes("Synced installed Codex app runtime"), "Expected VS Code install to refresh an already-installed Codex app runtime.");
    assert(output.includes("hot-load without restarting the Extension Host"), "Expected VS Code install to explain runtime hot loading.");
    assert(output.includes("menu does not appear yet"), "Expected VS Code install to explain the first-install fallback.");
    assertExtensionInstalled(sandbox);
    assertCodexRuntimeSynced(sandbox);
    assertMissing(legacyDir, "Expected legacy workspace-doc-browser copy to be removed.");
    assertMissing(sandbox.workflowDir, "VS Code-only install should not create a Finder workflow.");
    assertMissing(expectedFinderRuntimeDir(sandbox), "VS Code-only install should not create Finder runtime files.");
  } finally {
    fs.rmSync(sandbox.tempRoot, { recursive: true, force: true });
  }
}

function testFinderOnly() {
  const sandbox = createSandbox();
  seedCodexRuntime(sandbox);
  try {
    const output = runInstall(["--finder"], sandbox);
    assert(output.includes("Installed Finder Quick Action"), "Expected Finder install output.");
    assert(output.includes("Synced installed Codex app runtime"), "Expected Finder install to refresh an already-installed Codex app runtime.");
    assertFinderInstalled(sandbox);
    assertCodexRuntimeSynced(sandbox);
    assertMissing(sandbox.extensionsDir, "Finder-only install should not create VS Code extension directories.");
  } finally {
    fs.rmSync(sandbox.tempRoot, { recursive: true, force: true });
  }
}

function testAllInstall() {
  const sandbox = createSandbox();
  const legacyDir = seedLegacyExtension(sandbox);
  seedCodexRuntime(sandbox);
  try {
    const output = runInstall([], sandbox);
    assert(output.includes("Installed VS Code / Codex adapter"), "Expected all-install output to include the VS Code adapter.");
    assert(output.includes("Installed Finder Quick Action"), "Expected all-install output to include the Finder Quick Action.");
    assert(output.includes("Synced installed Codex app runtime"), "Expected all-install mode to refresh an already-installed Codex app runtime.");
    assertExtensionInstalled(sandbox);
    assertFinderInstalled(sandbox);
    assertCodexRuntimeSynced(sandbox);
    assertMissing(legacyDir, "Expected all-install mode to remove the legacy workspace-doc-browser copy.");
  } finally {
    fs.rmSync(sandbox.tempRoot, { recursive: true, force: true });
  }
}

function testRemoteVscodeOnlyInstall() {
  const sandbox = createSandbox();
  const archivePath = createSourceArchive(sandbox);
  try {
    const output = runRemoteInstall(["--vscode"], sandbox, archivePath);
    assert(output.includes("Installed VS Code / Codex adapter"), "Expected remote VS Code install output.");
    assert(output.includes("hot-load without restarting the Extension Host"), "Expected remote VS Code install to explain runtime hot loading.");
    assert(output.includes("menu does not appear yet"), "Expected remote VS Code install to explain the first-install fallback.");
    assertExtensionInstalled(sandbox);
    assertMissing(sandbox.workflowDir, "Remote VS Code-only install should not create a Finder workflow.");
    assertMissing(expectedFinderRuntimeDir(sandbox), "Remote VS Code-only install should not create Finder runtime files.");
  } finally {
    fs.rmSync(sandbox.tempRoot, { recursive: true, force: true });
  }
}

testHelp();
testVscodeOnly();
testFinderOnly();
testAllInstall();
testRemoteVscodeOnlyInstall();

console.log("validate-install-flows: ok");
