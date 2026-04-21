import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const require = createRequire(import.meta.url);
const {
  getBackupAppPath,
  PATCH_MARKER,
  TARGET_ID,
  patchMainBundleSource,
} = require(path.join(repoRoot, "adapters", "codex-app", "patch-codex-open-with.js"));

function buildSyntheticMainBundle() {
  return [
    "var a={existsSync:()=>!0},Oo=async()=>{},e={kr:(name)=>name};",
    "var unrelated=[1,2,3],otherLogger=e.kr(`not-open-targets`);function other(e){return unrelated.flatMap(()=>[e])}",
    "var Cc={id:`vscode`},mc={id:`systemDefault`},js={id:`fileManager`},_c={id:`zed`};",
    "var Lc=[Cc,mc,js,_c],Rc=e.kr(`open-in-targets`);",
    "function zc(e){return Lc.flatMap(t=>{let n=t.platforms[e];return n?[{id:t.id,...n}]:[]})}",
  ].join("");
}

function testPatchSource() {
  const runtimeScriptPath = "/Users/redcreen/Library/Application Support/Use Browser Priview/codex-app/open-codex-preview.sh";
  const originalSource = buildSyntheticMainBundle();
  const patchedSource = patchMainBundleSource(originalSource, runtimeScriptPath);

  assert.notEqual(patchedSource, originalSource, "Expected main bundle patch to change the source.");
  assert(patchedSource.includes(PATCH_MARKER), "Expected patch marker to be injected.");
  assert(patchedSource.includes(`id:\`${TARGET_ID}\``), "Expected the Codex target id to be injected.");
  assert(patchedSource.includes(runtimeScriptPath), "Expected runtime script path to be embedded in the patch.");
  assert(
    patchedSource.includes("Lc=[Cc,mc,js,_c,useBrowserPriviewCodexOpenTarget]"),
    "Expected the Codex target to be appended to the open-target registry.",
  );
  assert(
    !patchedSource.includes("unrelated=[1,2,3,useBrowserPriviewCodexOpenTarget]"),
    "Did not expect the patch to latch onto an unrelated array.",
  );

  const patchedAgain = patchMainBundleSource(patchedSource, runtimeScriptPath);
  assert.equal(patchedAgain, patchedSource, "Expected patching to be idempotent.");
}

function createFakeCodexApp() {
  const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), "use-browser-priview-codex-app-"));
  const appRoot = path.join(sandboxRoot, "Codex.app");
  const contentsDir = path.join(appRoot, "Contents");
  const resourcesDir = path.join(appRoot, "Contents", "Resources");
  const extractedRoot = path.join(sandboxRoot, "asar-source");
  const mainBundleDir = path.join(extractedRoot, ".vite", "build");
  const supportDir = path.join(sandboxRoot, "support");
  const homeDir = path.join(sandboxRoot, "home");

  fs.mkdirSync(mainBundleDir, { recursive: true });
  fs.mkdirSync(resourcesDir, { recursive: true });
  fs.mkdirSync(homeDir, { recursive: true });
  fs.writeFileSync(path.join(mainBundleDir, "main-test.js"), buildSyntheticMainBundle(), "utf8");

  execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["--yes", "@electron/asar", "pack", extractedRoot, path.join(resourcesDir, "app.asar")],
    {
      cwd: repoRoot,
      stdio: "pipe",
    },
  );

  fs.writeFileSync(
    path.join(contentsDir, "Info.plist"),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>Codex</string>
  <key>ElectronAsarIntegrity</key>
  <dict>
    <key>Resources/app.asar</key>
    <dict>
      <key>algorithm</key>
      <string>SHA256</string>
      <key>hash</key>
      <string>placeholder</string>
    </dict>
  </dict>
</dict>
</plist>
`,
    "utf8",
  );

  return { sandboxRoot, appRoot, supportDir, homeDir, resourcesDir };
}

function extractMainBundle(asarPath, outputRoot) {
  execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["--yes", "@electron/asar", "extract", asarPath, outputRoot],
    {
      cwd: repoRoot,
      stdio: "pipe",
    },
  );

  const buildDir = path.join(outputRoot, ".vite", "build");
  const mainBundleName = fs.readdirSync(buildDir).find((name) => /^main-.*\.js$/.test(name));
  assert(mainBundleName, "Expected a main-*.js bundle after extracting app.asar.");
  return fs.readFileSync(path.join(buildDir, mainBundleName), "utf8");
}

function testInstallAndUninstall() {
  const sandbox = createFakeCodexApp();
  const env = {
    ...process.env,
    HOME: sandbox.homeDir,
    USE_BROWSER_PRIVIEW_SUPPORT_DIR: sandbox.supportDir,
    USE_BROWSER_PRIVIEW_CODEX_APP_PATH: sandbox.appRoot,
    USE_BROWSER_PRIVIEW_SKIP_CODE_SIGN: "1",
  };
  const backupAppPath = getBackupAppPath(sandbox.appRoot);

  try {
    const installOutput = execFileSync("bash", ["install.sh", "--codex-app"], {
      cwd: repoRoot,
      env,
      encoding: "utf8",
      stdio: "pipe",
    });

    assert(installOutput.includes("Patched Codex.app"), "Expected installer to patch the fake Codex app.");
    assert(
      fs.existsSync(path.join(sandbox.supportDir, "codex-app", "open-codex-preview.sh")),
      "Expected Codex runtime wrapper to be installed.",
    );
    assert(
      fs.existsSync(path.join(sandbox.supportDir, "codex-app", "open-finder-preview.js")),
      "Expected Codex runtime to reuse the preview runtime.",
    );
    assert(
      fs.existsSync(backupAppPath),
      "Expected installer to create a clean backup Codex app bundle.",
    );

    const patchedSource = extractMainBundle(
      path.join(sandbox.resourcesDir, "app.asar"),
      path.join(sandbox.sandboxRoot, "patched-extracted"),
    );
    assert(patchedSource.includes(PATCH_MARKER), "Expected installed app.asar to include the patch marker.");
    assert(patchedSource.includes(`id:\`${TARGET_ID}\``), "Expected installed app.asar to expose the target id.");

    const uninstallOutput = execFileSync("bash", ["adapters/codex-app/uninstall-codex-app.sh"], {
      cwd: repoRoot,
      env,
      encoding: "utf8",
      stdio: "pipe",
    });
    assert(uninstallOutput.includes("Restored Codex.app"), "Expected uninstall to restore the fake Codex app.");

    const restoredSource = extractMainBundle(
      path.join(sandbox.resourcesDir, "app.asar"),
      path.join(sandbox.sandboxRoot, "restored-extracted"),
    );
    assert.equal(restoredSource, buildSyntheticMainBundle(), "Expected uninstall to restore the original app bundle.");
    assert(
      !fs.existsSync(path.join(sandbox.supportDir, "codex-app")),
      "Expected uninstall to remove the installed Codex runtime directory.",
    );
    assert(!fs.existsSync(backupAppPath), "Expected uninstall to restore the backup bundle and remove the backup path.");
  } finally {
    fs.rmSync(sandbox.sandboxRoot, { recursive: true, force: true });
  }
}

testPatchSource();
testInstallAndUninstall();

console.log("validate-codex-app-patch: ok");
