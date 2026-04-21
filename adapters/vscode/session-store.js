"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const SUPPORT_DIR_ENV = "USE_BROWSER_PRIVIEW_SUPPORT_DIR";
const DEFAULT_SUPPORT_DIR = process.platform === "darwin"
  ? path.join(os.homedir(), "Library", "Application Support", "Use Browser Priview")
  : path.join(os.homedir(), ".use-browser-priview");
const SHARED_SESSION_FILE = "shared-sessions.json";

function getSupportDir() {
  return path.resolve(process.env[SUPPORT_DIR_ENV] || DEFAULT_SUPPORT_DIR);
}

function getSharedSessionFile() {
  return path.join(getSupportDir(), SHARED_SESSION_FILE);
}

function ensureSharedSessionDir() {
  fs.mkdirSync(path.dirname(getSharedSessionFile()), { recursive: true });
}

function loadSharedSessions() {
  try {
    return JSON.parse(fs.readFileSync(getSharedSessionFile(), "utf8"));
  } catch {
    return {};
  }
}

function saveSharedSessions(data) {
  ensureSharedSessionDir();
  fs.writeFileSync(getSharedSessionFile(), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function canonicalPath(targetPath) {
  const absolutePath = path.resolve(String(targetPath || ""));
  try {
    return fs.realpathSync.native(absolutePath);
  } catch {
    return absolutePath;
  }
}

function getSessionRootRealPath(stored, sessionKey = "") {
  return canonicalPath(stored && (stored.workspaceRootRealPath || stored.workspaceRoot || sessionKey));
}

function getSessionCodeStamp(stored) {
  return stored && (stored.codeStamp || stored.serverCodeStamp) || "";
}

function isSameOrChildPath(parentPath, childPath) {
  const normalizedParent = canonicalPath(parentPath);
  const normalizedChild = canonicalPath(childPath);
  return normalizedChild === normalizedParent || normalizedChild.startsWith(`${normalizedParent}${path.sep}`);
}

async function resolveReusableSessionRecord(sessionMap, options) {
  const requestedRoot = canonicalPath(options && options.requestedRoot);
  const codeStamp = String(options && options.codeStamp || "");
  const isPortReachable = options && options.isPortReachable;
  const safeKill = options && options.safeKill;
  const nextSessionMap = { ...(sessionMap || {}) };
  let changed = false;
  let bestReusableSession = null;

  for (const [sessionKey, stored] of Object.entries(nextSessionMap)) {
    const storedRoot = getSessionRootRealPath(stored, sessionKey);
    if (getSessionCodeStamp(stored) !== codeStamp) {
      if (safeKill) {
        safeKill(stored && stored.pid);
      }
      delete nextSessionMap[sessionKey];
      changed = true;
      continue;
    }
    if (!stored || !stored.port || !(await isPortReachable(stored.port))) {
      if (safeKill) {
        safeKill(stored && stored.pid);
      }
      delete nextSessionMap[sessionKey];
      changed = true;
      continue;
    }
    if (
      isSameOrChildPath(storedRoot, requestedRoot) &&
      (!bestReusableSession || storedRoot.length > getSessionRootRealPath(bestReusableSession).length)
    ) {
      bestReusableSession = {
        ...stored,
        workspaceRoot: stored.workspaceRoot || sessionKey,
        workspaceRootRealPath: storedRoot,
      };
    }
  }

  return {
    changed,
    requestedRoot,
    sessions: nextSessionMap,
    bestReusableSession,
  };
}

function createSessionRecord(session, codeStamp) {
  return {
    workspaceRoot: session.workspaceRoot,
    workspaceRootRealPath: canonicalPath(session.workspaceRoot),
    port: session.port,
    pid: session.process && session.process.pid ? session.process.pid : (session.pid || null),
    browserOpened: Boolean(session.browserOpened),
    codeStamp,
  };
}

function storeSessionRecord(sessionMap, session, codeStamp, aliasRoot) {
  const nextSessionMap = { ...(sessionMap || {}) };
  const record = createSessionRecord(session, codeStamp);
  nextSessionMap[record.workspaceRootRealPath] = record;
  if (aliasRoot) {
    nextSessionMap[canonicalPath(aliasRoot)] = record;
  }
  return nextSessionMap;
}

function deleteSessionRecord(sessionMap, workspaceRoot) {
  const nextSessionMap = { ...(sessionMap || {}) };
  const requestedRoot = canonicalPath(workspaceRoot);
  let changed = false;
  for (const [sessionKey, stored] of Object.entries(nextSessionMap)) {
    if (getSessionRootRealPath(stored, sessionKey) === requestedRoot || canonicalPath(sessionKey) === requestedRoot) {
      delete nextSessionMap[sessionKey];
      changed = true;
    }
  }
  return {
    changed,
    sessions: nextSessionMap,
  };
}

module.exports = {
  canonicalPath,
  createSessionRecord,
  deleteSessionRecord,
  getSessionCodeStamp,
  getSessionRootRealPath,
  getSharedSessionFile,
  getSupportDir,
  isSameOrChildPath,
  loadSharedSessions,
  resolveReusableSessionRecord,
  saveSharedSessions,
  storeSessionRecord,
};
