import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Module from "node:module";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const require = createRequire(import.meta.url);
const originalLoad = Module._load;

let workspaceFolders = [];
const vscodeMock = {
  window: {
    activeTextEditor: null,
    createOutputChannel() {
      return {
        appendLine() {},
        show() {},
      };
    },
  },
  workspace: {
    get workspaceFolders() {
      return workspaceFolders;
    },
    getWorkspaceFolder(uri) {
      return workspaceFolders.find((folder) => {
        const relative = path.relative(folder.uri.fsPath, uri.fsPath);
        return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
      }) || null;
    },
  },
};

Module._load = function loadPatched(request, parent, isMain) {
  if (request === "vscode") {
    return vscodeMock;
  }
  return originalLoad.call(this, request, parent, isMain);
};

try {
  const { WorkspaceDocBrowser } = require(path.join(repoRoot, "adapters", "vscode", "extension-runtime.js"));

  function createBrowser() {
    return new WorkspaceDocBrowser({
      globalState: {
        get() {},
        async update() {},
      },
    });
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "use-browser-priview-vscode-root-"));
  let homeLooseRoot = "";
  try {
    const projectRoot = path.join(tempRoot, "style-engine");
    const docsDir = path.join(projectRoot, "docs", "reference");
    const nestedWorkspace = path.join(projectRoot, "docs");
    const projectFile = path.join(docsDir, "chatgpt-sdxl-capability-boundary-and-validation-order.zh-CN.md");
    homeLooseRoot = fs.mkdtempSync(path.join(os.homedir(), ".use-browser-priview-root-contract-"));
    const homeLooseFile = path.join(homeLooseRoot, "notes", "note.md");

    fs.mkdirSync(path.join(projectRoot, ".git"), { recursive: true });
    fs.mkdirSync(docsDir, { recursive: true });
    fs.mkdirSync(path.dirname(homeLooseFile), { recursive: true });
    fs.writeFileSync(projectFile, "# project\n", "utf8");
    fs.writeFileSync(homeLooseFile, "# loose\n", "utf8");

    workspaceFolders = [];
    assert.equal(
      createBrowser().getWorkspaceRoot({ scheme: "file", fsPath: projectFile }),
      projectRoot,
      "Expected standalone file previews to use the nearest project root instead of the file directory.",
    );

    workspaceFolders = [{ uri: { fsPath: nestedWorkspace } }];
    assert.equal(
      createBrowser().getWorkspaceRoot({ scheme: "file", fsPath: projectFile }),
      projectRoot,
      "Expected nested VS Code workspace folders to still resolve to the project root.",
    );

    workspaceFolders = [];
    assert.equal(
      createBrowser().getWorkspaceRoot({ scheme: "file", fsPath: homeLooseFile }),
      os.homedir(),
      "Expected non-repo files under home to fall back up to the home directory instead of the file directory.",
    );
  } finally {
    if (homeLooseRoot) {
      fs.rmSync(homeLooseRoot, { recursive: true, force: true });
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
} finally {
  Module._load = originalLoad;
}

console.log("validate-vscode-workspace-root-contract: ok");
