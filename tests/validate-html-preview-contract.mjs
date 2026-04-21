import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const extensionSource = fs.readFileSync(
  path.join(repoRoot, "adapters", "vscode", "extension.js"),
  "utf8",
);
const finderSource = fs.readFileSync(
  path.join(repoRoot, "adapters", "vscode", "open-finder-preview.js"),
  "utf8",
);

for (const source of [extensionSource, finderSource]) {
  assert(
    source.includes("return \"html\";"),
    "Expected HTML files to be classified as their own preview kind.",
  );
  assert(
    source.includes("kind === \"html\""),
    "Expected HTML files to stay on the inline preview route.",
  );
}

assert(
  extensionSource.includes("function renderHtmlFrame()"),
  "Expected the browser preview client to define an HTML renderer.",
);
assert(
  extensionSource.includes("<iframe src=\""),
  "Expected HTML preview to render through an iframe-backed page view.",
);
assert(
  extensionSource.includes('kind === "markdown" || kind === "html" || kind === "image" || kind === "video" || kind === "text"'),
  "Expected the preview server to route HTML files through the preview shell.",
);

console.log("validate-html-preview-contract: ok");
