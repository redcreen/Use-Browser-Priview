import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");

const { buildBootstrapViewerHtml } = await import(path.join(repoRoot, "packages", "runtime", "browser-preview.js"));

const markdownPath = path.join(
  repoRoot,
  "..",
  "style engine",
  "workspace",
  "sytle-images",
  "xiaohongshu",
  "keyword",
  "端午",
  "search-results.images.md",
);
const markdownText = fs.readFileSync(markdownPath, "utf8");

const html = buildBootstrapViewerHtml(
  "style engine",
  "workspace/sytle-images/xiaohongshu/keyword/端午/search-results.images.md",
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
const sidebarBody = { innerHTML: "" };
const sidebarToggle = {
  textContent: "",
  setAttribute() {},
  addEventListener() {},
};
const bodyClassSet = new Set();

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
      pathname: "/workspace/sytle-images/xiaohongshu/keyword/端午/search-results.images.md",
      search: "",
      hash: "",
      href: "http://127.0.0.1:65043/workspace/sytle-images/xiaohongshu/keyword/%E7%AB%AF%E5%8D%88/search-results.images.md",
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
    if (String(url).startsWith("/__workspace_doc_browser__/tree")) {
      return {
        ok: true,
        async json() {
          return [];
        },
      };
    }
    if (String(url).includes("/__workspace_doc_browser__/raw/workspace/sytle-images/xiaohongshu/keyword/%E7%AB%AF%E5%8D%88/search-results.images.md")) {
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

vm.runInNewContext(inlineScript, sandbox, { timeout: 4000 });
await new Promise((resolve) => setImmediate(resolve));
await new Promise((resolve) => setImmediate(resolve));

assert(
  !content.innerHTML.includes("@@UBP_SAFE_TABLE_SIZE_"),
  "Expected table-safe size placeholders to be restored before rendering.",
);
assert(
  !content.innerHTML.includes("@@UBP_SAFE_TEXT_SIZE_"),
  "Expected inline safe-size placeholders to be restored before rendering.",
);
assert(
  content.innerHTML.includes("markdown-size-inline markdown-size-sm"),
  "Expected image table metadata rows to render with the safe small-text class.",
);
assert(
  content.innerHTML.includes("3.4w赞·2101藏·V"),
  "Expected image table metadata text to be visible after rendering.",
);

console.log("validate-image-table-safe-text-size-rendering: ok");
