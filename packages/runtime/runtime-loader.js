"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const LOADER_PATH = __filename;
const BROWSER_PREVIEW_PATH = path.join(__dirname, "browser-preview.js");
const SESSION_STORE_PATH = path.join(__dirname, "session-store.js");
const RUNTIME_WATCH_PATHS = [
  LOADER_PATH,
  BROWSER_PREVIEW_PATH,
  SESSION_STORE_PATH,
];

function getRuntimeWatchPaths() {
  return RUNTIME_WATCH_PATHS.slice();
}

function computeRuntimeCodeStamp() {
  const hash = crypto.createHash("sha1");
  for (const watchPath of RUNTIME_WATCH_PATHS) {
    hash.update(watchPath);
    try {
      hash.update(fs.readFileSync(watchPath));
    } catch {
      hash.update("missing");
    }
  }
  return hash.digest("hex");
}

function clearRuntimeModuleCache() {
  for (const modulePath of [BROWSER_PREVIEW_PATH, SESSION_STORE_PATH, LOADER_PATH]) {
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch {}
  }
}

function loadRuntimeModule(options = {}) {
  if (options.fresh) {
    clearRuntimeModuleCache();
  }
  return require(BROWSER_PREVIEW_PATH);
}

module.exports = {
  computeRuntimeCodeStamp,
  getRuntimeWatchPaths,
  loadRuntimeModule,
};
