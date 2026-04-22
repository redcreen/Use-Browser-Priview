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

for (const fragment of [
  "function decodeHtmlEntities(value) {",
  '.replace(/&lt;/g, "<")',
  '.replace(/&gt;/g, ">")',
  '.replace(/&amp;/g, "&")',
  "function normalizeMarkdownHref(value) {",
  'decoded.startsWith("<") && decoded.endsWith(">")',
  "const raw = normalizeMarkdownHref(href);",
]) {
  assert(
    runtimeSource.includes(fragment),
    `Expected markdown href normalization fragment in browser-preview.js: ${fragment}`,
  );
}

assert(
  runtimeSource.includes("function resolvePreviewHref(href)") &&
    runtimeSource.includes("function resolveInlineImageSrc(href)"),
  "Expected both link and image href resolvers to exist.",
);

console.log("validate-markdown-link-href-normalization-contract: ok");
