"use strict";

const cp = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const net = require("net");
const vscode = require("vscode");
const {
  deleteSessionRecord,
  loadSharedSessions,
  resolveReusableSessionRecord,
  saveSharedSessions,
  storeSessionRecord,
  isSameOrChildPath,
} = require("./session-store");

const COMMAND_ID = "redcreen.useBrowserPriview.open";
const OUTPUT_NAME = "Use Browser Priview";
const DOCS_STARTUP_LOG_REVEAL_MS = 2500;
const DOCS_STARTUP_READY_ATTEMPTS = 120;
const DOCS_STARTUP_READY_DELAY_MS = 100;
const TREE_REFRESH_MS = 3000;
const FILE_REFRESH_MS = 1200;
const RAW_PREFIX = "/__workspace_doc_browser__/raw/";
const SESSION_STATE_PREFIX = "workspaceDocBrowser.session:";
const SELF_WATCH_INTERVAL_MS = 800;

class WorkspaceDocBrowser {
  constructor(context) {
    this.context = context;
    this.output = vscode.window.createOutputChannel(OUTPUT_NAME);
    this.session = null;
    this.pendingOpen = null;
    this.serverCodeStamp = computeServerCodeStamp();
    this.selfWatchPaths = [
      __filename,
      path.join(__dirname, "package.json"),
    ];
    this.selfRestartQueued = false;
  }

  activate() {
    this.context.subscriptions.push(
      this.output,
      vscode.commands.registerCommand(COMMAND_ID, (targetUri) => this.open(targetUri)),
      { dispose: () => { void this.disposeSession({ keepProcess: true }); } },
      this.watchOwnFilesForReload(),
    );
  }

  watchOwnFilesForReload() {
    const listeners = [];
    const onWatchTick = () => {
      const nextStamp = computeServerCodeStamp();
      if (nextStamp === this.serverCodeStamp || this.selfRestartQueued) {
        return;
      }
      this.selfRestartQueued = true;
      this.output.appendLine("[self-update] Extension code changed on disk. Restarting Extension Host.");
      setTimeout(() => {
        void vscode.commands.executeCommand("workbench.action.restartExtensionHost");
      }, 150);
    };

    for (const watchPath of this.selfWatchPaths) {
      const listener = () => onWatchTick();
      try {
        fs.watchFile(watchPath, { interval: SELF_WATCH_INTERVAL_MS, persistent: false }, listener);
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
      return null;
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
      return session;
    }
    const stored = this.context.globalState.get(this.getSessionStateKey(workspaceRoot));
    if (!stored || !stored.port) {
      return null;
    }
    if (stored.serverCodeStamp !== this.serverCodeStamp) {
      if (stored.pid) {
        try {
          process.kill(stored.pid, "SIGTERM");
        } catch {}
      }
      await this.clearPersistedSession(workspaceRoot);
      return null;
    }
    const reachable = await isPortReachable(stored.port);
    if (!reachable) {
      await this.clearPersistedSession(workspaceRoot);
      return null;
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
    return session;
  }

  normalizeTargetUri(targetUri) {
    if (targetUri && targetUri.scheme === "file") {
      return targetUri;
    }
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document && editor.document.uri.scheme === "file") {
      return editor.document.uri;
    }
    return null;
  }

  getWorkspaceRoot(targetUri) {
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
    const normalizedPath = normalizeSlashes(String(relativePath || "")).replace(/^\/+/, "");
    const trimmedPath = normalizedPath.replace(/\/+$/, "");
    const pathValue = kind === "directory"
      ? (trimmedPath ? `${encodePathSegments(trimmedPath)}/` : "")
      : encodePathSegments(trimmedPath);
    return new URL(pathValue, `${String(baseUrl || "").replace(/\/$/, "")}/`).toString();
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
    vscode.window.showInformationMessage(message);
  }

  async openBrowserUrl(url, workspaceRoot, contextLabel, session) {
    this.output.appendLine(`[browser-open] ${contextLabel}: ${url}`);
    const opened = await vscode.env.openExternal(vscode.Uri.parse(url));
    if (session && this.session === session) {
      session.browserOpened = Boolean(opened);
      void this.persistSession(session);
    }
    if (!opened) {
      this.output.appendLine(`[browser-open-error] ${contextLabel}: VS Code could not hand the URL to the system browser.`);
      this.output.show(true);
      vscode.window.showWarningMessage(
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

  async startSession(workspaceRoot, targetUri) {
    this.setPendingOpen(workspaceRoot, `Starting browser preview for ${path.basename(workspaceRoot)}...`, "start");

    try {
      const port = await findFreePort();
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
        vscode.window.showErrorMessage(`${OUTPUT_NAME}: ${String(error)}`);
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
          vscode.window.showErrorMessage(`${OUTPUT_NAME}: preview backend exited with code ${code}.`);
          this.output.show(true);
        } else if (wasCurrentSession && signal !== "SIGTERM") {
          vscode.window.showWarningMessage(`${OUTPUT_NAME}: preview stopped.`);
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
      vscode.window.showWarningMessage(
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
      vscode.window.showWarningMessage(`${OUTPUT_NAME}: open a local folder first.`);
      return;
    }

    this.announceManualAction(
      workspaceRoot,
      this.isSessionReusableForWorkspace(this.session, workspaceRoot) ? "open" : "start",
    );

    if (!this.isSessionReusableForWorkspace(this.session, workspaceRoot)) {
      await this.restorePersistedSession(workspaceRoot);
    }

    if (this.isSessionReusableForWorkspace(this.session, workspaceRoot)) {
      await this.openExistingSession(this.session, workspaceRoot, targetUri);
      return;
    }

    await this.startSession(workspaceRoot, targetUri);
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

function isMarkdownFile(name, absolutePath) {
  if (!/\.md$/i.test(name)) {
    return false;
  }
  try {
    return fs.statSync(absolutePath).isFile();
  } catch {
    return false;
  }
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
    if (!isMarkdownFile(actualName, absolutePath)) {
      continue;
    }
    return normalizeSlashes(path.posix.join(normalizedRelativeDir, actualName));
  }

  return "";
}

function shouldIgnoreEntry(name, isDirectory, options = {}) {
  const includeDotfiles = Boolean(options.includeDotfiles);
  if (!name || name === ".DS_Store") {
    return true;
  }
  if (!includeDotfiles && name.startsWith(".") && name !== ".github") {
    return true;
  }
  if (isDirectory) {
    return ["node_modules", ".git", ".vscode", ".idea", "__pycache__", ".mkdocs", ".mkdocs-site", "dist"].includes(name);
  }
  return false;
}

function compareEntries(left, right) {
  if (left.isDirectory() && !right.isDirectory()) {
    return -1;
  }
  if (!left.isDirectory() && right.isDirectory()) {
    return 1;
  }
  return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" });
}

function compareResolvedEntries(left, right) {
  const leftIsDirectory = Boolean(left && (left.isDirectory ?? (left.info && left.info.isDirectory)));
  const rightIsDirectory = Boolean(right && (right.isDirectory ?? (right.info && right.info.isDirectory)));
  if (leftIsDirectory && !rightIsDirectory) {
    return -1;
  }
  if (!leftIsDirectory && rightIsDirectory) {
    return 1;
  }
  return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" });
}

function findFirstMarkdownPath(workspaceRoot, relativeDir, visitedRealPaths = new Set()) {
  const directLandingPath = findDirectoryLandingMarkdownPath(workspaceRoot, relativeDir);
  if (directLandingPath) {
    return directLandingPath;
  }
  const absoluteDir = path.join(workspaceRoot, relativeDir);
  const realDirPath = (() => {
    try {
      return fs.realpathSync.native(absoluteDir);
    } catch {
      return path.resolve(absoluteDir);
    }
  })();
  if (visitedRealPaths.has(realDirPath)) {
    return "";
  }
  const nextVisitedRealPaths = new Set(visitedRealPaths);
  nextVisitedRealPaths.add(realDirPath);

  let entries = [];
  try {
    entries = fs.readdirSync(absoluteDir, { withFileTypes: true })
      .map((entry) => {
        const entryAbsolutePath = path.join(absoluteDir, entry.name);
        let isDirectory = entry.isDirectory();
        let isFile = entry.isFile();
        try {
          const stat = fs.statSync(entryAbsolutePath);
          isDirectory = stat.isDirectory();
          isFile = stat.isFile();
        } catch {}
        return {
          name: entry.name,
          absolutePath: entryAbsolutePath,
          isDirectory,
          isFile,
        };
      })
      .filter((entry) => !shouldIgnoreEntry(entry.name, entry.isDirectory, { includeDotfiles: false }))
      .sort(compareResolvedEntries);
  } catch {
    return "";
  }

  for (const entry of entries) {
    const relativePath = normalizeSlashes(path.posix.join(relativeDir, entry.name));
    if (entry.isDirectory) {
      const childPath = findFirstMarkdownPath(workspaceRoot, relativePath, nextVisitedRealPaths);
      if (childPath) {
        return childPath;
      }
      continue;
    }
    if (entry.isFile && isMarkdownFile(entry.name, entry.absolutePath)) {
      return relativePath;
    }
  }
  return "";
}

function buildRawFileServerScript(workspaceRoot, port) {
  return `
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = ${JSON.stringify(workspaceRoot)};
const rootPath = path.resolve(root);
const rootRealPath = (() => {
  try {
    return fs.realpathSync.native(rootPath);
  } catch {
    return rootPath;
  }
})();
const port = ${Number(port)};
const TREE_REFRESH_MS = ${TREE_REFRESH_MS};
const FILE_REFRESH_MS = ${FILE_REFRESH_MS};
const RAW_PREFIX = ${JSON.stringify(RAW_PREFIX)};

const contentTypes = new Map([
  [".md", "text/markdown; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".ts", "text/plain; charset=utf-8"],
  [".py", "text/x-python; charset=utf-8"],
  [".sh", "text/x-shellscript; charset=utf-8"],
  [".yml", "text/yaml; charset=utf-8"],
  [".yaml", "text/yaml; charset=utf-8"],
  [".toml", "text/plain; charset=utf-8"],
  [".ini", "text/plain; charset=utf-8"],
  [".cfg", "text/plain; charset=utf-8"],
  [".conf", "text/plain; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".csv", "text/csv; charset=utf-8"],
  [".env", "text/plain; charset=utf-8"],
  [".gitignore", "text/plain; charset=utf-8"],
  [".dockerfile", "text/plain; charset=utf-8"],
  [".png", "image/png"],
  [".apng", "image/apng"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".bmp", "image/bmp"],
  [".ico", "image/x-icon"],
  [".avif", "image/avif"],
  [".tif", "image/tiff"],
  [".tiff", "image/tiff"],
  [".mp4", "video/mp4"],
  [".webm", "video/webm"],
  [".mov", "video/quicktime"],
  [".m4v", "video/x-m4v"],
  [".ogg", "video/ogg"],
  [".ogv", "video/ogg"],
]);

function send(res, status, body, contentType) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function normalizeSlashes(value) {
  return String(value || "").replace(/\\\\/g, "/");
}

function getFileKind(filePath) {
  const lowerPath = String(filePath || "").toLowerCase();
  if (/\\.md$/i.test(lowerPath)) {
    return "markdown";
  }
  if (/\\.(html?|xhtml)$/i.test(lowerPath)) {
    return "html";
  }
  if (/\\.(png|apng|jpe?g|gif|webp|svg|bmp|ico|avif|tiff?)$/i.test(lowerPath)) {
    return "image";
  }
  if (/\\.(mp4|webm|mov|m4v|ogg|ogv)$/i.test(lowerPath)) {
    return "video";
  }
  if (/\\.(txt|json|js|ts|py|sh|yml|yaml|toml|ini|cfg|conf|xml|css|csv|env)$/i.test(lowerPath) || /(^|\\/)(\\.gitignore|dockerfile)$/i.test(lowerPath)) {
    return "text";
  }
  return "file";
}

function shouldIgnoreEntry(name, isDirectory, includeDotfiles) {
  if (!name || name === ".DS_Store") {
    return true;
  }
  if (!includeDotfiles && name.startsWith(".") && name !== ".github") {
    return true;
  }
  if (isDirectory) {
    return ["node_modules", ".git", ".vscode", ".idea", "__pycache__", ".mkdocs", ".mkdocs-site", "dist"].includes(name);
  }
  return false;
}

function compareEntries(left, right) {
  if (left.isDirectory() && !right.isDirectory()) {
    return -1;
  }
  if (!left.isDirectory() && right.isDirectory()) {
    return 1;
  }
  return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" });
}

function compareResolvedEntries(left, right) {
  if (left.isDirectory && !right.isDirectory) {
    return -1;
  }
  if (!left.isDirectory && right.isDirectory) {
    return 1;
  }
  return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" });
}

function isWithinRoot(realPath) {
  return realPath === rootRealPath || realPath.startsWith(rootRealPath + path.sep);
}

function inspectWorkspacePath(relativePath) {
  const normalizedRelativePath = normalizeSlashes(String(relativePath || "").replace(/^\\/+|\\/+$/g, ""));
  const absolutePath = path.resolve(rootPath, normalizedRelativePath);
  if (!absolutePath.startsWith(rootPath)) {
    return null;
  }
  let lstat = null;
  try {
    lstat = fs.lstatSync(absolutePath);
  } catch {
    return null;
  }

  let stat = lstat;
  let realPath = absolutePath;
  let isExternal = false;
  let isBrokenSymlink = false;
  const isSymlink = lstat.isSymbolicLink();
  if (isSymlink) {
    try {
      realPath = fs.realpathSync.native(absolutePath);
      isExternal = !isWithinRoot(realPath);
      stat = fs.statSync(absolutePath);
    } catch {
      isBrokenSymlink = true;
    }
  }

  const isDirectory = !isBrokenSymlink && stat.isDirectory();
  const isFile = !isBrokenSymlink && stat.isFile();
  return {
    relativePath: normalizedRelativePath,
    absolutePath,
    realPath,
    isDirectory,
    isFile,
    isSymlink,
    isExternal,
    isBrokenSymlink,
    kind: isDirectory ? "directory" : isFile ? getFileKind(normalizedRelativePath) : "file",
  };
}

function rawRelativePathFromRequestPath(requestPath) {
  const normalized = normalizeSlashes(String(requestPath || ""));
  if (!normalized.startsWith(RAW_PREFIX)) {
    return "";
  }
  return normalized.slice(RAW_PREFIX.length).replace(/^\\/+/, "");
}

function findDirectoryLandingMarkdownPath(relativeDir) {
  const normalizedRelativeDir = normalizeSlashes(String(relativeDir || "").replace(/^\\/+|\\/+$/g, ""));
  const preferredNames = [
    "README.md",
    "README.zh-CN.md",
    "index.md",
  ];
  let entries = [];
  try {
    entries = fs.readdirSync(path.resolve(rootPath, normalizedRelativeDir), { withFileTypes: true });
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
    const candidateRelativePath = normalizeSlashes(path.posix.join(normalizedRelativeDir, actualName));
    const candidateInfo = inspectWorkspacePath(candidateRelativePath);
    if (candidateInfo && candidateInfo.isFile && !candidateInfo.isExternal && !candidateInfo.isBrokenSymlink && candidateInfo.kind === "markdown") {
      return candidateRelativePath;
    }
  }
  return "";
}

function isCurlRequest(req) {
  const userAgent = String((req && req.headers && req.headers["user-agent"]) || "");
  return /(?:^|\\s)curl\\//i.test(userAgent);
}

function sendPreviewPage(res, relativePath, resourceKind) {
  return send(
    res,
    200,
    (${buildBootstrapViewerHtml.toString()})(path.basename(root) || "Workspace Docs", relativePath, resourceKind, TREE_REFRESH_MS, FILE_REFRESH_MS),
    "text/html; charset=utf-8",
  );
}

function sendRawFile(req, res, target) {
  const ext = path.extname(target).toLowerCase();
  const type = contentTypes.get(ext) || contentTypes.get(path.basename(target).toLowerCase()) || "application/octet-stream";
  fs.stat(target, (statError, stat) => {
    if (statError || !stat.isFile()) {
      return send(res, 404, "Not Found", "text/plain; charset=utf-8");
    }
    const commonHeaders = {
      "Content-Type": type,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
      "Accept-Ranges": "bytes",
    };
    const range = String((req && req.headers && req.headers.range) || "").trim();
    if (range) {
      const match = range.match(/^bytes=(\\d*)-(\\d*)$/);
      if (!match) {
        res.writeHead(416, {
          ...commonHeaders,
          "Content-Range": "bytes */" + stat.size,
        });
        return res.end();
      }
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : (stat.size - 1);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || end >= stat.size) {
        res.writeHead(416, {
          ...commonHeaders,
          "Content-Range": "bytes */" + stat.size,
        });
        return res.end();
      }
      res.writeHead(206, {
        ...commonHeaders,
        "Content-Length": end - start + 1,
        "Content-Range": "bytes " + start + "-" + end + "/" + stat.size,
      });
      return fs.createReadStream(target, { start, end }).pipe(res);
    }
    res.writeHead(200, {
      ...commonHeaders,
      "Content-Length": stat.size,
    });
    return fs.createReadStream(target).pipe(res);
  });
}

function buildRepoTree(relativeDir, visitedRealPaths = new Set()) {
  const directoryInfo = inspectWorkspacePath(relativeDir);
  if (!directoryInfo || !directoryInfo.isDirectory || directoryInfo.isExternal || directoryInfo.isBrokenSymlink) {
    return [];
  }
  const realDirectoryPath = directoryInfo.realPath || directoryInfo.absolutePath;
  if (visitedRealPaths.has(realDirectoryPath)) {
    return [];
  }
  const nextVisitedRealPaths = new Set(visitedRealPaths);
  nextVisitedRealPaths.add(realDirectoryPath);

  const absoluteDir = directoryInfo.absolutePath;
  let entries = [];
  try {
    entries = fs.readdirSync(absoluteDir, { withFileTypes: true })
      .map((entry) => {
        const entryRelativePath = normalizeSlashes(path.posix.join(relativeDir, entry.name));
        const info = inspectWorkspacePath(entryRelativePath);
        if (!info) {
          return null;
        }
        return {
          name: entry.name,
          relativePath: entryRelativePath,
          info,
        };
      })
      .filter((entry) => entry && !shouldIgnoreEntry(entry.name, Boolean(entry.info && entry.info.isDirectory), true))
      .sort(compareResolvedEntries);
  } catch {
    return [];
  }

  const items = [];
  for (const entry of entries) {
    const { relativePath, info } = entry;
    if (info.isDirectory) {
      items.push({
        title: entry.name + (info.isSymlink ? " ↗/" : "/"),
        kind: "directory",
        path: relativePath,
        isSymlink: info.isSymlink,
        children: (!info.isExternal && !info.isBrokenSymlink)
          ? buildRepoTree(relativePath, nextVisitedRealPaths)
          : [],
      });
      continue;
    }
    if (!info.isFile) {
      continue;
    }
    items.push({
      title: entry.name + (info.isSymlink ? " ↗" : ""),
      kind: info.kind,
      sourcePath: relativePath,
      isSymlink: info.isSymlink,
    });
  }
  return items;
}

http.createServer((req, res) => {
  if (!req.url) {
    return send(res, 400, "Bad Request", "text/plain; charset=utf-8");
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    });
    return res.end();
  }

  const parsed = new URL(req.url, "http://127.0.0.1");
  if (parsed.pathname === "/__workspace_doc_browser__/tree") {
    return send(res, 200, JSON.stringify(buildRepoTree("")), "application/json; charset=utf-8");
  }
  if (parsed.pathname === "/__workspace_doc_browser__/bootstrap") {
    const relativePath = String(parsed.searchParams.get("path") || "");
    const entryInfo = inspectWorkspacePath(relativePath);
    if (!entryInfo || entryInfo.isExternal) {
      return send(res, 404, "Not Found", "text/plain; charset=utf-8");
    }
    if (entryInfo.isBrokenSymlink) {
      return send(res, 404, "Broken symlink.", "text/plain; charset=utf-8");
    }
    if (isCurlRequest(req) && entryInfo.isFile) {
      return sendRawFile(req, res, entryInfo.absolutePath);
    }
    return sendPreviewPage(res, relativePath, entryInfo.kind);
  }

  const rawRelativePath = rawRelativePathFromRequestPath(parsed.pathname);
  const relativePath = decodeURIComponent(rawRelativePath || parsed.pathname.replace(/^\\/+/, ""));
  const entryInfo = inspectWorkspacePath(relativePath);
  if (!entryInfo) {
    return send(res, 404, "Not Found", "text/plain; charset=utf-8");
  }
  if (entryInfo.isExternal) {
    return send(res, 403, "Symlink target is outside the workspace.", "text/plain; charset=utf-8");
  }
  if (entryInfo.isBrokenSymlink) {
    return send(res, 404, "Broken symlink.", "text/plain; charset=utf-8");
  }

  if (entryInfo.isDirectory) {
    if (rawRelativePath) {
      return send(res, 404, "Not Found", "text/plain; charset=utf-8");
    }
    const normalizedDirectoryPath = normalizeSlashes(relativePath).replace(/^\\/+|\\/+$/g, "");
    const landingPath = findDirectoryLandingMarkdownPath(normalizedDirectoryPath);
    if (landingPath) {
      res.writeHead(302, {
        Location: "/" + encodeURIComponent(landingPath).replace(/%2F/g, "/"),
        "Cache-Control": "no-store",
      });
      return res.end();
    }
    if (parsed.pathname !== "/" && !parsed.pathname.endsWith("/")) {
      res.writeHead(302, {
        Location: "/" + encodeURIComponent(normalizedDirectoryPath).replace(/%2F/g, "/") + "/",
        "Cache-Control": "no-store",
      });
      return res.end();
    }
    return sendPreviewPage(res, normalizedDirectoryPath, "directory");
  }

  if (!entryInfo.isFile) {
    return send(res, 404, "Not Found", "text/plain; charset=utf-8");
  }

  if (isCurlRequest(req)) {
    return sendRawFile(req, res, entryInfo.absolutePath);
  }

  if (!rawRelativePath) {
    const kind = entryInfo.kind;
    if (kind === "markdown" || kind === "html" || kind === "image" || kind === "video" || kind === "text") {
      return sendPreviewPage(res, relativePath, kind);
    }
  }

  return sendRawFile(req, res, entryInfo.absolutePath);
}).listen(port, "127.0.0.1", () => {
  console.log("[raw-server] listening on http://127.0.0.1:" + port);
});
`;
}

function buildBootstrapViewerHtml(workspaceName, relativePath, resourceKind, treeRefreshMs, fileRefreshMs) {
  function escapeBootstrapHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  const title = escapeBootstrapHtml(String(workspaceName || "Workspace Docs"));
  const fileLabel = escapeBootstrapHtml(String(relativePath || ""));
  const safeRelativePath = JSON.stringify(String(relativePath || ""));
  const safeWorkspaceName = JSON.stringify(String(workspaceName || "Workspace Docs"));
  const safeResourceKind = JSON.stringify(String(resourceKind || "file"));
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root {
      --bg: #f3f5f7;
      --panel: #ffffff;
      --border: #d0d7de;
      --text: #1f2328;
      --muted: #59636e;
      --link: #0969da;
      --code-bg: rgba(175, 184, 193, 0.2);
      --pre-bg: #f6f8fa;
      --sidebar-hover: #eef5ff;
      --quote-bg: #fbfcfd;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 16px/1.72 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", Helvetica, Arial, sans-serif;
      text-rendering: optimizeLegibility;
    }
    .shell {
      width: min(1400px, calc(100vw - 32px));
      margin: 18px auto;
    }
    .content, .sidebar {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(31, 35, 40, 0.04);
    }
    .layout {
      display: grid;
      grid-template-columns: 286px minmax(0, 1fr);
      gap: 18px;
      align-items: start;
    }
    body.sidebar-collapsed .layout {
      grid-template-columns: 56px minmax(0, 1fr);
    }
    .sidebar {
      position: sticky;
      top: 16px;
      overflow: hidden;
    }
    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      font-weight: 700;
      border-bottom: 1px solid var(--border);
      background: linear-gradient(to bottom, #ffffff, #fafbfc);
    }
    .sidebar-title {
      white-space: nowrap;
    }
    .sidebar-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      margin-left: 12px;
      padding: 0;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #ffffff;
      color: var(--muted);
      cursor: pointer;
      font: inherit;
      line-height: 1;
    }
    .sidebar-toggle:hover {
      color: var(--link);
      background: var(--sidebar-hover);
    }
    .sidebar-body {
      max-height: calc(100vh - 64px);
      overflow: auto;
      padding: 10px 0 12px;
    }
    body.sidebar-collapsed .sidebar-header {
      justify-content: center;
      padding: 14px 10px;
      border-bottom: 0;
    }
    body.sidebar-collapsed .sidebar-title,
    body.sidebar-collapsed .sidebar-body {
      display: none;
    }
    body.sidebar-collapsed .sidebar-toggle {
      margin-left: 0;
    }
    .tree,
    .tree ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .tree li {
      margin: 0;
    }
    .tree ul {
      padding-left: 18px;
    }
    .tree details {
      margin: 0;
    }
    .tree summary {
      cursor: pointer;
      padding: 7px 16px;
      color: var(--muted);
      user-select: none;
      font-size: 14px;
      line-height: 1.45;
    }
    .tree a {
      display: block;
      padding: 7px 16px;
      color: var(--text);
      text-decoration: none;
      border-left: 2px solid transparent;
      font-size: 14px;
      line-height: 1.45;
      word-break: break-word;
    }
    .tree a:hover {
      background: var(--sidebar-hover);
      color: var(--link);
    }
    .tree a.active {
      color: var(--link);
      font-weight: 600;
      border-left-color: var(--link);
      background: rgba(9, 105, 218, 0.08);
    }
    .tree-file {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .tree-thumb {
      flex: 0 0 42px;
      width: 42px;
      height: 42px;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: 8px;
      background:
        linear-gradient(45deg, rgba(208, 215, 222, 0.36) 25%, transparent 25%, transparent 75%, rgba(208, 215, 222, 0.36) 75%),
        linear-gradient(45deg, rgba(208, 215, 222, 0.36) 25%, transparent 25%, transparent 75%, rgba(208, 215, 222, 0.36) 75%);
      background-color: #ffffff;
      background-position: 0 0, 6px 6px;
      background-size: 12px 12px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
    }
    .tree-thumb img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .tree-label {
      min-width: 0;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .content {
      padding: 32px 36px 40px;
      min-height: 70vh;
    }
    .content-shell {
      width: min(860px, 100%);
    }
    .file-meta {
      margin-bottom: 22px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      line-height: 1.7;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .file-meta a {
      color: var(--muted);
      text-decoration: none;
    }
    .file-meta a:hover {
      color: var(--link);
      text-decoration: underline;
    }
    .file-meta-separator {
      margin: 0 0.42em;
      color: rgba(89, 99, 110, 0.72);
    }
    .markdown-body {
      font-size: 17px;
    }
    .markdown-body > :first-child {
      margin-top: 0;
    }
    .markdown-body > :last-child {
      margin-bottom: 0;
    }
    .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 {
      line-height: 1.25;
      margin-top: 1.8em;
      margin-bottom: 0.7em;
      font-weight: 700;
      letter-spacing: -0.02em;
      scroll-margin-top: 24px;
    }
    .markdown-body h1 {
      font-size: 2.2rem;
    }
    .markdown-body h2 {
      font-size: 1.72rem;
    }
    .markdown-body h3 {
      font-size: 1.35rem;
    }
    .markdown-body h4 {
      font-size: 1.12rem;
    }
    .markdown-body h5, .markdown-body h6 {
      font-size: 1rem;
    }
    .markdown-body h1, .markdown-body h2 {
      padding-bottom: 0.3em;
      border-bottom: 1px solid var(--border);
    }
    .markdown-body p, .markdown-body ul, .markdown-body ol, .markdown-body blockquote, .markdown-body pre, .markdown-body table, .markdown-body hr {
      margin-top: 0;
      margin-bottom: 1.15em;
    }
    .markdown-body ul, .markdown-body ol {
      padding-left: 1.45em;
    }
    .markdown-body li {
      margin: 0.35em 0;
    }
    .markdown-body li > p {
      margin-bottom: 0.45em;
    }
    .markdown-body a {
      color: var(--link);
      text-decoration: none;
      text-underline-offset: 0.18em;
      word-break: break-word;
    }
    .markdown-body a:hover {
      text-decoration: underline;
    }
    .markdown-body strong {
      font-weight: 700;
    }
    .markdown-body hr {
      border: 0;
      border-top: 1px solid var(--border);
    }
    .markdown-body code {
      padding: 0.2em 0.4em;
      font-size: 0.88em;
      background: var(--code-bg);
      border-radius: 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    .markdown-body pre {
      padding: 18px 20px;
      overflow: auto;
      background: var(--pre-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      font-size: 14px;
      line-height: 1.58;
    }
    .markdown-body pre code {
      padding: 0;
      background: transparent;
      border-radius: 0;
      white-space: pre;
    }
    .markdown-body blockquote {
      padding: 0.12em 1.05em;
      color: var(--muted);
      border-left: 0.25em solid var(--border);
      background: var(--quote-bg);
      border-radius: 0 10px 10px 0;
    }
    .markdown-body blockquote > :last-child {
      margin-bottom: 0;
    }
    .markdown-body .table-wrap {
      width: 100%;
      overflow-x: auto;
      margin-bottom: 1.15em;
    }
    .markdown-body .table-wrap:last-child {
      margin-bottom: 0;
    }
    .markdown-body table {
      width: 100%;
      border-collapse: collapse;
      border-spacing: 0;
      table-layout: fixed;
    }
    .markdown-body th,
    .markdown-body td {
      padding: 10px 12px;
      border: 1px solid var(--border);
      text-align: left;
      vertical-align: top;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .markdown-body th {
      background: #f6f8fa;
      font-weight: 600;
    }
    .markdown-body td code,
    .markdown-body th code {
      white-space: break-spaces;
      word-break: break-word;
    }
    .markdown-body img {
      display: block;
      max-width: 100%;
      height: auto;
      margin: 1.2em 0;
      border-radius: 10px;
    }
    .markdown-body .mermaid-diagram {
      margin: 1.2em 0;
      padding: 16px 18px;
      overflow-x: auto;
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 10px;
    }
    .markdown-body .mermaid-diagram .mermaid {
      width: max-content;
      min-width: 100%;
    }
    .markdown-body .mermaid-diagram svg {
      display: block;
      height: auto;
      max-width: none;
    }
    .markdown-body .mermaid-diagram.mermaid-error .mermaid {
      color: var(--muted);
      font: 14px/1.58 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      white-space: pre;
    }
    .asset-body {
      margin-top: 4px;
    }
    .asset-image-stage {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 280px;
      padding: 18px;
      overflow: auto;
      border: 1px solid var(--border);
      border-radius: 14px;
      background:
        linear-gradient(45deg, rgba(208, 215, 222, 0.24) 25%, transparent 25%, transparent 75%, rgba(208, 215, 222, 0.24) 75%),
        linear-gradient(45deg, rgba(208, 215, 222, 0.24) 25%, transparent 25%, transparent 75%, rgba(208, 215, 222, 0.24) 75%);
      background-color: #ffffff;
      background-position: 0 0, 12px 12px;
      background-size: 24px 24px;
    }
    .asset-image-stage img {
      display: block;
      max-width: 100%;
      max-height: min(78vh, 980px);
      width: auto;
      height: auto;
      border-radius: 10px;
      box-shadow: 0 18px 44px rgba(31, 35, 40, 0.12);
      background: #ffffff;
    }
    .asset-video-stage {
      padding: 18px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: #0f1720;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }
    .asset-video-stage video {
      display: block;
      width: 100%;
      max-height: min(78vh, 980px);
      border-radius: 10px;
      background: #000000;
    }
    .asset-html-stage {
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: #ffffff;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }
    .asset-html-stage iframe {
      display: block;
      width: 100%;
      min-height: min(78vh, 980px);
      border: 0;
      background: #ffffff;
    }
    .asset-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
    }
    .asset-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 38px;
      padding: 0 14px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #ffffff;
      color: var(--text);
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
    }
    .asset-button:hover {
      color: var(--link);
      background: var(--sidebar-hover);
    }
    .text-file-body pre {
      padding: 18px 20px;
      margin: 0;
      overflow: auto;
      background: var(--pre-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      font-size: 14px;
      line-height: 1.58;
    }
    .text-file-body code {
      padding: 0;
      background: transparent;
      border-radius: 0;
      white-space: pre;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    .directory-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 14px;
    }
    .directory-card {
      display: block;
      padding: 14px;
      color: var(--text);
      text-decoration: none;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: #ffffff;
      box-shadow: 0 8px 24px rgba(31, 35, 40, 0.04);
    }
    .directory-card:hover {
      color: var(--link);
      border-color: rgba(9, 105, 218, 0.25);
      background: var(--sidebar-hover);
    }
    .directory-card-thumb {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 120px;
      margin-bottom: 12px;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: 10px;
      background:
        linear-gradient(45deg, rgba(208, 215, 222, 0.24) 25%, transparent 25%, transparent 75%, rgba(208, 215, 222, 0.24) 75%),
        linear-gradient(45deg, rgba(208, 215, 222, 0.24) 25%, transparent 25%, transparent 75%, rgba(208, 215, 222, 0.24) 75%);
      background-color: #ffffff;
      background-position: 0 0, 12px 12px;
      background-size: 24px 24px;
      color: var(--muted);
      font-size: 40px;
    }
    .directory-card-thumb img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .directory-card-name {
      font-size: 15px;
      font-weight: 600;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .directory-card-meta {
      margin-top: 6px;
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .markdown-body .empty-state,
    .markdown-body .error-state {
      color: var(--muted);
      font-size: 15px;
    }
    @media (max-width: 900px) {
      .layout {
        grid-template-columns: 1fr;
      }
      body.sidebar-collapsed .layout {
        grid-template-columns: 1fr;
      }
      .sidebar {
        position: static;
      }
      body.sidebar-collapsed .sidebar {
        display: none;
      }
      .sidebar-body {
        max-height: none;
      }
      .content {
        padding: 24px 20px 28px;
      }
      .markdown-body {
        font-size: 16px;
      }
      .markdown-body h1 {
        font-size: 1.9rem;
      }
      .markdown-body h2 {
        font-size: 1.5rem;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="layout">
      <aside id="sidebar" class="sidebar">
        <div class="sidebar-header">
          <span class="sidebar-title">Files</span>
          <button id="sidebar-toggle" class="sidebar-toggle" type="button" aria-label="Collapse file tree" title="Collapse file tree">◀</button>
        </div>
        <div id="sidebar-body" class="sidebar-body"></div>
      </aside>
      <article id="content" class="content">
        <div class="content-shell">
          <div class="file-meta">${fileLabel || "Current markdown file"}</div>
          <div class="markdown-body">
            <p class="empty-state">Loading markdown preview…</p>
          </div>
        </div>
      </article>
    </div>
  </div>
  <script>
    const relativePath = ${safeRelativePath};
    const workspaceName = ${safeWorkspaceName};
    const currentResourceKind = ${safeResourceKind};
    const treeRefreshMs = ${Number(treeRefreshMs)};
    const fileRefreshMs = ${Number(fileRefreshMs)};
    const rawPrefix = ${JSON.stringify(RAW_PREFIX)};
    const content = document.getElementById("content");
    const sidebar = document.getElementById("sidebar");
    const sidebarBody = document.getElementById("sidebar-body");
    const sidebarToggle = document.getElementById("sidebar-toggle");
    const mermaidScriptUrl = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
    let lastMarkdown = "";
    let lastTreeJson = "";
    let lastTreeData = [];
    let mermaidApi = null;
    let mermaidLoadPromise = null;
    const openFolders = new Set();
    const sidebarStateKey = "workspace-doc-browser.sidebar:" + workspaceName;
    const scrollStateKeyPrefix = "workspace-doc-browser.scroll:" + workspaceName + ":";
    let scrollEntryId = "";
    let scrollSaveFrame = 0;

    function escapeHtml(value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    function encodePath(pathValue) {
      return String(pathValue || "")
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
    }

    function fileKindForPath(sourcePath) {
      const lowerPath = String(sourcePath || "").toLowerCase();
      if (/\\.md$/i.test(lowerPath)) {
        return "markdown";
      }
      if (/\\.(html?|xhtml)$/i.test(lowerPath)) {
        return "html";
      }
      if (/\\.(png|apng|jpe?g|gif|webp|svg|bmp|ico|avif|tiff?)$/i.test(lowerPath)) {
        return "image";
      }
      if (/\\.(mp4|webm|mov|m4v|ogg|ogv)$/i.test(lowerPath)) {
        return "video";
      }
      if (/\\.(txt|json|js|ts|py|sh|yml|yaml|toml|ini|cfg|conf|xml|css|csv|env)$/i.test(lowerPath) || /(^|\\/)(\\.gitignore|dockerfile)$/i.test(lowerPath)) {
        return "text";
      }
      return "file";
    }

    function isExternalHref(value) {
      return /^(https?:|mailto:|tel:|data:)/i.test(String(value || "").trim());
    }

    function splitHref(value) {
      const raw = String(value || "");
      const index = raw.indexOf("#");
      if (index === -1) {
        return { pathPart: raw, hashPart: "" };
      }
      return {
        pathPart: raw.slice(0, index),
        hashPart: raw.slice(index + 1),
      };
    }

    function resolveRelativePath(basePath, targetPath) {
      const normalizedBase = String(basePath || "").replace(/^\\/+/, "");
      const normalizedTarget = String(targetPath || "").replace(/^\\/+/, "");
      const baseSegments = normalizedBase.split("/").filter(Boolean);
      if (currentResourceKind !== "directory" && baseSegments.length) {
        baseSegments.pop();
      }
      for (const segment of normalizedTarget.split("/")) {
        if (!segment || segment === ".") {
          continue;
        }
        if (segment === "..") {
          if (baseSegments.length) {
            baseSegments.pop();
          }
          continue;
        }
        baseSegments.push(segment);
      }
      return baseSegments.join("/");
    }

    function previewHref(sourcePath, resourceKind = "", hashPart = "") {
      const normalizedPath = String(sourcePath || "").replace(/^\\/+|\\/+$/g, "");
      const baseHref = resourceKind === "directory"
        ? (normalizedPath ? "/" + encodePath(normalizedPath) + "/" : "/")
        : "/" + encodePath(normalizedPath);
      return baseHref + (hashPart ? "#" + encodeURIComponent(hashPart) : "");
    }

    function rawFileHref(sourcePath, hashPart = "", cacheBust = "") {
      const query = cacheBust ? "?v=" + encodeURIComponent(cacheBust) : "";
      return rawPrefix + encodePath(sourcePath) + query + (hashPart ? "#" + encodeURIComponent(hashPart) : "");
    }

    function resolvePreviewHref(href) {
      const raw = String(href || "").trim();
      if (!raw) {
        return "";
      }
      if (isExternalHref(raw)) {
        return raw;
      }
      const { pathPart, hashPart } = splitHref(raw);
      if (!pathPart && hashPart) {
        return "#" + encodeURIComponent(hashPart);
      }
      const isDirectoryLink = pathPart.endsWith("/");
      const resolvedPath = pathPart.startsWith("/")
        ? pathPart.replace(/^\\/+/, "")
        : resolveRelativePath(relativePath, pathPart);
      if (isDirectoryLink) {
        return previewHref(resolvedPath, "directory", hashPart);
      }
      const treeEntry = findTreeEntryByPath(lastTreeData, resolvedPath);
      if (treeEntry && treeEntry.kind === "directory") {
        return previewHref(resolvedPath, "directory", hashPart);
      }
      if (treeEntry && (treeEntry.kind === "markdown" || treeEntry.kind === "html" || treeEntry.kind === "image" || treeEntry.kind === "video" || treeEntry.kind === "text")) {
        return previewHref(resolvedPath, treeEntry.kind, hashPart);
      }
      const kind = fileKindForPath(resolvedPath);
      if (kind === "markdown" || kind === "html" || kind === "image" || kind === "video" || kind === "text") {
        return previewHref(resolvedPath, kind, hashPart);
      }
      return rawFileHref(resolvedPath, hashPart);
    }

    function resolveInlineImageSrc(href) {
      const raw = String(href || "").trim();
      if (!raw) {
        return "";
      }
      if (isExternalHref(raw)) {
        return raw;
      }
      const { pathPart } = splitHref(raw);
      const resolvedPath = pathPart.startsWith("/")
        ? pathPart.replace(/^\\/+/, "")
        : resolveRelativePath(relativePath, pathPart);
      return rawFileHref(resolvedPath);
    }

    function slugifyHeading(value, seen) {
      let slug = String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^\u4e00-\u9fff\\w\\- ]+/g, "")
        .replace(/\\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      if (!slug) {
        slug = "section";
      }
      const count = seen[slug] || 0;
      seen[slug] = count + 1;
      return count ? slug + "-" + count : slug;
    }

    function renderInline(value) {
      let text = escapeHtml(value);
      text = text.replace(/!\\[([^\\]]*)\\]\\(([^)]+)\\)/g, (_, alt, href) => '<img alt="' + escapeHtml(alt) + '" src="' + escapeHtml(resolveInlineImageSrc(href)) + '">');
      text = text.replace(/\\\`([^\\\`]+)\\\`/g, "<code>$1</code>");
      text = text.replace(/\\*\\*([^*]+)\\*\\*/g, "<strong>$1</strong>");
      text = text.replace(/\\*([^*]+)\\*/g, "<em>$1</em>");
      text = text.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, (_, label, href) => '<a href="' + escapeHtml(resolvePreviewHref(href)) + '">' + label + '</a>');
      return text;
    }

    function mermaidConfig() {
      return {
        startOnLoad: false,
        securityLevel: "loose",
        theme: "default",
        fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", Helvetica, Arial, sans-serif',
      };
    }

    function ensureMermaid() {
      if (mermaidApi) {
        return Promise.resolve(mermaidApi);
      }
      if (window.mermaid) {
        mermaidApi = window.mermaid;
        mermaidApi.initialize(mermaidConfig());
        return Promise.resolve(mermaidApi);
      }
      if (mermaidLoadPromise) {
        return mermaidLoadPromise;
      }
      mermaidLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = mermaidScriptUrl;
        script.async = true;
        script.dataset.workspaceDocBrowserMermaid = "1";
        script.onload = () => {
          if (!window.mermaid) {
            reject(new Error("Mermaid script loaded, but Mermaid did not initialize."));
            return;
          }
          mermaidApi = window.mermaid;
          mermaidApi.initialize(mermaidConfig());
          resolve(mermaidApi);
        };
        script.onerror = () => reject(new Error("Failed to load Mermaid renderer."));
        document.head.appendChild(script);
      });
      return mermaidLoadPromise;
    }

    async function renderMermaidDiagrams() {
      const nodes = Array.from(content.querySelectorAll(".mermaid-diagram .mermaid"));
      if (!nodes.length) {
        return;
      }
      try {
        const mermaid = await ensureMermaid();
        await mermaid.run({ nodes });
      } catch {
        content.querySelectorAll(".mermaid-diagram").forEach((container) => {
          container.classList.add("mermaid-error");
        });
      }
    }

    function renderMarkdown(text) {
      const lines = String(text || "").replace(/\\r\\n/g, "\\n").split("\\n");
      const output = [];
      let paragraph = [];
      let listItems = [];
      let listType = "";
      let inCode = false;
      let codeLines = [];
      let codeLanguage = "";
      const headingIds = Object.create(null);

      function flushParagraph() {
        if (paragraph.length) {
          output.push("<p>" + renderInline(paragraph.join(" ")) + "</p>");
          paragraph = [];
        }
      }

      function flushList() {
        if (listItems.length) {
          output.push("<" + listType + ">" + listItems.join("") + "</" + listType + ">");
          listItems = [];
          listType = "";
        }
      }

      function flushCode() {
        if (inCode) {
          const codeText = codeLines.join("\\n");
          if (String(codeLanguage || "").toLowerCase() === "mermaid") {
            output.push('<div class="mermaid-diagram"><div class="mermaid">' + escapeHtml(codeText) + "</div></div>");
          } else {
            const languageClass = codeLanguage ? ' class=\\"language-' + escapeHtml(codeLanguage) + '\\"' : "";
            output.push("<pre><code" + languageClass + ">" + escapeHtml(codeText) + "</code></pre>");
          }
          inCode = false;
          codeLines = [];
          codeLanguage = "";
        }
      }

      function isHorizontalRule(line) {
        return /^\\s{0,3}([-*_])(\\s*\\1){2,}\\s*$/.test(line);
      }

      function isTableDivider(line) {
        return /^\\s*\\|?(\\s*:?-{3,}:?\\s*\\|)+\\s*:?-{3,}:?\\s*\\|?\\s*$/.test(line);
      }

      function parseTableRow(line) {
        const trimmed = String(line || "").trim().replace(/^\\|/, "").replace(/\\|$/, "");
        return trimmed.split("|").map((cell) => cell.trim());
      }

      function renderTable(headerCells, rows) {
        const headerHtml = "<tr>" + headerCells.map((cell) => "<th>" + renderInline(cell) + "</th>").join("") + "</tr>";
        const bodyHtml = rows.map((row) => "<tr>" + row.map((cell) => "<td>" + renderInline(cell) + "</td>").join("") + "</tr>").join("");
        return '<div class="table-wrap"><table><thead>' + headerHtml + "</thead><tbody>" + bodyHtml + "</tbody></table></div>";
      }

      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const nextLine = lines[index + 1] || "";
        const fence = line.match(/^\`\`\`\\s*([\\w-]+)?\\s*$/);
        if (fence) {
          flushParagraph();
          flushList();
          if (inCode) {
            flushCode();
          } else {
            inCode = true;
            codeLines = [];
            codeLanguage = fence[1] || "";
          }
          continue;
        }
        if (inCode) {
          codeLines.push(line);
          continue;
        }
        if (!line.trim()) {
          flushParagraph();
          flushList();
          continue;
        }
        if (line.includes("|") && isTableDivider(nextLine)) {
          flushParagraph();
          flushList();
          const headerCells = parseTableRow(line);
          const rows = [];
          index += 2;
          while (index < lines.length && lines[index].trim() && lines[index].includes("|")) {
            rows.push(parseTableRow(lines[index]));
            index += 1;
          }
          index -= 1;
          output.push(renderTable(headerCells, rows));
          continue;
        }
        if (isHorizontalRule(line)) {
          flushParagraph();
          flushList();
          output.push("<hr>");
          continue;
        }
        const heading = line.match(/^(#{1,6})\\s+(.*)$/);
        if (heading) {
          flushParagraph();
          flushList();
          const level = heading[1].length;
          const anchorId = slugifyHeading(heading[2], headingIds);
          output.push("<h" + level + " id=\\"" + escapeHtml(anchorId) + "\\">" + renderInline(heading[2]) + "</h" + level + ">");
          continue;
        }
        const quote = line.match(/^>\\s?(.*)$/);
        if (quote) {
          flushParagraph();
          flushList();
          output.push("<blockquote><p>" + renderInline(quote[1]) + "</p></blockquote>");
          continue;
        }
        const unordered = line.match(/^[-*]\\s+(.*)$/);
        if (unordered) {
          flushParagraph();
          if (listType && listType !== "ul") {
            flushList();
          }
          listType = "ul";
          listItems.push("<li>" + renderInline(unordered[1]) + "</li>");
          continue;
        }
        const ordered = line.match(/^\\d+\\.\\s+(.*)$/);
        if (ordered) {
          flushParagraph();
          if (listType && listType !== "ol") {
            flushList();
          }
          listType = "ol";
          listItems.push("<li>" + renderInline(ordered[1]) + "</li>");
          continue;
        }
        paragraph.push(line.trim());
      }

      flushParagraph();
      flushList();
      flushCode();
      return output.join("\\n");
    }

    function renderFileMeta() {
      const normalizedPath = String(relativePath || "").replace(/^\\/+|\\/+$/g, "");
      if (!normalizedPath) {
        return '<span>' + escapeHtml(workspaceName) + '</span>';
      }
      const segments = normalizedPath.split("/").filter(Boolean);
      const crumbParts = [];
      let accumulatedPath = "";
      segments.forEach((segment, index) => {
        accumulatedPath = accumulatedPath ? (accumulatedPath + "/" + segment) : segment;
        const isLast = index === segments.length - 1;
        const isDirectoryCrumb = !isLast || currentResourceKind === "directory";
        if (index > 0) {
          crumbParts.push('<span class="file-meta-separator">/</span>');
        }
        if (isDirectoryCrumb) {
          crumbParts.push('<a href="' + escapeHtml(previewHref(accumulatedPath, "directory")) + '">' + escapeHtml(segment) + '</a>');
          return;
        }
        crumbParts.push('<span>' + escapeHtml(segment) + '</span>');
      });
      return crumbParts.join("");
    }

    function renderContentFrame(bodyHtml) {
      return '<div class="content-shell"><div class="file-meta">' + renderFileMeta() + '</div><div class="markdown-body">' + bodyHtml + '</div></div>';
    }

    function renderTextFrame(text) {
      return '<div class="content-shell"><div class="file-meta">' + renderFileMeta() + '</div><div class="asset-body text-file-body"><pre><code>' + escapeHtml(text) + '</code></pre></div></div>';
    }

    function renderImageFrame() {
      const rawHref = rawFileHref(relativePath);
      const imageSrc = rawFileHref(relativePath, "", Date.now().toString());
      return '<div class="content-shell"><div class="file-meta">' + renderFileMeta() + '</div><div class="asset-body image-file-body"><div class="asset-image-stage"><img alt="' + escapeHtml(relativePath.split("/").pop() || relativePath) + '" src="' + escapeHtml(imageSrc) + '"></div><div class="asset-actions"><a class="asset-button" href="' + escapeHtml(rawHref) + '" target="_blank" rel="noreferrer">Open Raw Image</a></div></div></div>';
    }

    function renderVideoFrame() {
      const rawHref = rawFileHref(relativePath);
      const videoSrc = rawFileHref(relativePath, "", Date.now().toString());
      return '<div class="content-shell"><div class="file-meta">' + renderFileMeta() + '</div><div class="asset-body video-file-body"><div class="asset-video-stage"><video controls preload="metadata" src="' + escapeHtml(videoSrc) + '"></video></div><div class="asset-actions"><a class="asset-button" href="' + escapeHtml(rawHref) + '" target="_blank" rel="noreferrer">Open Raw Video</a></div></div></div>';
    }

    function renderHtmlFrame() {
      const rawHref = rawFileHref(relativePath, "", Date.now().toString());
      return '<div class="content-shell"><div class="file-meta">' + renderFileMeta() + '</div><div class="asset-body html-file-body"><div class="asset-html-stage"><iframe src="' + escapeHtml(rawHref) + '" loading="eager" referrerpolicy="no-referrer"></iframe></div><div class="asset-actions"><a class="asset-button" href="' + escapeHtml(rawHref) + '" target="_blank" rel="noreferrer">Open Raw HTML</a></div></div></div>';
    }

    function renderBinaryFrame() {
      const rawHref = rawFileHref(relativePath);
      return '<div class="content-shell"><div class="file-meta">' + renderFileMeta() + '</div><div class="markdown-body"><p class="empty-state">This file type is not rendered inline yet.</p><p><a class="asset-button" href="' + escapeHtml(rawHref) + '" target="_blank" rel="noreferrer">Open Raw File</a></p></div></div>';
    }

    function findDirectoryChildren(items, targetPath) {
      const normalizedTarget = String(targetPath || "").replace(/^\\/+|\\/+$/g, "");
      if (!normalizedTarget) {
        return Array.isArray(items) ? items : [];
      }
      const segments = normalizedTarget.split("/").filter(Boolean);
      let currentItems = Array.isArray(items) ? items : [];
      for (const segment of segments) {
        const nextItem = currentItems.find((item) => item.kind === "directory" && item.path && item.path.split("/").pop() === segment);
        if (!nextItem) {
          return [];
        }
        currentItems = Array.isArray(nextItem.children) ? nextItem.children : [];
      }
      return currentItems;
    }

    function findTreeEntryByPath(items, targetPath) {
      const normalizedTarget = String(targetPath || "").replace(/^\\/+|\\/+$/g, "");
      if (!normalizedTarget) {
        return null;
      }
      const queue = Array.isArray(items) ? items.slice() : [];
      while (queue.length) {
        const item = queue.shift();
        if (!item || typeof item !== "object") {
          continue;
        }
        if (item.kind === "directory" && String(item.path || "").replace(/^\\/+|\\/+$/g, "") === normalizedTarget) {
          return item;
        }
        if (item.kind !== "directory" && String(item.sourcePath || "").replace(/^\\/+|\\/+$/g, "") === normalizedTarget) {
          return item;
        }
        if (Array.isArray(item.children) && item.children.length) {
          queue.push(...item.children);
        }
      }
      return null;
    }

    function renderDirectoryCard(item) {
      const resourcePath = item.kind === "directory" ? (item.path || "") : (item.sourcePath || "");
      let href = rawFileHref(resourcePath);
      if (item.kind === "directory" || item.kind === "markdown" || item.kind === "html" || item.kind === "image" || item.kind === "video" || item.kind === "text") {
        href = previewHref(resourcePath, item.kind);
      }
      let thumb = '<div class="directory-card-thumb">📄</div>';
      if (item.kind === "directory") {
        thumb = '<div class="directory-card-thumb">📁</div>';
      } else if (item.kind === "image") {
        thumb = '<div class="directory-card-thumb"><img alt="" loading="lazy" src="' + escapeHtml(rawFileHref(resourcePath, "", resourcePath)) + '"></div>';
      } else if (item.kind === "video") {
        thumb = '<div class="directory-card-thumb">🎬</div>';
      } else if (item.kind === "html") {
        thumb = '<div class="directory-card-thumb">🌐</div>';
      } else if (item.kind === "markdown") {
        thumb = '<div class="directory-card-thumb">📝</div>';
      } else if (item.kind === "text") {
        thumb = '<div class="directory-card-thumb">📄</div>';
      }
      const metaLabel = item.kind === "directory" ? "Directory" : item.kind;
      return '<a class="directory-card" href="' + escapeHtml(href) + '">' + thumb + '<div class="directory-card-name">' + escapeHtml(item.title || resourcePath) + '</div><div class="directory-card-meta">' + escapeHtml(metaLabel) + '</div></a>';
    }

    function renderDirectoryFrame(items) {
      if (!items.length) {
        return '<div class="content-shell"><div class="file-meta">' + renderFileMeta() + '</div><div class="markdown-body"><p class="empty-state">This directory is empty.</p></div></div>';
      }
      return '<div class="content-shell"><div class="file-meta">' + renderFileMeta() + '</div><div class="asset-body"><div class="directory-grid">' + items.map((item) => renderDirectoryCard(item)).join("") + '</div></div></div>';
    }

    function setSidebarCollapsed(collapsed) {
      document.body.classList.toggle("sidebar-collapsed", Boolean(collapsed));
      if (sidebarToggle) {
        sidebarToggle.textContent = collapsed ? "▶" : "◀";
        sidebarToggle.setAttribute("aria-label", collapsed ? "Expand file tree" : "Collapse file tree");
        sidebarToggle.setAttribute("title", collapsed ? "Expand file tree" : "Collapse file tree");
      }
      try {
        window.localStorage.setItem(sidebarStateKey, collapsed ? "1" : "0");
      } catch {}
    }

    function restoreSidebarState() {
      try {
        return window.localStorage.getItem(sidebarStateKey) === "1";
      } catch {
        return false;
      }
    }

    function ensureHistoryEntryId() {
      if (scrollEntryId) {
        return scrollEntryId;
      }
      const currentState = window.history.state && typeof window.history.state === "object"
        ? window.history.state
        : {};
      if (currentState.workspaceDocBrowserEntryId) {
        scrollEntryId = String(currentState.workspaceDocBrowserEntryId);
        return scrollEntryId;
      }
      scrollEntryId = "entry-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
      try {
        window.history.replaceState({ ...currentState, workspaceDocBrowserEntryId: scrollEntryId }, "", window.location.href);
      } catch {}
      return scrollEntryId;
    }

    function getScrollStateStorage() {
      try {
        return window.sessionStorage;
      } catch {
        return null;
      }
    }

    function getScrollStateKey() {
      return scrollStateKeyPrefix + ensureHistoryEntryId();
    }

    function persistScrollPosition() {
      const storage = getScrollStateStorage();
      if (!storage) {
        return;
      }
      try {
        storage.setItem(getScrollStateKey(), JSON.stringify({
          x: window.scrollX || window.pageXOffset || 0,
          y: window.scrollY || window.pageYOffset || 0,
          path: window.location.pathname + window.location.search + window.location.hash,
        }));
      } catch {}
    }

    function scheduleScrollPositionSave() {
      if (scrollSaveFrame) {
        return;
      }
      scrollSaveFrame = window.requestAnimationFrame(() => {
        scrollSaveFrame = 0;
        persistScrollPosition();
      });
    }

    function loadSavedScrollPosition() {
      const storage = getScrollStateStorage();
      if (!storage) {
        return null;
      }
      try {
        const raw = storage.getItem(getScrollStateKey());
        if (!raw) {
          return null;
        }
        const parsed = JSON.parse(raw);
        if (!parsed || !Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) {
          return null;
        }
        return parsed;
      } catch {
        return null;
      }
    }

    function restoreSavedScrollPosition(attempts = 1) {
      const saved = loadSavedScrollPosition();
      if (!saved) {
        return false;
      }
      let remaining = Math.max(1, Number(attempts) || 1);
      const apply = () => {
        window.scrollTo(saved.x, saved.y);
        remaining -= 1;
        if (remaining > 0) {
          window.requestAnimationFrame(apply);
        }
      };
      apply();
      return true;
    }

    function scrollToCurrentHashTarget() {
      if (!window.location.hash) {
        return false;
      }
      const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (!target) {
        return false;
      }
      target.scrollIntoView();
      return true;
    }

    function captureOpenFolders() {
      openFolders.clear();
      document.querySelectorAll("details[data-path]").forEach((details) => {
        if (details.open) {
          openFolders.add(details.dataset.path);
        }
      });
    }

    function renderTreeItems(items) {
      return "<ul class=\\"tree\\">" + items.map((item) => {
        if (item.children && item.children.length) {
          const shouldOpen = (item.path && relativePath.startsWith(item.path + "/")) || openFolders.has(item.path);
          return "<li><details data-path=\\"" + escapeHtml(item.path || "") + "\\" " + (shouldOpen ? "open" : "") + "><summary>" + escapeHtml(item.title) + "</summary>" + renderTreeItems(item.children) + "</details></li>";
        }
        const active = currentResourceKind !== "directory" && item.sourcePath === relativePath ? " active" : "";
        let href = rawFileHref(item.sourcePath || "");
        if (item.kind === "markdown" || item.kind === "html" || item.kind === "image" || item.kind === "video" || item.kind === "text") {
          href = previewHref(item.sourcePath || "", item.kind);
        }
        const labelHtml = item.kind === "image"
          ? '<span class="tree-file"><span class="tree-thumb"><img alt="" loading="lazy" src="' + escapeHtml(rawFileHref(item.sourcePath || "", "", item.sourcePath || "")) + '"></span><span class="tree-label">' + escapeHtml(item.title) + "</span></span>"
          : '<span class="tree-file"><span class="tree-label">' + escapeHtml(item.title) + "</span></span>";
        return "<li><a class=\\"repo-link" + active + "\\" href=\\"" + escapeHtml(href) + "\\">" + labelHtml + "</a></li>";
      }).join("") + "</ul>";
    }

    async function loadTree() {
      captureOpenFolders();
      const response = await fetch("/__workspace_doc_browser__/tree", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }
      const tree = await response.json();
      const treeJson = JSON.stringify(tree);
      if (treeJson !== lastTreeJson) {
        lastTreeJson = treeJson;
        lastTreeData = Array.isArray(tree) ? tree : [];
        sidebarBody.innerHTML = renderTreeItems(tree);
        if (currentResourceKind === "markdown") {
          lastMarkdown = "";
        }
      }
    }

    async function loadCurrentFile() {
      const fileKind = currentResourceKind === "directory" ? "directory" : fileKindForPath(relativePath);
      if (fileKind === "directory") {
        if (!lastTreeJson) {
          await loadTree();
        }
        const directorySignature = "__directory__:" + relativePath + ":" + lastTreeJson;
        if (lastMarkdown !== directorySignature) {
          lastMarkdown = directorySignature;
          content.innerHTML = renderDirectoryFrame(findDirectoryChildren(lastTreeData, relativePath));
          restoreSavedScrollPosition(3);
        }
        return;
      }
      if (fileKind === "image") {
        if (lastMarkdown !== "__image__") {
          lastMarkdown = "__image__";
          content.innerHTML = renderImageFrame();
          restoreSavedScrollPosition(3);
        }
        return;
      }
      if (fileKind === "video") {
        if (lastMarkdown !== "__video__") {
          lastMarkdown = "__video__";
          content.innerHTML = renderVideoFrame();
          restoreSavedScrollPosition(3);
        }
        return;
      }
      if (fileKind === "html") {
        if (lastMarkdown !== "__html__") {
          lastMarkdown = "__html__";
          content.innerHTML = renderHtmlFrame();
          restoreSavedScrollPosition(3);
        }
        return;
      }
      if (fileKind === "file") {
        if (lastMarkdown !== "__binary__") {
          lastMarkdown = "__binary__";
          content.innerHTML = renderBinaryFrame();
          restoreSavedScrollPosition(3);
        }
        return;
      }
      const response = await fetch(rawFileHref(relativePath), { cache: "no-store" });
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }
      const text = await response.text();
      if (text !== lastMarkdown) {
        lastMarkdown = text;
        if (fileKind === "markdown") {
          content.innerHTML = renderContentFrame(renderMarkdown(text));
          await renderMermaidDiagrams();
          const restored = restoreSavedScrollPosition(5);
          if (!restored) {
            scrollToCurrentHashTarget();
          }
          return;
        }
        content.innerHTML = renderTextFrame(text);
        restoreSavedScrollPosition(3);
      }
    }

    async function refreshTree() {
      try {
        await loadTree();
      } catch {}
    }

    async function refreshFile() {
      try {
        await loadCurrentFile();
      } catch (error) {
        content.innerHTML = renderContentFrame('<p class="error-state">Unable to load file preview.</p><pre><code>' + escapeHtml(String(error)) + '</code></pre>');
      }
    }

    document.title = relativePath ? relativePath + " - " + workspaceName : workspaceName;
    ensureHistoryEntryId();
    try {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
    } catch {}
    window.addEventListener("scroll", scheduleScrollPositionSave, { passive: true });
    window.addEventListener("pagehide", persistScrollPosition);
    window.addEventListener("beforeunload", persistScrollPosition);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        persistScrollPosition();
      }
    });
    if (sidebarToggle) {
      sidebarToggle.addEventListener("click", () => {
        setSidebarCollapsed(!document.body.classList.contains("sidebar-collapsed"));
      });
    }
    setSidebarCollapsed(restoreSidebarState());
    refreshTree();
    refreshFile();
    setInterval(refreshTree, treeRefreshMs);
    setInterval(refreshFile, fileRefreshMs);
  </script>
</body>
</html>`;
}

function waitForPortReady(port, attempts = 40, delayMs = 150) {
  return new Promise((resolve, reject) => {
    let remaining = attempts;

    const tryConnect = () => {
      const socket = net.createConnection({ port, host: "127.0.0.1" });
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        remaining -= 1;
        if (remaining <= 0) {
          reject(new Error(`Timed out waiting for local docs server on port ${port}`));
        } else {
          setTimeout(tryConnect, delayMs);
        }
      });
    };

    tryConnect();
  });
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : null;
      server.close((error) => {
        if (error) {
          reject(error);
        } else if (port) {
          resolve(port);
        } else {
          reject(new Error("Failed to allocate a local preview port."));
        }
      });
    });
  });
}

function computeServerCodeStamp() {
  try {
    const contents = fs.readFileSync(__filename);
    return crypto.createHash("sha1").update(contents).digest("hex");
  } catch {
    return "unknown";
  }
}

function isPortReachable(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    const finish = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

function activate(context) {
  const browser = new WorkspaceDocBrowser(context);
  browser.activate();
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
