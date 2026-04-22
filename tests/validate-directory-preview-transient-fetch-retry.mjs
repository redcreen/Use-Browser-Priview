import assert from "node:assert/strict";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");

const { buildBootstrapViewerHtml } = await import(path.join(repoRoot, "packages", "runtime", "browser-preview.js"));

const html = buildBootstrapViewerHtml(
  "style engine",
  "workspace/sytle-images/xiaohongshu/keyword",
  "directory",
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
const attempts = new Map();

function getAttempt(key) {
  const next = (attempts.get(key) || 0) + 1;
  attempts.set(key, next);
  return next;
}

const responses = new Map([
  ["/__workspace_doc_browser__/tree", [{ title: "workspace/", kind: "directory", path: "workspace", isSymlink: false, hasChildren: true }]],
  ["/__workspace_doc_browser__/tree?path=workspace&mode=branch&focusChild=workspace%2Fsytle-images", [{ title: "sytle-images/", kind: "directory", path: "workspace/sytle-images", isSymlink: false, hasChildren: true }]],
  ["/__workspace_doc_browser__/tree?path=workspace%2Fsytle-images&mode=branch&focusChild=workspace%2Fsytle-images%2Fxiaohongshu", [{ title: "xiaohongshu/", kind: "directory", path: "workspace/sytle-images/xiaohongshu", isSymlink: false, hasChildren: true }]],
  ["/__workspace_doc_browser__/tree?path=workspace%2Fsytle-images%2Fxiaohongshu&mode=branch&focusChild=workspace%2Fsytle-images%2Fxiaohongshu%2Fkeyword", [{ title: "keyword/", kind: "directory", path: "workspace/sytle-images/xiaohongshu/keyword", isSymlink: false, hasChildren: true }]],
  ["/__workspace_doc_browser__/tree?path=workspace%2Fsytle-images%2Fxiaohongshu%2Fkeyword", [
    { title: "宋锦/", kind: "directory", path: "workspace/sytle-images/xiaohongshu/keyword/宋锦", isSymlink: false, hasChildren: true },
    { title: "端午/", kind: "directory", path: "workspace/sytle-images/xiaohongshu/keyword/端午", isSymlink: false, hasChildren: true },
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
      pathname: "/workspace/sytle-images/xiaohongshu/keyword/",
      search: "",
      hash: "",
      href: "http://127.0.0.1:65043/workspace/sytle-images/xiaohongshu/keyword/",
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
    if (!responses.has(key)) {
      throw new Error(`Unexpected fetch ${key}`);
    }
    if (key === "/__workspace_doc_browser__/tree?path=workspace%2Fsytle-images%2Fxiaohongshu%2Fkeyword" && getAttempt(key) === 1) {
      throw new TypeError("Failed to fetch");
    }
    return {
      ok: true,
      async json() {
        return responses.get(key);
      },
    };
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

assert.equal(
  attempts.get("/__workspace_doc_browser__/tree?path=workspace%2Fsytle-images%2Fxiaohongshu%2Fkeyword"),
  2,
  "Expected the directory tree loader to retry once after a transient fetch failure.",
);
assert(
  content.innerHTML.includes("宋锦/") && content.innerHTML.includes("端午/"),
  "Expected directory preview to recover and render directory cards after a transient fetch failure.",
);
assert(
  !content.innerHTML.includes("Unable to load file preview"),
  "Expected transient fetch failures to recover without rendering a fatal preview error.",
);
assert(
  sidebarBody.innerHTML.includes("tree-directory-link"),
  "Expected expandable directories in the sidebar tree to render as clickable links.",
);
assert(
  sidebarBody.innerHTML.includes("/workspace/sytle-images/xiaohongshu/keyword/%E7%AB%AF%E5%8D%88/"),
  "Expected directory entries like 端午/ to expose a navigable preview URL in the sidebar tree.",
);
assert(
  html.includes(".tree .repo-link {"),
  "Expected tree file links to use the dedicated repo-link selector instead of styling every tree anchor.",
);
assert(
  html.includes("display: inline;") && html.includes(".tree-directory-link"),
  "Expected directory links inside summary rows to stay inline so the disclosure marker and label align.",
);

console.log("validate-directory-preview-transient-fetch-retry: ok");
