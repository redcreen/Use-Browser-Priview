"use strict";

const cp = require("child_process");
const fs = require("fs");
const path = require("path");
const { buildRawFileServerScript } = require("./browser-preview.js");
const { canonicalPath, getSupportDir } = require("./session-store.js");

const RESTART_DELAY_MS = 250;
const SHUTDOWN_GRACE_MS = 1500;
const SUPERVISOR_LOG_FILE = path.join(getSupportDir(), "preview-supervisor.log");

function appendSupervisorLog(payload) {
  try {
    fs.mkdirSync(path.dirname(SUPERVISOR_LOG_FILE), { recursive: true });
    fs.appendFileSync(
      SUPERVISOR_LOG_FILE,
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        ...payload,
      })}\n`,
      "utf8",
    );
  } catch {}
}

function buildSupervisorArgs(workspaceRoot, port) {
  return [
    __filename,
    "--workspace-root",
    canonicalPath(workspaceRoot),
    "--port",
    String(port),
  ];
}

function spawnPreviewSupervisor(workspaceRoot, port, options = {}) {
  const detached = options.detached !== false;
  const child = cp.spawn(process.execPath, buildSupervisorArgs(workspaceRoot, port), {
    cwd: canonicalPath(workspaceRoot),
    env: options.env || process.env,
    detached,
    stdio: Object.prototype.hasOwnProperty.call(options, "stdio")
      ? options.stdio
      : (detached ? "ignore" : ["ignore", "pipe", "pipe"]),
  });
  if (detached && typeof child.unref === "function") {
    child.unref();
  }
  return child;
}

function runPreviewSupervisor(workspaceRoot, port) {
  const normalizedRoot = canonicalPath(workspaceRoot);
  const normalizedPort = Number(port);
  let child = null;
  let shuttingDown = false;
  let restartTimer = null;
  let shutdownTimer = null;

  function clearRestartTimer() {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  }

  function clearShutdownTimer() {
    if (shutdownTimer) {
      clearTimeout(shutdownTimer);
      shutdownTimer = null;
    }
  }

  function stopChild(signal = "SIGTERM") {
    if (!child || child.exitCode !== null || child.signalCode !== null) {
      return;
    }
    try {
      child.kill(signal);
    } catch {}
  }

  function finishShutdown(code = 0) {
    clearRestartTimer();
    clearShutdownTimer();
    process.exit(code);
  }

  function scheduleRestart() {
    clearRestartTimer();
    restartTimer = setTimeout(() => {
      restartTimer = null;
      spawnManagedChild();
    }, RESTART_DELAY_MS);
  }

  function handleSupervisorShutdown(signal) {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    appendSupervisorLog({
      source: "supervisor",
      event: "shutdown",
      signal,
      workspaceRoot: normalizedRoot,
      port: normalizedPort,
      supervisorPid: process.pid,
      childPid: child && child.pid || null,
    });
    if (!child || child.exitCode !== null || child.signalCode !== null) {
      finishShutdown(0);
      return;
    }
    stopChild("SIGTERM");
    shutdownTimer = setTimeout(() => {
      stopChild("SIGKILL");
      finishShutdown(0);
    }, SHUTDOWN_GRACE_MS);
  }

  function spawnManagedChild() {
    if (shuttingDown) {
      return;
    }
    const rawServerScript = buildRawFileServerScript(normalizedRoot, normalizedPort);
    child = cp.spawn(process.execPath, ["-e", rawServerScript], {
      cwd: normalizedRoot,
      env: process.env,
      stdio: "ignore",
    });
    appendSupervisorLog({
      source: "supervisor",
      event: "child-start",
      workspaceRoot: normalizedRoot,
      port: normalizedPort,
      supervisorPid: process.pid,
      childPid: child.pid,
    });
    child.once("error", (error) => {
      appendSupervisorLog({
        source: "supervisor",
        event: "child-error",
        workspaceRoot: normalizedRoot,
        port: normalizedPort,
        supervisorPid: process.pid,
        childPid: child && child.pid || null,
        message: error && error.message ? error.message : String(error),
      });
    });
    child.once("exit", (code, signal) => {
      const exitedPid = child && child.pid || null;
      child = null;
      appendSupervisorLog({
        source: "supervisor",
        event: "child-exit",
        workspaceRoot: normalizedRoot,
        port: normalizedPort,
        supervisorPid: process.pid,
        childPid: exitedPid,
        code,
        signal,
        restarting: !shuttingDown,
      });
      if (shuttingDown) {
        finishShutdown(0);
        return;
      }
      scheduleRestart();
    });
  }

  process.on("SIGTERM", () => handleSupervisorShutdown("SIGTERM"));
  process.on("SIGINT", () => handleSupervisorShutdown("SIGINT"));
  process.on("SIGHUP", () => handleSupervisorShutdown("SIGHUP"));

  appendSupervisorLog({
    source: "supervisor",
    event: "start",
    workspaceRoot: normalizedRoot,
    port: normalizedPort,
    supervisorPid: process.pid,
  });
  spawnManagedChild();
}

function parseCliArgs(argv) {
  const args = Array.isArray(argv) ? argv.slice() : [];
  let workspaceRoot = "";
  let port = 0;
  for (let index = 0; index < args.length; index += 1) {
    const value = String(args[index] || "");
    if (value === "--workspace-root") {
      workspaceRoot = args[index + 1] || "";
      index += 1;
      continue;
    }
    if (value === "--port") {
      port = Number(args[index + 1] || 0);
      index += 1;
    }
  }
  if (!workspaceRoot || !port) {
    throw new Error("preview-supervisor requires --workspace-root and --port.");
  }
  return {
    workspaceRoot,
    port,
  };
}

if (require.main === module) {
  const { workspaceRoot, port } = parseCliArgs(process.argv.slice(2));
  runPreviewSupervisor(workspaceRoot, port);
}

module.exports = {
  buildSupervisorArgs,
  runPreviewSupervisor,
  spawnPreviewSupervisor,
  SUPERVISOR_LOG_FILE,
};
