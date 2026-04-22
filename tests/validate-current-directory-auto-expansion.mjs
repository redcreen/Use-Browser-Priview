import assert from "node:assert/strict";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");

const { buildBootstrapViewerHtml } = await import(path.join(repoRoot, "packages", "runtime", "browser-preview.js"));

const html = buildBootstrapViewerHtml(
  "style engine",
  "docs/architecture.zh-CN.md",
  "markdown",
  3000,
  1200,
);
const match = html.match(/<script>([\s\S]*)<\/script>/);
assert(match, "Expected bootstrap viewer HTML to include an inline script.");
const inlineScript = match[1];

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
const sidebarBody = {
  innerHTML: "",
  scrollTop: 0,
  addEventListener() {},
  querySelectorAll() {
    return [];
  },
};
const sidebarToggle = {
  textContent: "",
  setAttribute() {},
  addEventListener() {},
};
const bodyClassSet = new Set();

const responses = new Map([
  ["/__workspace_doc_browser__/tree", [
    { title: "docs/", kind: "directory", path: "docs", isSymlink: false, hasChildren: true },
    { title: "README.md", kind: "markdown", sourcePath: "README.md", isSymlink: false },
  ]],
  ["/__workspace_doc_browser__/tree?path=docs", [
    { title: "README.md", kind: "markdown", sourcePath: "docs/README.md", isSymlink: false },
    { title: "architecture.zh-CN.md", kind: "markdown", sourcePath: "docs/architecture.zh-CN.md", isSymlink: false },
    { title: "reference/", kind: "directory", path: "docs/reference", isSymlink: false, hasChildren: true },
  ]],
]);

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
      return { dataset: {} };
    },
    querySelectorAll() {
      return [];
    },
  },
  window: {
    location: {
      pathname: "/docs/architecture.zh-CN.md",
      search: "",
      hash: "",
      href: "http://127.0.0.1:65043/docs/architecture.zh-CN.md",
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
  },
  navigator: {
    sendBeacon() {
      return true;
    },
  },
  fetch: async (url) => {
    const key = String(url);
    if (responses.has(key)) {
      return {
        ok: true,
        async json() {
          return responses.get(key);
        },
      };
    }
    if (key.includes("/__workspace_doc_browser__/raw/docs/architecture.zh-CN.md")) {
      return {
        ok: true,
        async text() {
          return "# Architecture\n";
        },
      };
    }
    throw new Error(`Unexpected fetch ${key}`);
  },
  setTimeout(callback) {
    callback();
    return 1;
  },
  clearTimeout() {},
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

vm.runInNewContext(inlineScript, sandbox, { timeout: 4000 });
await new Promise((resolve) => setImmediate(resolve));
await new Promise((resolve) => setImmediate(resolve));

assert(
  sidebarBody.innerHTML.includes('<details data-path="docs" data-branch-only="0" open>'),
  "Expected the current file directory to auto-expand in the sidebar tree.",
);
assert(
  sidebarBody.innerHTML.includes('/docs/architecture.zh-CN.md'),
  "Expected the current file link to be present once its directory auto-expands.",
);

console.log("validate-current-directory-auto-expansion: ok");
