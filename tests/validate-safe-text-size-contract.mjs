import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const extensionSource = fs.readFileSync(path.join(repoRoot, "adapters", "vscode", "extension.js"), "utf8");

assert(extensionSource.includes("safeTextSizeClassMap"), "Expected safe text size whitelist to be defined in the preview renderer.");
assert(extensionSource.includes("\\[\\[size:(sm|base|lg|xl|2xl)\\|"), "Expected inline safe text size syntax to be recognized.");
assert(extensionSource.includes("^:::size-(sm|base|lg|xl|2xl)\\s*$"), "Expected block safe text size syntax to be recognized.");
assert(extensionSource.includes("markdown-size-inline"), "Expected inline safe text size class to be rendered.");
assert(extensionSource.includes("markdown-size-block"), "Expected block safe text size class to be rendered.");
assert(extensionSource.includes("markdown-size-2xl"), "Expected 2xl safe text size class to be supported.");
assert(extensionSource.includes("protectSafeTextSizeTokens"), "Expected table parsing to preserve safe text-size tokens before splitting columns.");
assert(extensionSource.includes("@@UBP_SAFE_TABLE_SIZE_"), "Expected table-safe placeholders to protect safe text-size syntax inside table rows.");
assert(extensionSource.includes("restoreSafeTextSizeTokens"), "Expected table parsing to restore safe text-size tokens after splitting columns.");

console.log("validate-safe-text-size-contract: ok");
