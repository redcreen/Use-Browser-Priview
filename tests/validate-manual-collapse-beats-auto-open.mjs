import assert from "node:assert/strict";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");

const { buildBootstrapViewerHtml } = await import(path.join(repoRoot, "packages", "runtime", "browser-preview.js"));

const html = buildBootstrapViewerHtml(
  "style engine",
  "docs/reference/page.md",
  "markdown",
  3000,
  1200,
);
const match = html.match(/<script>([\s\S]*)<\/script>/);
assert(match, "Expected bootstrap viewer HTML to include an inline script.");
const inlineScript = match[1];

function makeStorage(initialValues = {}) {
  const data = new Map(Object.entries(initialValues));
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

function createParsedSidebarState() {
  return {
    details: [],
    links: [],
  };
}

function createSidebarBody() {
  const parsedState = createParsedSidebarState();
  let htmlValue = "";
  let scrollTopValue = 240;

  function createListenerStore() {
    return new Map();
  }

  function addListener(store, type, callback) {
    if (!store.has(type)) {
      store.set(type, []);
    }
    store.get(type).push(callback);
  }

  function parseHtml(nextHtml) {
    parsedState.details = [];
    parsedState.links = [];
    const detailPattern = /<details data-path="([^"]+)" data-branch-only="([^"]+)"\s*(open)?><summary class="([^"]*)"><a class="tree-directory-link" href="([^"]+)">([^<]+)<\/a><\/summary>/g;
    let matchResult;
    while ((matchResult = detailPattern.exec(nextHtml)) !== null) {
      const listeners = createListenerStore();
      const summaryListeners = createListenerStore();
      const summary = {
        dataset: {},
        addEventListener(type, callback) {
          addListener(summaryListeners, type, callback);
        },
        dispatchClick() {
          const event = {
            defaultPrevented: false,
            preventDefault() {
              this.defaultPrevented = true;
            },
            stopPropagation() {},
            target: {
              closest() {
                return null;
              },
            },
          };
          for (const callback of summaryListeners.get("click") || []) {
            callback(event);
          }
          return event;
        },
      };
      const link = {
        href: matchResult[5],
        dataset: {},
        addEventListener() {},
      };
      const details = {
        dataset: {
          path: matchResult[1],
          branchOnly: matchResult[2],
          userToggleIntent: "0",
        },
        open: Boolean(matchResult[3]),
        addEventListener(type, callback) {
          addListener(listeners, type, callback);
        },
        querySelector(selector) {
          return selector === "summary" ? summary : null;
        },
        dispatchToggle() {
          for (const callback of listeners.get("toggle") || []) {
            callback();
          }
        },
      };
      parsedState.details.push(details);
      parsedState.links.push(link);
    }
  }

  return {
    clientHeight: 400,
    scrollHeight: 2000,
    addEventListener() {},
    get innerHTML() {
      return htmlValue;
    },
    set innerHTML(value) {
      htmlValue = String(value);
      parseHtml(htmlValue);
    },
    get scrollTop() {
      return scrollTopValue;
    },
    set scrollTop(value) {
      scrollTopValue = Math.max(0, Number(value) || 0);
    },
    querySelectorAll(selector) {
      if (selector === "details[data-path]") {
        return parsedState.details;
      }
      if (selector === ".tree-directory-link") {
        return parsedState.links;
      }
      if (selector === ".repo-link") {
        return [];
      }
      return [];
    },
    getDetailsByPath(targetPath) {
      return parsedState.details.find((details) => details.dataset.path === targetPath) || null;
    },
  };
}

function toggleDetails(details) {
  assert(details, "Expected details node to exist.");
  const event = details.querySelector("summary").dispatchClick();
  if (!event.defaultPrevented) {
    details.open = !details.open;
    details.dispatchToggle();
  }
}

const content = {
  innerHTML: '<p class="empty-state">Loading markdown preview…</p>',
  querySelectorAll() {
    return [];
  },
};
const sidebarBody = createSidebarBody();
const sidebarToggle = {
  textContent: "",
  setAttribute() {},
  addEventListener() {},
};
const bodyClassSet = new Set();

const responses = new Map([
  ["/__workspace_doc_browser__/tree", [
    { title: "docs/", kind: "directory", path: "docs", isSymlink: false, hasChildren: true },
    { title: "workspace/", kind: "directory", path: "workspace", isSymlink: false, hasChildren: true },
  ]],
  ["/__workspace_doc_browser__/tree?path=docs&mode=branch&focusChild=docs%2Freference", [
    { title: "reference/", kind: "directory", path: "docs/reference", isSymlink: false, hasChildren: true },
  ]],
  ["/__workspace_doc_browser__/tree?path=docs%2Freference", [
    { title: "page.md", kind: "markdown", sourcePath: "docs/reference/page.md", isSymlink: false },
  ]],
  ["/__workspace_doc_browser__/tree?path=workspace", [
    { title: "demo.md", kind: "markdown", sourcePath: "workspace/demo.md", isSymlink: false },
  ]],
]);

const sandbox = {
  console,
  document: {
    title: "",
    visibilityState: "visible",
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
      pathname: "/docs/reference/page.md",
      search: "",
      hash: "",
      href: "http://127.0.0.1:65043/docs/reference/page.md",
    },
    history: {
      state: {},
      replaceState(state) {
        this.state = state;
      },
      scrollRestoration: "auto",
    },
    localStorage: makeStorage(),
    sessionStorage: makeStorage({
      "workspace-doc-browser.sidebar-scroll:style engine": "240",
    }),
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
    if (key.includes("/__workspace_doc_browser__/raw/docs/reference/page.md")) {
      return {
        ok: true,
        async text() {
          return "# Page\n";
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

const docsDetails = sidebarBody.getDetailsByPath("docs");
assert(docsDetails && docsDetails.open, "Expected the current branch ancestor directory to auto-open before manual interaction.");

toggleDetails(docsDetails);
assert.equal(docsDetails.open, false, "Expected the user to be able to collapse the current branch directory.");

const workspaceDetails = sidebarBody.getDetailsByPath("workspace");
toggleDetails(workspaceDetails);
await new Promise((resolve) => setImmediate(resolve));
await new Promise((resolve) => setImmediate(resolve));

const rerenderedDocsDetails = sidebarBody.getDetailsByPath("docs");
const rerenderedWorkspaceDetails = sidebarBody.getDetailsByPath("workspace");
assert(rerenderedDocsDetails, "Expected docs directory to still exist after rerender.");
assert(rerenderedWorkspaceDetails, "Expected workspace directory to still exist after rerender.");
assert.equal(
  rerenderedDocsDetails.open,
  false,
  "Expected a user-collapsed current-branch directory to stay closed after another directory expansion rerenders the tree.",
);
assert.equal(
  rerenderedWorkspaceDetails.open,
  true,
  "Expected the newly expanded sibling directory to stay open after rerender.",
);
assert.equal(
  sidebarBody.scrollTop,
  240,
  "Expected rerendering after sibling expansion to preserve the sidebar scroll position.",
);

console.log("validate-manual-collapse-beats-auto-open: ok");
