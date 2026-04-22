import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const runtimeSource = fs.readFileSync(path.join(repoRoot, "packages", "runtime", "browser-preview.js"), "utf8");

assert(runtimeSource.includes("safeTextSizeClassMap"), "Expected safe text size whitelist to be defined in the preview runtime.");
assert(runtimeSource.includes("\\[\\[size:(sm|base|lg|xl|2xl)\\|"), "Expected inline safe text size syntax to be recognized.");
assert(runtimeSource.includes("^:::size-(sm|base|lg|xl|2xl)\\s*$"), "Expected block safe text size syntax to be recognized.");
assert(runtimeSource.includes("markdown-size-inline"), "Expected inline safe text size class to be rendered.");
assert(runtimeSource.includes("markdown-size-block"), "Expected block safe text size class to be rendered.");
assert(runtimeSource.includes("markdown-size-2xl"), "Expected 2xl safe text size class to be supported.");
assert(runtimeSource.includes("protectSafeTextSizeTokens"), "Expected table parsing to preserve safe text-size tokens before splitting columns.");
assert(runtimeSource.includes("@@UBP_SAFE_TABLE_SIZE_"), "Expected table-safe placeholders to protect safe text-size syntax inside table rows.");
assert(runtimeSource.includes("restoreSafeTextSizeTokens"), "Expected table parsing to restore safe text-size tokens after splitting columns.");

console.log("validate-safe-text-size-contract: ok");
