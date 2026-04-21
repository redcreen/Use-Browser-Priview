#!/usr/bin/env node
"use strict";

const cp = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PATCH_MARKER = "use-browser-priview-codex-open-target-v1";
const TARGET_ID = "useBrowserPriview";
const TARGET_LABEL = "Use Browser Priview";
const TARGET_VAR_NAME = "useBrowserPriviewCodexOpenTarget";
const BACKUP_BASENAME = "app.asar.original";
const PATCH_STATE_BASENAME = "codex-app-patch-state.json";

function getSupportDir() {
  return process.env.USE_BROWSER_PRIVIEW_SUPPORT_DIR
    || path.join(os.homedir(), "Library", "Application Support", "Use Browser Priview");
}

function getRuntimeDir() {
  return process.env.USE_BROWSER_PRIVIEW_CODEX_RUNTIME_DIR
    || path.join(getSupportDir(), "codex-app");
}

function getRuntimeScriptPath() {
  return process.env.USE_BROWSER_PRIVIEW_CODEX_RUNTIME_SCRIPT
    || path.join(getRuntimeDir(), "open-codex-preview.sh");
}

function getCodexAppPath() {
  return process.env.USE_BROWSER_PRIVIEW_CODEX_APP_PATH || "/Applications/Codex.app";
}

function getAppAsarPath(appPath = getCodexAppPath()) {
  return path.join(appPath, "Contents", "Resources", "app.asar");
}

function getBackupAsarPath() {
  return path.join(getRuntimeDir(), BACKUP_BASENAME);
}

function getPatchStatePath() {
  return path.join(getRuntimeDir(), PATCH_STATE_BASENAME);
}

function ensureDirectory(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function removePath(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function execFile(command, args, options = {}) {
  return cp.execFileSync(command, args, {
    stdio: "pipe",
    encoding: "utf8",
    ...options,
  });
}

function runAsar(args, options = {}) {
  const configuredBinary = process.env.USE_BROWSER_PRIVIEW_ASAR_BIN;
  if (configuredBinary) {
    return execFile(configuredBinary, args, options);
  }
  const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
  return execFile(npxCommand, ["--yes", "@electron/asar", ...args], options);
}

function findMainBundlePath(extractedRoot) {
  const buildDir = path.join(extractedRoot, ".vite", "build");
  if (!fs.existsSync(buildDir)) {
    throw new Error(`Missing Codex main build directory: ${buildDir}`);
  }
  const entries = fs.readdirSync(buildDir)
    .filter((name) => /^main-.*\.js$/.test(name))
    .sort();
  if (entries.length !== 1) {
    throw new Error(`Expected exactly one main-*.js bundle in ${buildDir}, found ${entries.length}.`);
  }
  return path.join(buildDir, entries[0]);
}

function isPatchedMainBundleSource(source) {
  return source.includes(PATCH_MARKER) || source.includes(`id:\`${TARGET_ID}\``);
}

function patchMainBundleSource(source, runtimeScriptPath) {
  if (isPatchedMainBundleSource(source)) {
    return source;
  }

  const registryPattern = /((?:var\s+)|,)([A-Za-z_$][\w$]*)=\[([\s\S]*?)\],([A-Za-z_$][\w$]*)=e\.([A-Za-z_$][\w$]*)\(`open-in-targets`\);/;
  const registryMatch = source.match(registryPattern);
  if (!registryMatch) {
    throw new Error("Unable to locate Codex open-target registry in the main bundle.");
  }

  const targetsVarName = registryMatch[2];
  const runtimeLiteral = JSON.stringify(runtimeScriptPath);
  const patchPrelude = [
    `useBrowserPriviewCodexPatchMarker=${JSON.stringify(PATCH_MARKER)}`,
    `${TARGET_VAR_NAME}={id:\`${TARGET_ID}\`,platforms:{darwin:{label:\`${TARGET_LABEL}\`,icon:null,kind:\`editor\`,detect:()=>require(\`fs\`).existsSync(${runtimeLiteral})?\`/bin/bash\`:null,open:async({path:t})=>{await new Promise((resolve,reject)=>require(\`child_process\`).execFile(\`/bin/bash\`,[${runtimeLiteral},t],error=>error?reject(error):resolve()))}}}}`,
    `${targetsVarName}=[`,
  ].join(",");

  return source.replace(registryPattern, (_match, prefix, _targetsVar, existingTargets, loggerVarName, loggerFactoryName) => {
    const declarationPrefix = prefix === "," ? "," : "var ";
    return `${declarationPrefix}${patchPrelude}${existingTargets},${TARGET_VAR_NAME}],${loggerVarName}=e.${loggerFactoryName}(\`open-in-targets\`);`;
  });
}

function extractAsar(asarPath, extractedRoot) {
  removePath(extractedRoot);
  ensureDirectory(path.dirname(extractedRoot));
  runAsar(["extract", asarPath, extractedRoot]);
}

function packAsar(extractedRoot, targetAsarPath) {
  runAsar(["pack", extractedRoot, targetAsarPath]);
}

function loadMainBundleSourceFromExtractedRoot(extractedRoot) {
  const mainBundlePath = findMainBundlePath(extractedRoot);
  return {
    mainBundlePath,
    source: fs.readFileSync(mainBundlePath, "utf8"),
  };
}

function writePatchState(payload) {
  const statePath = getPatchStatePath();
  ensureDirectory(path.dirname(statePath));
  fs.writeFileSync(statePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function removePatchState() {
  removePath(getPatchStatePath());
}

function assertRuntimeExists(runtimeScriptPath) {
  if (!fs.existsSync(runtimeScriptPath)) {
    throw new Error(`Missing Codex runtime script: ${runtimeScriptPath}`);
  }
}

function assertCodexAppExists(appAsarPath) {
  if (!fs.existsSync(appAsarPath)) {
    throw new Error(`Missing Codex app bundle: ${appAsarPath}`);
  }
}

function installPatch() {
  const appPath = getCodexAppPath();
  const appAsarPath = getAppAsarPath(appPath);
  const runtimeDir = getRuntimeDir();
  const runtimeScriptPath = getRuntimeScriptPath();
  const backupAsarPath = getBackupAsarPath();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "use-browser-priview-codex-patch-"));

  ensureDirectory(runtimeDir);
  assertRuntimeExists(runtimeScriptPath);
  assertCodexAppExists(appAsarPath);

  try {
    const currentExtractedRoot = path.join(tempRoot, "current");
    extractAsar(appAsarPath, currentExtractedRoot);
    const currentBundle = loadMainBundleSourceFromExtractedRoot(currentExtractedRoot);

    let sourceExtractedRoot = currentExtractedRoot;
    let sourceBundle = currentBundle;

    if (isPatchedMainBundleSource(currentBundle.source)) {
      if (!fs.existsSync(backupAsarPath)) {
        throw new Error(
          `Codex.app is already patched, but the original backup is missing: ${backupAsarPath}`,
        );
      }
      const backupExtractedRoot = path.join(tempRoot, "backup");
      extractAsar(backupAsarPath, backupExtractedRoot);
      sourceExtractedRoot = backupExtractedRoot;
      sourceBundle = loadMainBundleSourceFromExtractedRoot(backupExtractedRoot);
      if (isPatchedMainBundleSource(sourceBundle.source)) {
        throw new Error(`Original Codex backup is already patched: ${backupAsarPath}`);
      }
    } else {
      ensureDirectory(path.dirname(backupAsarPath));
      fs.copyFileSync(appAsarPath, backupAsarPath);
    }

    const patchedSource = patchMainBundleSource(sourceBundle.source, runtimeScriptPath);
    fs.writeFileSync(sourceBundle.mainBundlePath, patchedSource, "utf8");

    const patchedAsarPath = path.join(tempRoot, "patched.app.asar");
    packAsar(sourceExtractedRoot, patchedAsarPath);
    fs.copyFileSync(patchedAsarPath, appAsarPath);

    writePatchState({
      appPath,
      appAsarPath,
      backupAsarPath,
      runtimeDir,
      runtimeScriptPath,
      installedAt: new Date().toISOString(),
      patchMarker: PATCH_MARKER,
      targetId: TARGET_ID,
    });

    console.log(`Patched Codex.app -> ${appPath}`);
    console.log(`Installed menu item -> ${TARGET_LABEL}`);
    console.log(`Runtime script -> ${runtimeScriptPath}`);
  } finally {
    removePath(tempRoot);
  }
}

function uninstallPatch() {
  const appPath = getCodexAppPath();
  const appAsarPath = getAppAsarPath(appPath);
  const backupAsarPath = getBackupAsarPath();

  assertCodexAppExists(appAsarPath);
  if (!fs.existsSync(backupAsarPath)) {
    throw new Error(`Missing original Codex backup: ${backupAsarPath}`);
  }

  fs.copyFileSync(backupAsarPath, appAsarPath);
  removePatchState();

  console.log(`Restored Codex.app -> ${appPath}`);
}

function getPatchStatus() {
  const appPath = getCodexAppPath();
  const appAsarPath = getAppAsarPath(appPath);
  const runtimeDir = getRuntimeDir();
  const runtimeScriptPath = getRuntimeScriptPath();
  const backupAsarPath = getBackupAsarPath();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "use-browser-priview-codex-status-"));

  try {
    assertCodexAppExists(appAsarPath);
    const extractedRoot = path.join(tempRoot, "current");
    extractAsar(appAsarPath, extractedRoot);
    const { source } = loadMainBundleSourceFromExtractedRoot(extractedRoot);
    return {
      appPath,
      appAsarPath,
      runtimeDir,
      runtimeScriptPath,
      backupAsarPath,
      runtimeInstalled: fs.existsSync(runtimeScriptPath),
      backupExists: fs.existsSync(backupAsarPath),
      patched: isPatchedMainBundleSource(source),
    };
  } finally {
    removePath(tempRoot);
  }
}

function printUsage() {
  console.log("Usage: node patch-codex-open-with.js <install|uninstall|status>");
}

function main() {
  const command = process.argv[2] || "status";
  if (command === "install") {
    installPatch();
    return;
  }
  if (command === "uninstall") {
    uninstallPatch();
    return;
  }
  if (command === "status") {
    console.log(JSON.stringify(getPatchStatus(), null, 2));
    return;
  }
  printUsage();
  process.exitCode = 1;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  BACKUP_BASENAME,
  PATCH_MARKER,
  PATCH_STATE_BASENAME,
  TARGET_ID,
  TARGET_LABEL,
  getPatchStatus,
  installPatch,
  patchMainBundleSource,
  uninstallPatch,
};
