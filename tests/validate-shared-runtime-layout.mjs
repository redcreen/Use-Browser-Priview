import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");

const vscodeBridgeSource = fs.readFileSync(
  path.join(repoRoot, "adapters", "vscode", "extension-runtime.js"),
  "utf8",
);
const finderLauncherSource = fs.readFileSync(
  path.join(repoRoot, "adapters", "vscode", "open-finder-preview.js"),
  "utf8",
);
const sharedRuntimeSource = fs.readFileSync(
  path.join(repoRoot, "packages", "runtime", "browser-preview.js"),
  "utf8",
);

assert(
  vscodeBridgeSource.includes('resolveSharedRuntimePath("browser-preview.js")') &&
    vscodeBridgeSource.includes('resolveSharedRuntimePath("session-store.js")') &&
    vscodeBridgeSource.includes('resolveSharedRuntimePath("preview-supervisor.js")'),
  "Expected the VS Code bridge to load the shared runtime, session store, and preview supervisor through runtime-paths.js.",
);

assert(
  finderLauncherSource.includes('resolveSharedRuntimePath("browser-preview.js")') &&
    finderLauncherSource.includes('resolveSharedRuntimePath("runtime-loader.js")') &&
    finderLauncherSource.includes('resolveSharedRuntimePath("session-store.js")') &&
    finderLauncherSource.includes('resolveSharedRuntimePath("preview-supervisor.js")'),
  "Expected the Finder launcher to resolve all shared runtime modules, including the preview supervisor, through runtime-paths.js.",
);

assert(
  sharedRuntimeSource.includes("function buildRawFileServerScript(") &&
    sharedRuntimeSource.includes("function buildBootstrapViewerHtml(") &&
    sharedRuntimeSource.includes("function findWorkspaceRoot("),
  "Expected packages/runtime/browser-preview.js to own the shared preview runtime primitives.",
);

console.log("validate-shared-runtime-layout: ok");
