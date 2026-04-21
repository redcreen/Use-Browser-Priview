# Harden Codex app patch workflow

- Date: 2026-04-21
- Status: resolved

## Problem

The first Codex app patch approach could break Codex startup because it patched app.asar in place, matched unstable bundle anchors, and did not handle ElectronAsarIntegrity correctly.

## Thinking

A durable fix needed to separate menu injection from runtime behavior, validate patch placement on a cloned app bundle first, and understand the exact integrity check Electron performs on macOS before touching the installed app.

## Solution

Reworked adapters/codex-app/patch-codex-open-with.js to patch the real open-in-target registry, compute the ASAR header hash expected by ElectronAsarIntegrity, and install via staged app-bundle swap with a clean backup and rollback path.

## Validation

Validated startup on a cloned patched Codex.app, restored a broken local Codex.app from backup, and passed npm test after landing the hardened workflow.

## Follow-Ups

- Re-run bash install.sh --codex-app after future Codex updates and adjust only the open-target registry anchor if the bundle shape changes.

## Related Files

- adapters/codex-app/patch-codex-open-with.js
- .codex/codex-app-patch-playbook.md
- tests/validate-codex-app-patch.mjs
