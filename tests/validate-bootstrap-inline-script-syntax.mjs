import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const { buildBootstrapViewerHtml } = await import(path.join(repoRoot, "packages", "runtime", "browser-preview.js"));

const html = buildBootstrapViewerHtml(
  "style engine",
  "docs/reference/style-engine/stage1-feasibility-and-clustering-spec.zh-CN.md",
  "markdown",
  3000,
  1200,
);

const match = html.match(/<script>([\s\S]*)<\/script>/);
assert(match, "Expected bootstrap viewer HTML to include an inline script.");

const inlineScript = match[1];
assert(
  inlineScript.includes(String.raw`/\[\[size:(sm|base|lg|xl|2xl)\|([\s\S]+?)\]\]/gi`),
  "Expected generated inline script to preserve the safe text-size regex.",
);
assert(
  inlineScript.includes(String.raw`/^:::size-(sm|base|lg|xl|2xl)\s*$/i`),
  "Expected generated inline script to preserve the size-block regex.",
);

const tempFile = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "use-browser-priview-inline-script-")),
  "inline-script.js",
);
fs.writeFileSync(tempFile, inlineScript, "utf8");

const syntaxCheck = spawnSync(process.execPath, ["--check", tempFile], { encoding: "utf8" });
assert.equal(
  syntaxCheck.status,
  0,
  `Expected generated inline script to parse, got:\n${syntaxCheck.stderr || syntaxCheck.stdout}`,
);

const markdownText = fs.readFileSync(
  path.join(
    repoRoot,
    "..",
    "style engine",
    "docs",
    "reference",
    "style-engine",
    "stage1-feasibility-and-clustering-spec.zh-CN.md",
  ),
  "utf8",
);

function makeStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

const content = {
  innerHTML: '<p class="empty-state">Loading markdown preview…</p>',
  querySelectorAll() {
    return [];
  },
};
const sidebarBody = { innerHTML: "" };
const sidebarToggle = {
  textContent: "",
  setAttribute() {},
  addEventListener() {},
};
const bodyClassSet = new Set();
const windowObject = {
  mermaid: null,
  location: {
    pathname: "/docs/reference/style-engine/stage1-feasibility-and-clustering-spec.zh-CN.md",
    search: "",
    hash: "",
    href: "http://127.0.0.1:65043/docs/reference/style-engine/stage1-feasibility-and-clustering-spec.zh-CN.md",
  },
  history: {
    state: {},
    replaceState(state) {
      this.state = state;
    },
    scrollRestoration: "auto",
  },
  localStorage: makeStorage(),
  sessionStorage: makeStorage(),
  requestAnimationFrame(callback) {
    callback();
    return 1;
  },
  addEventListener() {},
  scrollTo() {},
  scrollX: 0,
  scrollY: 0,
  pageXOffset: 0,
  pageYOffset: 0,
};

const sandbox = {
  console,
  document: {
    title: "",
    head: { appendChild() {} },
    body: {
      classList: {
        toggle(name, force) {
          if (force) {
            bodyClassSet.add(name);
          } else {
            bodyClassSet.delete(name);
          }
        },
        contains(name) {
          return bodyClassSet.has(name);
        },
      },
    },
    getElementById(id) {
      return {
        content,
        sidebar: {},
        "sidebar-body": sidebarBody,
        "sidebar-toggle": sidebarToggle,
      }[id] || null;
    },
    addEventListener() {},
    createElement() {
      return {
        dataset: {},
        set src(value) {
          this._src = value;
        },
        set async(value) {
          this._async = value;
        },
      };
    },
    querySelectorAll() {
      return [];
    },
  },
  window: windowObject,
  fetch: async (url) => {
    if (url === "/__workspace_doc_browser__/tree") {
      return {
        ok: true,
        async json() {
          return [];
        },
      };
    }
    if (String(url).includes("/__workspace_doc_browser__/raw/docs/reference/style-engine/stage1-feasibility-and-clustering-spec.zh-CN.md")) {
      return {
        ok: true,
        async text() {
          return markdownText;
        },
      };
    }
    throw new Error(`Unexpected fetch ${String(url)}`);
  },
  setInterval() {
    return 1;
  },
  clearInterval() {},
  URL,
  encodeURIComponent,
  decodeURIComponent,
  Set,
  Map,
  Date,
  Math,
};

vm.runInNewContext(inlineScript, sandbox, { timeout: 2000 });
await new Promise((resolve) => setImmediate(resolve));
await new Promise((resolve) => setImmediate(resolve));

assert(
  content.innerHTML.includes("第一阶段技术可行性与视觉风格聚类规范"),
  "Expected inline script execution to render markdown content into the preview shell.",
);
assert(
  !content.innerHTML.includes("Loading markdown preview"),
  "Expected inline script execution to replace the loading placeholder.",
);

console.log("validate-bootstrap-inline-script-syntax: ok");
