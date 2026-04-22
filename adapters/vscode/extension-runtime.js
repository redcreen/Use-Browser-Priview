"use strict";

const cp = require("child_process");
const fs = require("fs");
const path = require("path");
const { resolveSharedRuntimePath } = require("./runtime-paths");
const {
  deleteSessionRecord,
  loadSharedSessions,
  resolveReusableSessionRecord,
  saveSharedSessions,
  storeSessionRecord,
  isSameOrChildPath,
} = require(resolveSharedRuntimePath("session-store.js"));
const {
  OUTPUT_NAME,
  buildRawFileServerScript,
  computeServerCodeStamp,
  encodePathSegments,
  findDirectoryLandingMarkdownPath,
  findFirstMarkdownPath,
  findFreePort,
  getFileKind,
  getPreviewUrl,
  isMarkdownFile,
  isPortReachable,
  isPreviewableKind,
  normalizeSlashes,
  waitForPortReady,
} = require(resolveSharedRuntimePath("browser-preview.js"));

const DOCS_STARTUP_LOG_REVEAL_MS = 2500;
const DOCS_STARTUP_READY_ATTEMPTS = 120;
const DOCS_STARTUP_READY_DELAY_MS = 100;
const SESSION_STATE_PREFIX = "workspaceDocBrowser.session:";
let vscodeModule = null;

function getVscode() {
  if (!vscodeModule) {
    vscodeModule = require("vscode");
  }
  return vscodeModule;
}

class WorkspaceDocBrowser {
  constructor(context, options = {}) {
    this.context = context;
    this.output = options.output || getVscode().window.createOutputChannel(OUTPUT_NAME);
    this.session = null;
    this.pendingOpen = null;
    this.serverCodeStamp = options.runtimeCodeStamp || computeServerCodeStamp();
  }

  getSessionStateKey(workspaceRoot) {
    return `${SESSION_STATE_PREFIX}${workspaceRoot}`;
  }

  async persistSession(session = this.session) {
    if (!session || !session.workspaceRoot || !session.port) {
      return;
    }
    await this.context.globalState.update(this.getSessionStateKey(session.workspaceRoot), {
      workspaceRoot: session.workspaceRoot,
      port: session.port,
      pid: session.process && session.process.pid ? session.process.pid : (session.pid || null),
      browserOpened: Boolean(session.browserOpened),
      serverCodeStamp: this.serverCodeStamp,
    });
    saveSharedSessions(storeSessionRecord(loadSharedSessions(), session, this.serverCodeStamp));
  }

  async clearPersistedSession(workspaceRoot) {
    if (!workspaceRoot) {
      return;
    }
    await this.context.globalState.update(this.getSessionStateKey(workspaceRoot), undefined);
    const result = deleteSessionRecord(loadSharedSessions(), workspaceRoot);
    if (result.changed) {
      saveSharedSessions(result.sessions);
    }
  }

  async restorePersistedSession(workspaceRoot) {
    if (!workspaceRoot) {
      return { session: null, preferredPort: null };
    }
    const sharedLookup = await resolveReusableSessionRecord(loadSharedSessions(), {
      requestedRoot: workspaceRoot,
      codeStamp: this.serverCodeStamp,
      isPortReachable,
      safeKill(pid) {
        if (!pid) {
          return;
        }
        try {
          process.kill(pid, "SIGTERM");
        } catch {}
      },
    });
    if (sharedLookup.changed) {
      saveSharedSessions(sharedLookup.sessions);
    }
    if (sharedLookup.bestReusableSession) {
      const session = {
        workspaceRoot: sharedLookup.bestReusableSession.workspaceRoot,
        baseUrl: `http://127.0.0.1:${sharedLookup.bestReusableSession.port}/`,
        port: sharedLookup.bestReusableSession.port,
        pid: sharedLookup.bestReusableSession.pid || null,
        browserOpened: Boolean(sharedLookup.bestReusableSession.browserOpened),
        targetUri: null,
        process: null,
        restored: true,
      };
      this.session = session;
      this.output.appendLine(`[restore] ${workspaceRoot} -> ${session.baseUrl}`);
      await this.persistSession(session);
      return {
        session,
        preferredPort: sharedLookup.preferredPort,
      };
    }
    const stored = this.context.globalState.get(this.getSessionStateKey(workspaceRoot));
    if (!stored || !stored.port) {
      return {
        session: null,
        preferredPort: sharedLookup.preferredPort,
      };
    }
    if (stored.serverCodeStamp !== this.serverCodeStamp) {
      if (stored.pid) {
        try {
          process.kill(stored.pid, "SIGTERM");
        } catch {}
      }
      await this.clearPersistedSession(workspaceRoot);
      return {
        session: null,
        preferredPort: sharedLookup.preferredPort || stored.port || null,
      };
    }
    const reachable = await isPortReachable(stored.port);
    if (!reachable) {
      await this.clearPersistedSession(workspaceRoot);
      return {
        session: null,
        preferredPort: sharedLookup.preferredPort || stored.port || null,
      };
    }
    const session = {
      workspaceRoot,
      baseUrl: `http://127.0.0.1:${stored.port}/`,
      port: stored.port,
      pid: stored.pid || null,
      browserOpened: Boolean(stored.browserOpened),
      targetUri: null,
      process: null,
      restored: true,
    };
    this.session = session;
    this.output.appendLine(`[restore] ${workspaceRoot} -> ${session.baseUrl}`);
    await this.persistSession(session);
    return {
      session,
      preferredPort: sharedLookup.preferredPort || stored.port || null,
    };
  }

  normalizeTargetUri(targetUri) {
    if (targetUri && targetUri.scheme === "file") {
      return targetUri;
    }
    const editor = getVscode().window.activeTextEditor;
    if (editor && editor.document && editor.document.uri.scheme === "file") {
      return editor.document.uri;
    }
    return null;
  }

  getWorkspaceRoot(targetUri) {
    const vscode = getVscode();
    const normalizedTargetUri = this.normalizeTargetUri(targetUri);
    if (normalizedTargetUri) {
      const folder = vscode.workspace.getWorkspaceFolder(normalizedTargetUri);
      if (folder) {
        return folder.uri.fsPath;
      }
      try {
        const stat = fs.statSync(normalizedTargetUri.fsPath);
        if (stat.isDirectory()) {
          return normalizedTargetUri.fsPath;
        }
        if (stat.isFile()) {
          return path.dirname(normalizedTargetUri.fsPath);
        }
      } catch {}
    }
    const folder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
    return folder ? folder.uri.fsPath : null;
  }

  pickDefaultMarkdownPath(workspaceRoot) {
    const preferred = [
      "README.md",
      "README.zh-CN.md",
      "docs/README.md",
      "docs/README.zh-CN.md",
      "index.md",
    ];
    for (const relativePath of preferred) {
      const absolutePath = path.join(workspaceRoot, relativePath);
      if (isMarkdownFile(path.basename(relativePath), absolutePath)) {
        return normalizeSlashes(relativePath);
      }
    }
    return findFirstMarkdownPath(workspaceRoot, "");
  }

  getTargetDescriptor(workspaceRoot, targetUri) {
    const normalizedTargetUri = this.normalizeTargetUri(targetUri);
    if (normalizedTargetUri) {
      const relativePath = normalizeSlashes(path.relative(workspaceRoot, normalizedTargetUri.fsPath));
      if (relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath)) {
        let kind = getFileKind(relativePath);
        try {
          const stat = fs.statSync(normalizedTargetUri.fsPath);
          if (stat.isDirectory()) {
            const landingPath = findDirectoryLandingMarkdownPath(workspaceRoot, relativePath);
            if (landingPath) {
              return {
                relativePath: landingPath,
                kind: "markdown",
              };
            }
            kind = "directory";
          }
        } catch {}
        return {
          relativePath,
          kind,
        };
      }
    }
    const fallbackPath = this.pickDefaultMarkdownPath(workspaceRoot);
    if (!fallbackPath) {
      return null;
    }
    return {
      relativePath: fallbackPath,
      kind: "markdown",
    };
  }

  getPreviewUrl(baseUrl, relativePath, kind = "") {
    return getPreviewUrl(baseUrl, relativePath, kind);
  }

  getTargetUrl(baseUrl, workspaceRoot, targetUri) {
    const descriptor = this.getTargetDescriptor(workspaceRoot, targetUri);
    if (!descriptor) {
      return `${String(baseUrl || "").replace(/\/$/, "")}/`;
    }
    if (isPreviewableKind(descriptor.kind)) {
      return this.getPreviewUrl(baseUrl, descriptor.relativePath, descriptor.kind);
    }
    return new URL(encodePathSegments(descriptor.relativePath), `${String(baseUrl || "").replace(/\/$/, "")}/`).toString();
  }

  setPendingOpen(workspaceRoot, detail, kind) {
    this.clearPendingOpen();
    const pending = {
      workspaceRoot,
      detail,
      kind,
      revealTimer: setTimeout(() => {
        if (this.pendingOpen !== pending) {
          return;
        }
        this.output.appendLine(`[pending] ${detail}`);
        this.output.show(false);
      }, DOCS_STARTUP_LOG_REVEAL_MS),
    };
    this.pendingOpen = pending;
  }

  clearPendingOpen() {
    if (!this.pendingOpen) {
      return;
    }
    if (this.pendingOpen.revealTimer) {
      clearTimeout(this.pendingOpen.revealTimer);
    }
    this.pendingOpen = null;
  }

  announceManualAction(workspaceRoot, kind) {
    const workspaceName = path.basename(workspaceRoot);
    const message = kind === "start"
      ? `${OUTPUT_NAME}: starting preview for ${workspaceName}...`
      : `${OUTPUT_NAME}: opening preview for ${workspaceName}...`;
    getVscode().window.showInformationMessage(message);
  }

  async openBrowserUrl(url, workspaceRoot, contextLabel, session) {
    const vscode = getVscode();
    this.output.appendLine(`[browser-open] ${contextLabel}: ${url}`);
    const opened = await vscode.env.openExternal(vscode.Uri.parse(url));
    if (session && this.session === session) {
      session.browserOpened = Boolean(opened);
      void this.persistSession(session);
    }
    if (!opened) {
      this.output.appendLine(`[browser-open-error] ${contextLabel}: VS Code could not hand the URL to the system browser.`);
      this.output.show(true);
      getVscode().window.showWarningMessage(
        `${OUTPUT_NAME}: ${contextLabel} for ${path.basename(workspaceRoot)} could not be opened in your browser. Check the ${OUTPUT_NAME} output.`,
      );
    }
    return opened;
  }

  async openExistingSession(session, workspaceRoot, targetUri) {
    if (!session || !this.isSessionAlive(session)) {
      return false;
    }
    if (!(await isPortReachable(session.port))) {
      if (this.session === session) {
        this.session = null;
      }
      await this.clearPersistedSession(workspaceRoot);
      return false;
    }
    const sessionWorkspaceRoot = session.workspaceRoot || workspaceRoot;
    const targetUrl = this.getTargetUrl(session.baseUrl, sessionWorkspaceRoot, targetUri);
    session.targetUri = this.normalizeTargetUri(targetUri);
    this.setPendingOpen(workspaceRoot, `Opening browser preview for ${path.basename(workspaceRoot)}...`, "open");
    try {
      await this.openBrowserUrl(targetUrl, workspaceRoot, "the browser preview", session);
    } finally {
      this.clearPendingOpen();
    }
    return true;
  }

  async startSession(workspaceRoot, targetUri, options = {}) {
    this.setPendingOpen(workspaceRoot, `Starting browser preview for ${path.basename(workspaceRoot)}...`, "start");

    try {
      const port = await findFreePort(options.preferredPort);
      await this.disposeSession();

      const baseUrl = `http://127.0.0.1:${port}/`;
      const rawServerScript = buildRawFileServerScript(workspaceRoot, port);
      const rawProcess = cp.spawn(process.execPath, ["-e", rawServerScript], {
        cwd: workspaceRoot,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });

      const session = {
        workspaceRoot,
        baseUrl,
        port,
        browserOpened: false,
        targetUri: this.normalizeTargetUri(targetUri),
        process: rawProcess,
      };
      this.session = session;
      await this.persistSession(session);
      this.output.appendLine(`[start] ${workspaceRoot}`);
      this.output.appendLine(`[raw] ${baseUrl}`);

      rawProcess.stdout.on("data", (chunk) => {
        this.output.append(chunk.toString());
      });
      rawProcess.stderr.on("data", (chunk) => {
        this.output.append(chunk.toString());
      });
      rawProcess.on("error", (error) => {
        this.clearPendingOpen();
        this.output.appendLine(`[error] ${String(error)}`);
        getVscode().window.showErrorMessage(`${OUTPUT_NAME}: ${String(error)}`);
        if (this.session === session) {
          this.session = null;
        }
        void this.clearPersistedSession(workspaceRoot);
      });
      rawProcess.on("exit", (code, signal) => {
        this.clearPendingOpen();
        this.output.appendLine(`[raw-exit] code=${code} signal=${signal}`);
        const wasCurrentSession = this.session === session;
        if (wasCurrentSession) {
          this.session = null;
        }
        void this.clearPersistedSession(workspaceRoot);
        if (code && code !== 0) {
          getVscode().window.showErrorMessage(`${OUTPUT_NAME}: preview backend exited with code ${code}.`);
          this.output.show(true);
        } else if (wasCurrentSession && signal !== "SIGTERM") {
          getVscode().window.showWarningMessage(`${OUTPUT_NAME}: preview stopped.`);
        }
      });

      await waitForPortReady(port, DOCS_STARTUP_READY_ATTEMPTS, DOCS_STARTUP_READY_DELAY_MS);
      if (this.session !== session) {
        return false;
      }
      const targetUrl = this.getTargetUrl(baseUrl, workspaceRoot, targetUri);
      await this.openBrowserUrl(targetUrl, workspaceRoot, "the browser preview", session);
      return true;
    } catch (error) {
      this.output.appendLine(`[open-error] ${String(error)}`);
      this.output.show(true);
      getVscode().window.showWarningMessage(
        `${OUTPUT_NAME}: the preview backend for ${path.basename(workspaceRoot)} did not become ready yet. Check the ${OUTPUT_NAME} output for details.`,
      );
      return false;
    } finally {
      this.clearPendingOpen();
    }
  }

  async open(targetUri) {
    const workspaceRoot = this.getWorkspaceRoot(targetUri);
    if (!workspaceRoot) {
      getVscode().window.showWarningMessage(`${OUTPUT_NAME}: open a local folder first.`);
      return;
    }

    this.announceManualAction(
      workspaceRoot,
      this.isSessionReusableForWorkspace(this.session, workspaceRoot) ? "open" : "start",
    );

    let preferredPort = null;

    if (!this.isSessionReusableForWorkspace(this.session, workspaceRoot)) {
      const restored = await this.restorePersistedSession(workspaceRoot);
      preferredPort = restored && restored.preferredPort ? restored.preferredPort : null;
    }

    if (this.isSessionReusableForWorkspace(this.session, workspaceRoot)) {
      await this.openExistingSession(this.session, workspaceRoot, targetUri);
      return;
    }

    await this.startSession(workspaceRoot, targetUri, { preferredPort });
  }

  isSessionAlive(session = this.session) {
    return Boolean(
      session &&
      (
        session.restored ||
        (
          session.process &&
          !session.process.killed &&
          session.process.exitCode === null &&
          session.process.signalCode === null
        )
      ),
    );
  }

  isSessionReusableForWorkspace(session, workspaceRoot) {
    return Boolean(
      workspaceRoot &&
      session &&
      session.workspaceRoot &&
      this.isSessionAlive(session) &&
      isSameOrChildPath(session.workspaceRoot, workspaceRoot),
    );
  }

  async disposeSession(options = {}) {
    const keepProcess = Boolean(options.keepProcess);
    if (!this.session) {
      return;
    }
    const { process: childProcess, pid, workspaceRoot } = this.session;
    this.session = null;
    if (keepProcess) {
      return;
    }
    if (childProcess && !childProcess.killed) {
      try {
        childProcess.kill("SIGTERM");
      } catch {}
    } else if (pid) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {}
    }
    await this.clearPersistedSession(workspaceRoot);
  }

  async dispose(options = {}) {
    this.clearPendingOpen();
    await this.disposeSession(options);
  }
}

module.exports = {
  OUTPUT_NAME,
  WorkspaceDocBrowser,
  createWorkspaceDocBrowser(context, options = {}) {
    return new WorkspaceDocBrowser(context, options);
  },
};
