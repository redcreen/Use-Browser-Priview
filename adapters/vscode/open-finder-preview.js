#!/usr/bin/env node
"use strict";

const cp = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const { resolveSharedRuntimePath } = require("./runtime-paths");
const {
  canonicalPath,
  loadSharedSessions,
  resolveReusableSessionRecord,
  saveSharedSessions,
  storeSessionRecord,
} = require(resolveSharedRuntimePath("session-store.js"));
const {
  computeRuntimeCodeStamp,
  loadRuntimeModule,
} = require(resolveSharedRuntimePath("runtime-loader.js"));
const {
  findFreePort,
  findWorkspaceRoot,
  getAbsoluteTargetUrl,
  isPortReachable,
  waitForPortReady,
} = require(resolveSharedRuntimePath("browser-preview.js"));

const SESSION_DIR = path.join(os.homedir(), ".codex", "workspace-doc-browser", "finder");
const SESSION_FILE = path.join(SESSION_DIR, "sessions.json");
const FINDER_LOG_FILE = path.join(SESSION_DIR, "finder.log");

function appendFinderLog(message) {
  try {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    fs.appendFileSync(
      FINDER_LOG_FILE,
      `${new Date().toISOString().replace("T", " ").slice(0, 19)} ${String(message || "")}\n`,
      "utf8",
    );
  } catch {}
}

function loadPreviewBuilders() {
  const runtime = loadRuntimeModule({ fresh: true });
  if (!runtime || typeof runtime.buildRawFileServerScript !== "function") {
    throw new Error("Use Browser Priview runtime is missing buildRawFileServerScript().");
  }
  return {
    buildRawFileServerScript: runtime.buildRawFileServerScript,
  };
}

function normalizeSlashes(value) {
  return String(value || "").replace(/\\/g, "/");
}

function getFileKind(filePath) {
  const lowerPath = String(filePath || "").toLowerCase();
  if (/\.md$/i.test(lowerPath)) {
    return "markdown";
  }
  if (/\.(html?|xhtml)$/i.test(lowerPath)) {
    return "html";
  }
  if (/\.(png|apng|jpe?g|gif|webp|svg|bmp|ico|avif|tiff?)$/i.test(lowerPath)) {
    return "image";
  }
  if (/\.(mp4|webm|mov|m4v|ogg|ogv)$/i.test(lowerPath)) {
    return "video";
  }
  if (/\.(txt|json|js|ts|py|sh|yml|yaml|toml|ini|cfg|conf|xml|css|csv|env)$/i.test(lowerPath) || /(^|\/)(\.gitignore|dockerfile)$/i.test(lowerPath)) {
    return "text";
  }
  return "file";
}

function isPreviewableKind(kind) {
  return kind === "directory" || kind === "markdown" || kind === "html" || kind === "image" || kind === "video" || kind === "text";
}

function encodePathSegments(value) {
  return normalizeSlashes(String(value || ""))
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function getPreviewUrl(baseUrl, relativePath, kind = "") {
  const normalizedPath = normalizeSlashes(String(relativePath || "")).replace(/^\/+/, "");
  const trimmedPath = normalizedPath.replace(/\/+$/, "");
  const pathValue = kind === "directory"
    ? (trimmedPath ? `${encodePathSegments(trimmedPath)}/` : "")
    : encodePathSegments(trimmedPath);
  return new URL(pathValue, `${String(baseUrl || "").replace(/\/$/, "")}/`).toString();
}

function findDirectoryLandingMarkdownPath(workspaceRoot, relativeDir = "") {
  const normalizedRelativeDir = normalizeSlashes(String(relativeDir || "").replace(/^\/+|\/+$/g, ""));
  const absoluteDir = path.join(workspaceRoot, normalizedRelativeDir);
  const preferredNames = [
    "README.md",
    "README.zh-CN.md",
    "index.md",
  ];

  let entries = [];
  try {
    entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  } catch {
    return "";
  }

  const actualNamesByLower = new Map();
  for (const entry of entries) {
    if (entry && entry.name) {
      actualNamesByLower.set(entry.name.toLowerCase(), entry.name);
    }
  }

  for (const preferredName of preferredNames) {
    const actualName = actualNamesByLower.get(preferredName.toLowerCase());
    if (!actualName) {
      continue;
    }
    const absolutePath = path.join(absoluteDir, actualName);
    let stat = null;
    try {
      stat = fs.statSync(absolutePath);
    } catch {}
    if (!stat || !stat.isFile() || getFileKind(actualName) !== "markdown") {
      continue;
    }
    return normalizeSlashes(path.posix.join(normalizedRelativeDir, actualName));
  }

  return "";
}

function getTargetDescriptor(workspaceRoot, targetPath) {
  const absoluteTargetPath = canonicalPath(targetPath || workspaceRoot);
  const relativePath = normalizeSlashes(path.relative(workspaceRoot, absoluteTargetPath));
  let stat = null;
  try {
    stat = fs.statSync(absoluteTargetPath);
  } catch {}
  if (!relativePath || relativePath === ".") {
    const landingPath = stat && stat.isDirectory()
      ? findDirectoryLandingMarkdownPath(workspaceRoot, "")
      : "";
    if (landingPath) {
      return {
        relativePath: landingPath,
        kind: "markdown",
      };
    }
    return {
      relativePath: "",
      kind: stat && stat.isDirectory() ? "directory" : "markdown",
    };
  }
  let kind = getFileKind(relativePath);
  if (stat && stat.isDirectory()) {
    const landingPath = findDirectoryLandingMarkdownPath(workspaceRoot, relativePath);
    if (landingPath) {
      return {
        relativePath: landingPath,
        kind: "markdown",
      };
    }
    kind = "directory";
  }
  return {
    relativePath,
    kind,
  };
}

function getTargetUrl(baseUrl, workspaceRoot, targetPath) {
  return getAbsoluteTargetUrl(baseUrl, workspaceRoot, targetPath);
}

function ensureSessionDir() {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

function loadSessions() {
  const legacySessions = (() => {
    try {
      return JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"));
    } catch {
      return {};
    }
  })();
  try {
    return {
      ...legacySessions,
      ...loadSharedSessions(),
    };
  } catch {
    return legacySessions;
  }
}

function saveSessions(data) {
  saveSharedSessions(data);
  ensureSessionDir();
  fs.writeFileSync(SESSION_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function computeCodeStamp() {
  return computeRuntimeCodeStamp();
}

function safeKill(pid) {
  if (!pid) {
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {}
}

function notifyError(message) {
  const escaped = String(message || "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
  try {
    cp.spawnSync("/usr/bin/osascript", [
      "-e",
      `display alert "Use Browser Priview" message "${escaped}" as critical`,
    ], { stdio: "ignore" });
  } catch {}
}

function getDefaultBrowserBundleId() {
  try {
    const result = cp.spawnSync("defaults", [
      "read",
      "com.apple.LaunchServices/com.apple.launchservices.secure",
      "LSHandlers",
    ], {
      encoding: "utf8",
    });
    if (result.status !== 0 || !result.stdout) {
      return "";
    }
    const lines = result.stdout.split(/\r?\n/);
    let currentBlock = [];
    const findRole = (blockLines, marker) => {
      if (!blockLines.some((line) => line.includes(marker))) {
        return "";
      }
      const roleMatches = blockLines
        .map((line) => line.match(/^\s*LSHandlerRoleAll = "([^"]+)";\s*$/))
        .filter(Boolean)
        .map((match) => match[1])
        .filter((value) => value && value !== "-");
      return roleMatches.length ? roleMatches[roleMatches.length - 1] : "";
    };

    for (const line of lines) {
      currentBlock.push(line);
      if (line.trim() === "},") {
        const preferred = findRole(currentBlock, 'LSHandlerContentType = "com.apple.default-app.web-browser";');
        if (preferred) {
          return preferred;
        }
        const scheme = findRole(currentBlock, "LSHandlerURLScheme = http;");
        if (scheme) {
          return scheme;
        }
        currentBlock = [];
      }
    }
    return "";
  } catch {
    return "";
  }
}

function activateBrowser(bundleId) {
  if (!bundleId) {
    return;
  }
  try {
    cp.spawnSync("/usr/bin/osascript", [
      "-e",
      `tell application id "${bundleId}" to activate`,
    ], { stdio: "ignore" });
  } catch {}
}

function showInfoNotification(title, message) {
  const escapedTitle = String(title || "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
  const escapedMessage = String(message || "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
  try {
    cp.spawnSync("/usr/bin/osascript", [
      "-e",
      `display notification "${escapedMessage}" with title "${escapedTitle}"`,
    ], { stdio: "ignore" });
  } catch {}
}

function openUrlInBrowser(targetUrl) {
  const bundleId = getDefaultBrowserBundleId();
  appendFinderLog(`[finder-js] open-url ${targetUrl} browser=${bundleId || "default"}`);
  if (bundleId) {
    const opened = cp.spawnSync("open", ["-b", bundleId, targetUrl], { stdio: "ignore" });
    if (opened.status === 0) {
      activateBrowser(bundleId);
      appendFinderLog(`[finder-js] activated ${bundleId}`);
      return;
    }
    appendFinderLog(`[finder-js] open -b failed status=${opened.status}`);
  }
  const fallback = cp.spawnSync("open", [targetUrl], { stdio: "ignore" });
  if (fallback.status !== 0) {
    appendFinderLog(`[finder-js] fallback open failed status=${fallback.status}`);
    throw new Error(`Failed to open browser for ${targetUrl}`);
  }
  appendFinderLog("[finder-js] fallback open succeeded");
}

async function ensureSession(workspaceRoot, buildRawFileServerScript, codeStamp) {
  let sessions = loadSessions();
  const sharedLookup = await resolveReusableSessionRecord(sessions, {
    requestedRoot: workspaceRoot,
    codeStamp,
    isPortReachable,
    safeKill,
  });
  sessions = sharedLookup.sessions;
  if (sharedLookup.changed) {
    saveSessions(sessions);
  }
  if (sharedLookup.bestReusableSession) {
    sessions = storeSessionRecord(sessions, sharedLookup.bestReusableSession, codeStamp, sharedLookup.requestedRoot);
    saveSessions(sessions);
    return {
      ...sharedLookup.bestReusableSession,
      baseUrl: `http://127.0.0.1:${sharedLookup.bestReusableSession.port}/`,
    };
  }

  const port = await findFreePort(sharedLookup.preferredPort);
  const rawServerScript = buildRawFileServerScript(sharedLookup.requestedRoot, port);
  const child = cp.spawn(process.execPath, ["-e", rawServerScript], {
    cwd: sharedLookup.requestedRoot,
    env: process.env,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  await waitForPortReady(port);
  const nextSession = {
    workspaceRoot: sharedLookup.requestedRoot,
    port,
    pid: child.pid,
    browserOpened: false,
    codeStamp,
  };
  sessions = storeSessionRecord(sessions, nextSession, codeStamp);
  saveSessions(sessions);
  return {
    ...nextSession,
    baseUrl: `http://127.0.0.1:${port}/`,
  };
}

function resolveSelectionPath(selectedPath) {
  if (!selectedPath) {
    throw new Error("No folder was selected.");
  }
  const absolutePath = canonicalPath(String(selectedPath));
  const stat = fs.statSync(absolutePath);
  const searchStart = stat.isDirectory() ? absolutePath : path.dirname(absolutePath);
  const workspaceRoot = findWorkspaceRoot(searchStart);
  if (stat.isDirectory()) {
    return {
      workspaceRoot,
      targetPath: absolutePath,
    };
  }
  return {
    workspaceRoot,
    targetPath: absolutePath,
  };
}

async function main() {
  const selectedPath = process.argv[2];
  appendFinderLog(`[finder-js] selected=${selectedPath || ""}`);
  const { workspaceRoot, targetPath } = resolveSelectionPath(selectedPath);
  appendFinderLog(`[finder-js] workspaceRoot=${workspaceRoot} targetPath=${targetPath}`);
  const { buildRawFileServerScript } = loadPreviewBuilders();
  const codeStamp = computeCodeStamp();
  const session = await ensureSession(workspaceRoot, buildRawFileServerScript, codeStamp);
  const targetUrl = getTargetUrl(session.baseUrl, workspaceRoot, targetPath);
  appendFinderLog(`[finder-js] targetUrl=${targetUrl}`);
  if (process.env.WORKSPACE_DOC_BROWSER_NO_OPEN === "1") {
    process.stdout.write(`${targetUrl}\n`);
    return;
  }
  showInfoNotification("Use Browser Priview", `Opening preview for ${path.basename(targetPath) || path.basename(workspaceRoot)}`);
  openUrlInBrowser(targetUrl);
}

main().catch((error) => {
  const message = error && error.message ? error.message : String(error);
  appendFinderLog(`[finder-js] error ${message}`);
  console.error(message);
  notifyError(message);
  process.exitCode = 1;
});
