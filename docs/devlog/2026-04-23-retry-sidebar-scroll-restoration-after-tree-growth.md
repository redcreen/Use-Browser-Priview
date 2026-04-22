# Retry sidebar scroll restoration after tree growth

- Date: 2026-04-23
- Status: resolved

## Problem

Sidebar navigation was better after saving sidebar scrollTop, but long trees could still jump back to the top after clicking a nearby item. The first restore attempt happened before the rebuilt tree was tall enough, so the browser clamped the scroll position to zero and later renders no longer retried the original target.

## Thinking

This was a timing bug, not a missing-persistence bug. The sidebar needed to remember a pending target position until a later tree render made that offset reachable. Without that extra state, once the browser clamped the first restore to zero, the runtime treated zero as the latest truth and lost the user intended position.

## Solution

Added a durable sidebarScrollRestoreTarget in the preview runtime, updated sidebar persistence to keep that target alive across renders, and taught renderTree to reuse the pending target until a later render can actually reach it. Strengthened the sidebar scroll restoration test so it simulates an initial clamp to zero and verifies that a later tree refresh restores the saved position once the sidebar grows.

## Validation

npm test; bash install.sh

## Follow-Ups

- If the sidebar still feels jumpy after this, the next step is to preserve the clicked path itself and reconcile it against the rendered tree in addition to raw scrollTop.

## Related Files

- packages/runtime/browser-preview.js, tests/validate-sidebar-scroll-restoration.mjs, docs/usage.md, docs/usage.zh-CN.md, docs/test-plan.md, docs/test-plan.zh-CN.md
