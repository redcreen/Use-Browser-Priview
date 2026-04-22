"use strict";

const fs = require("fs");
const vscode = require("vscode");
const {
  computeRuntimeCodeStamp,
  getRuntimeWatchPaths,
  loadRuntimeModule,
} = require("./runtime-loader");

const COMMAND_ID = "redcreen.useBrowserPriview.open";
const OUTPUT_NAME = "Use Browser Priview";
const HOT_RELOAD_WATCH_INTERVAL_MS = 800;

class HotReloadingWorkspaceDocBrowser {
  constructor(context) {
    this.context = context;
    this.output = vscode.window.createOutputChannel(OUTPUT_NAME);
    this.runtimeController = null;
    this.runtimeStamp = "";
    this.runtimeDirty = false;
  }

  activate() {
    this.context.subscriptions.push(
      this,
      this.output,
      vscode.commands.registerCommand(COMMAND_ID, (targetUri) => this.open(targetUri)),
      this.watchRuntimeFiles(),
    );
  }

  watchRuntimeFiles() {
    const listeners = [];
    const onWatchTick = () => {
      const nextStamp = computeRuntimeCodeStamp();
      if ((this.runtimeStamp && nextStamp === this.runtimeStamp) || this.runtimeDirty) {
        return;
      }
      this.runtimeDirty = true;
      this.output.appendLine("[hot-update] Preview runtime changed on disk. The next preview action will use the latest code without restarting Extension Host.");
    };

    for (const watchPath of getRuntimeWatchPaths()) {
      const listener = () => onWatchTick();
      try {
        fs.watchFile(watchPath, { interval: HOT_RELOAD_WATCH_INTERVAL_MS, persistent: false }, listener);
        listeners.push({ watchPath, listener });
      } catch {}
    }

    return {
      dispose() {
        for (const { watchPath, listener } of listeners) {
          try {
            fs.unwatchFile(watchPath, listener);
          } catch {}
        }
      },
    };
  }

  createRuntimeController(runtimeStamp) {
    const runtime = loadRuntimeModule({ fresh: true });
    if (!runtime || typeof runtime.createWorkspaceDocBrowser !== "function") {
      throw new Error("Use Browser Priview runtime is missing createWorkspaceDocBrowser().");
    }
    return runtime.createWorkspaceDocBrowser(this.context, {
      output: this.output,
      runtimeCodeStamp: runtimeStamp,
    });
  }

  async ensureRuntimeController() {
    const nextStamp = computeRuntimeCodeStamp();
    if (this.runtimeController && !this.runtimeDirty && nextStamp === this.runtimeStamp) {
      return this.runtimeController;
    }

    const previousController = this.runtimeController;
    this.runtimeController = this.createRuntimeController(nextStamp);
    this.runtimeStamp = nextStamp;
    this.runtimeDirty = false;

    if (previousController && typeof previousController.dispose === "function") {
      await previousController.dispose({ keepProcess: true });
      this.output.appendLine(`[hot-update] Loaded preview runtime ${nextStamp.slice(0, 7)} without restarting Extension Host.`);
    } else {
      this.output.appendLine(`[runtime] Loaded preview runtime ${nextStamp.slice(0, 7)}.`);
    }

    return this.runtimeController;
  }

  async open(targetUri) {
    const controller = await this.ensureRuntimeController();
    await controller.open(targetUri);
  }

  async dispose() {
    const controller = this.runtimeController;
    this.runtimeController = null;
    if (controller && typeof controller.dispose === "function") {
      await controller.dispose({ keepProcess: true });
    }
  }
}

function activate(context) {
  const browser = new HotReloadingWorkspaceDocBrowser(context);
  browser.activate();
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
