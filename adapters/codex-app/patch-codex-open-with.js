#!/usr/bin/env node
"use strict";

const cp = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PATCH_MARKER = "use-browser-priview-codex-open-target-v1";
const TARGET_ID = "useBrowserPriview";
const TARGET_LABEL = "Use Browser Priview";
const TARGET_VAR_NAME = "useBrowserPriviewCodexOpenTarget";
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

function getBackupAppPath(appPath = getCodexAppPath()) {
  const appDir = path.dirname(appPath);
  const appBasename = path.basename(appPath, ".app");
  return path.join(appDir, `${appBasename}.use-browser-priview-backup.app`);
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

function pathExists(targetPath) {
  try {
    fs.accessSync(targetPath);
    return true;
  } catch {
    return false;
  }
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

function runCodesign(args, options = {}) {
  return execFile("codesign", args, options);
}

function runSpctl(args, options = {}) {
  return execFile("spctl", args, options);
}

function cloneAppBundle(sourceAppPath, targetAppPath) {
  removePath(targetAppPath);
  ensureDirectory(path.dirname(targetAppPath));
  execFile("ditto", [sourceAppPath, targetAppPath]);
}

function renamePath(sourcePath, targetPath) {
  fs.renameSync(sourcePath, targetPath);
}

function signAppBundle(appPath) {
  if (process.env.USE_BROWSER_PRIVIEW_SKIP_CODE_SIGN === "1") {
    return;
  }
  runCodesign(["--force", "--deep", "--sign", "-", appPath]);
}

function verifyAppBundle(appPath) {
  if (process.env.USE_BROWSER_PRIVIEW_SKIP_CODE_SIGN === "1") {
    return;
  }
  runCodesign(["--verify", "--deep", "--strict", appPath]);
}

function alignInt(value, alignment) {
  return value + ((alignment - (value % alignment)) % alignment);
}

function createPickleReader(buffer) {
  let headerSize = buffer.length - buffer.readUInt32LE(0);
  if (headerSize > buffer.length || headerSize !== alignInt(headerSize, 4)) {
    headerSize = 0;
  }
  let readIndex = 0;
  const endIndex = buffer.readUInt32LE(0);

  function getReadPayloadOffsetAndAdvance(length) {
    if (length > endIndex - readIndex) {
      readIndex = endIndex;
      throw new Error(`Failed to read pickle data with length ${length}`);
    }
    const readPayloadOffset = headerSize + readIndex;
    const alignedLength = alignInt(length, 4);
    if (endIndex - readIndex < alignedLength) {
      readIndex = endIndex;
    } else {
      readIndex += alignedLength;
    }
    return readPayloadOffset;
  }

  return {
    readInt() {
      const offset = getReadPayloadOffsetAndAdvance(4);
      return buffer.readInt32LE(offset);
    },
    readUInt32() {
      const offset = getReadPayloadOffsetAndAdvance(4);
      return buffer.readUInt32LE(offset);
    },
    readString() {
      const length = this.readInt();
      const offset = getReadPayloadOffsetAndAdvance(length);
      return buffer.slice(offset, offset + length).toString();
    },
  };
}

function readAsarHeaderString(asarPath) {
  const fd = fs.openSync(asarPath, "r");
  try {
    const sizeBuffer = Buffer.alloc(8);
    if (fs.readSync(fd, sizeBuffer, 0, 8, null) !== 8) {
      throw new Error(`Unable to read ASAR header size from ${asarPath}`);
    }
    const size = createPickleReader(sizeBuffer).readUInt32();
    const headerBuffer = Buffer.alloc(size);
    if (fs.readSync(fd, headerBuffer, 0, size, null) !== size) {
      throw new Error(`Unable to read ASAR header from ${asarPath}`);
    }
    return createPickleReader(headerBuffer).readString();
  } finally {
    fs.closeSync(fd);
  }
}

function updateAsarIntegrity(appPath, asarPath) {
  const infoPlistPath = path.join(appPath, "Contents", "Info.plist");
  const rawIntegrityJson = execFile("plutil", ["-extract", "ElectronAsarIntegrity", "json", "-o", "-", infoPlistPath]);
  const integrity = JSON.parse(rawIntegrityJson);
  const appAsarIntegrity = integrity["Resources/app.asar"];
  if (!appAsarIntegrity || typeof appAsarIntegrity !== "object") {
    throw new Error(`Missing ElectronAsarIntegrity entry for Resources/app.asar in ${infoPlistPath}`);
  }
  appAsarIntegrity.hash = crypto.createHash("sha256").update(readAsarHeaderString(asarPath)).digest("hex");
  execFile("plutil", [
    "-replace",
    "ElectronAsarIntegrity",
    "-json",
    JSON.stringify(integrity),
    infoPlistPath,
  ]);
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

  const registryPattern = /var\s+([A-Za-z_$][\w$]*)=\[([\s\S]*?)\],([A-Za-z_$][\w$]*)=([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\(`open-in-targets`\);function\s+([A-Za-z_$][\w$]*)\(e\)\{return\s+\1\.flatMap\(t=>\{let n=t\.platforms\[e\];return n\?\[\{id:t\.id,\.\.\.n\}\]:\[\]\}\)\}/;
  const registryMatch = source.match(registryPattern);
  if (!registryMatch) {
    throw new Error("Unable to locate Codex open-target registry in the main bundle.");
  }

  const targetsVarName = registryMatch[1];
  const runtimeLiteral = JSON.stringify(runtimeScriptPath);
  const patchPrelude = [
    `var useBrowserPriviewCodexPatchMarker=${JSON.stringify(PATCH_MARKER)}`,
    `${TARGET_VAR_NAME}={id:\`${TARGET_ID}\`,platforms:{darwin:{label:\`${TARGET_LABEL}\`,icon:null,kind:\`editor\`,detect:()=>require(\`fs\`).existsSync(${runtimeLiteral})?\`/bin/bash\`:null,open:async({path:t})=>{await new Promise((resolve,reject)=>require(\`child_process\`).execFile(\`/bin/bash\`,[${runtimeLiteral},t],error=>error?reject(error):resolve()))}}}}`,
    `${targetsVarName}=[`,
  ].join(",");

  return source.replace(registryPattern, (_match, _targetsVar, existingTargets, loggerVarName, loggerReceiver, loggerFactoryName, flattenFnName) => {
    return `${patchPrelude}${existingTargets},${TARGET_VAR_NAME}],${loggerVarName}=${loggerReceiver}.${loggerFactoryName}(\`open-in-targets\`);function ${flattenFnName}(e){return ${targetsVarName}.flatMap(t=>{let n=t.platforms[e];return n?[{id:t.id,...n}]:[]})}`;
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

function readPatchState() {
  const statePath = getPatchStatePath();
  if (!pathExists(statePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(statePath, "utf8"));
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

function stagePatchedAppBundle({ sourceAppPath, stagedAppPath, runtimeScriptPath }) {
  cloneAppBundle(sourceAppPath, stagedAppPath);

  const stagedAsarPath = getAppAsarPath(stagedAppPath);
  const extractedRoot = path.join(path.dirname(stagedAppPath), "staged-extracted");
  extractAsar(stagedAsarPath, extractedRoot);
  const stagedBundle = loadMainBundleSourceFromExtractedRoot(extractedRoot);
  const patchedSource = patchMainBundleSource(stagedBundle.source, runtimeScriptPath);
  fs.writeFileSync(stagedBundle.mainBundlePath, patchedSource, "utf8");
  removePath(stagedAsarPath);
  packAsar(extractedRoot, stagedAsarPath);
  removePath(extractedRoot);
  updateAsarIntegrity(stagedAppPath, stagedAsarPath);
  signAppBundle(stagedAppPath);
  verifyAppBundle(stagedAppPath);
}

function installPatch() {
  const appPath = getCodexAppPath();
  const appAsarPath = getAppAsarPath(appPath);
  const backupAppPath = getBackupAppPath(appPath);
  const runtimeDir = getRuntimeDir();
  const runtimeScriptPath = getRuntimeScriptPath();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "use-browser-priview-codex-patch-"));

  ensureDirectory(runtimeDir);
  assertRuntimeExists(runtimeScriptPath);
  assertCodexAppExists(appAsarPath);

  try {
    const currentExtractedRoot = path.join(tempRoot, "current");
    extractAsar(appAsarPath, currentExtractedRoot);
    const currentBundle = loadMainBundleSourceFromExtractedRoot(currentExtractedRoot);
    const currentPatched = isPatchedMainBundleSource(currentBundle.source);
    const cleanSourceAppPath = currentPatched ? backupAppPath : appPath;
    const stagedAppPath = path.join(tempRoot, "Codex.app");
    const displacedPatchedAppPath = path.join(tempRoot, "Codex.previous-patched.app");

    if (currentPatched && !pathExists(backupAppPath)) {
      throw new Error(`Codex.app is patched, but the clean backup bundle is missing: ${backupAppPath}`);
    }

    stagePatchedAppBundle({
      sourceAppPath: cleanSourceAppPath,
      stagedAppPath,
      runtimeScriptPath,
    });

    if (!currentPatched) {
      removePath(backupAppPath);
      renamePath(appPath, backupAppPath);
    } else {
      renamePath(appPath, displacedPatchedAppPath);
    }

    try {
      renamePath(stagedAppPath, appPath);
    } catch (error) {
      if (pathExists(appPath)) {
        removePath(appPath);
      }
      if (!currentPatched && pathExists(backupAppPath)) {
        renamePath(backupAppPath, appPath);
      } else if (pathExists(displacedPatchedAppPath)) {
        renamePath(displacedPatchedAppPath, appPath);
      }
      throw error;
    }

    removePath(displacedPatchedAppPath);

    writePatchState({
      appPath,
      appAsarPath: getAppAsarPath(appPath),
      backupAppPath,
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
  const patchState = readPatchState();
  const backupAppPath = patchState?.backupAppPath || getBackupAppPath(appPath);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "use-browser-priview-codex-unpatch-"));

  if (!pathExists(backupAppPath)) {
    throw new Error(`Missing clean Codex backup bundle: ${backupAppPath}`);
  }

  try {
    const displacedPatchedAppPath = path.join(tempRoot, "Codex.patched.app");
    renamePath(appPath, displacedPatchedAppPath);
    try {
      renamePath(backupAppPath, appPath);
    } catch (error) {
      renamePath(displacedPatchedAppPath, appPath);
      throw error;
    }
    removePath(displacedPatchedAppPath);
    removePatchState();
    console.log(`Restored Codex.app -> ${appPath}`);
  } finally {
    removePath(tempRoot);
  }
}

function getPatchStatus() {
  const appPath = getCodexAppPath();
  const appAsarPath = getAppAsarPath(appPath);
  const runtimeDir = getRuntimeDir();
  const runtimeScriptPath = getRuntimeScriptPath();
  const patchState = readPatchState();
  const backupAppPath = patchState?.backupAppPath || getBackupAppPath(appPath);
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
      backupAppPath,
      runtimeInstalled: fs.existsSync(runtimeScriptPath),
      backupExists: pathExists(backupAppPath),
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
  PATCH_MARKER,
  PATCH_STATE_BASENAME,
  TARGET_ID,
  TARGET_LABEL,
  getBackupAppPath,
  getPatchStatus,
  installPatch,
  patchMainBundleSource,
  readPatchState,
  stagePatchedAppBundle,
  uninstallPatch,
};
