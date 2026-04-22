# Preserve sidebar position during tree navigation

- Date: 2026-04-22
- Status: resolved

## Problem

The left navigation tree still felt jumpy during normal use. Even after the large-directory branch-loading fix, clicking a nearby file or directory in the sidebar could make the sidebar snap back toward the top because the tree re-rendered from scratch and the next page load did not remember the sidebar scroll position.

## Thinking

This was a user-facing interaction issue rather than a rendering-correctness issue. The preview already remembered main-page scroll state, but the sidebar had no equivalent persistence, so any tree refresh or cross-page navigation rebuilt the DOM without restoring sidebar scrollTop. Because tree refreshes still happen on an interval, preserving the sidebar position had to work both across page navigation and within the same page when the tree re-renders.

## Solution

Added sidebar scroll persistence keyed by workspace in sessionStorage, restored it after tree renders, and saved it before sidebar link navigation as well as during sidebar scrolling, pagehide, and visibility changes. Extended the browser-preview tests with a dedicated sidebar scroll restoration case and updated the usage and test-plan docs so the interaction contract is explicit.

## Validation

npm test; bash install.sh

## Follow-Ups

- If users still notice motion, the next step is to reduce unnecessary tree re-renders when signatures have not changed.

## Related Files

- packages/runtime/browser-preview.js, tests/validate-sidebar-scroll-restoration.mjs, docs/usage.md, docs/usage.zh-CN.md, docs/test-plan.md, docs/test-plan.zh-CN.md
