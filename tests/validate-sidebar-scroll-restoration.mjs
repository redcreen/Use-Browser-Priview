import assert from "node:assert/strict";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");

const { buildBootstrapViewerHtml } = await import(path.join(repoRoot, "packages", "runtime", "browser-preview.js"));

const html = buildBootstrapViewerHtml(
  "style engine",
  "workspace/README.md",
  "markdown",
  3000,
  1200,
);
const match = html.match(/<script>([\s\S]*)<\/script>/);
assert(match, "Expected bootstrap viewer HTML to include an inline script.");
const inlineScript = match[1];

function makeStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
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
let sidebarScrollTop = 0;
const sidebarBody = {
  innerHTML: "",
  clientHeight: 200,
  scrollHeight: 200,
  set scrollTop(value) {
    const maxScrollTop = Math.max(0, this.scrollHeight - this.clientHeight);
    sidebarScrollTop = Math.max(0, Math.min(Number(value) || 0, maxScrollTop));
  },
  get scrollTop() {
    return sidebarScrollTop;
  },
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

const sessionStorage = makeStorage({
  "workspace-doc-browser.sidebar-scroll:style engine": "180",
});
const intervalCallbacks = [];
let workspaceTreeVersion = 0;

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
      pathname: "/workspace/README.md",
      search: "",
      hash: "",
      href: "http://127.0.0.1:65043/workspace/README.md",
    },
    history: {
      state: {},
      replaceState(state) {
        this.state = state;
      },
      scrollRestoration: "auto",
    },
    localStorage: makeStorage(),
    sessionStorage,
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
    if (String(url) === "/__workspace_doc_browser__/tree") {
      return {
        ok: true,
        async json() {
          return [
            { title: "workspace/", kind: "directory", path: "workspace", isSymlink: false, hasChildren: true },
          ];
        },
      };
    }
    if (String(url) === "/__workspace_doc_browser__/tree?path=workspace") {
      return {
        ok: true,
        async json() {
          const items = [
            { title: "README.md", kind: "markdown", sourcePath: "workspace/README.md", isSymlink: false },
          ];
          if (workspaceTreeVersion > 0) {
            items.push({ title: "Guide.md", kind: "markdown", sourcePath: "workspace/Guide.md", isSymlink: false });
          }
          return items;
        },
      };
    }
    if (String(url).includes("/__workspace_doc_browser__/raw/workspace/README.md")) {
      return {
        ok: true,
        async text() {
          return "# Test\n";
        },
      };
    }
    throw new Error(`Unexpected fetch ${String(url)}`);
  },
  setInterval(callback) {
    intervalCallbacks.push(callback);
    return intervalCallbacks.length;
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

assert.equal(
  sidebarBody.scrollTop,
  0,
  "Expected the first sidebar restore attempt to clamp to the top when the tree is still too short.",
);

workspaceTreeVersion = 1;
sidebarBody.scrollHeight = 500;
await intervalCallbacks[0]();
await new Promise((resolve) => setImmediate(resolve));

assert.equal(
  sidebarBody.scrollTop,
  180,
  "Expected the sidebar tree to retry its saved scroll position after later tree renders make that offset reachable.",
);
assert(
  inlineScript.includes("workspace-doc-browser.sidebar-scroll:"),
  "Expected the runtime to persist sidebar scroll state for cross-page navigation.",
);
assert(
  inlineScript.includes("sidebarScrollRestoreTarget"),
  "Expected the runtime to preserve a pending sidebar scroll target until later tree renders can apply it.",
);

console.log("validate-sidebar-scroll-restoration: ok");
