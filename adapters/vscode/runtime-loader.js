"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const LOADER_PATH = __filename;
const RUNTIME_ENTRY_PATH = path.join(__dirname, "extension-runtime.js");
const SESSION_STORE_PATH = path.join(__dirname, "session-store.js");
const ADAPTER_PACKAGE_PATH = path.join(__dirname, "package.json");
const RUNTIME_WATCH_PATHS = [
  LOADER_PATH,
  RUNTIME_ENTRY_PATH,
  SESSION_STORE_PATH,
  ADAPTER_PACKAGE_PATH,
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
  for (const modulePath of [RUNTIME_ENTRY_PATH, SESSION_STORE_PATH]) {
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch {}
  }
}

function loadRuntimeModule(options = {}) {
  if (options.fresh) {
    clearRuntimeModuleCache();
  }
  return require(RUNTIME_ENTRY_PATH);
}

module.exports = {
  computeRuntimeCodeStamp,
  getRuntimeWatchPaths,
  loadRuntimeModule,
};
