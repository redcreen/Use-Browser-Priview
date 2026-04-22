import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const runtimeSource = fs.readFileSync(
  path.join(repoRoot, "packages", "runtime", "browser-preview.js"),
  "utf8",
);
const finderSource = fs.readFileSync(
  path.join(repoRoot, "adapters", "vscode", "open-finder-preview.js"),
  "utf8",
);

for (const source of [runtimeSource, finderSource]) {
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
  runtimeSource.includes("function renderHtmlFrame()"),
  "Expected the shared browser preview runtime to define an HTML renderer.",
);
assert(
  runtimeSource.includes("<iframe src=\""),
  "Expected HTML preview to render through an iframe-backed page view.",
);
assert(
  runtimeSource.includes('kind === "markdown" || kind === "html" || kind === "image" || kind === "video" || kind === "text"'),
  "Expected the preview server to route HTML files through the preview shell.",
);

console.log("validate-html-preview-contract: ok");
