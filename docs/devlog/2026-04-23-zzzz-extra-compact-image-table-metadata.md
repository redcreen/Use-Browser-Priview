# 2026-04-23 Extra-Compact Image Table Metadata

## Summary

- tightened the dedicated image-grid metadata-row style beyond the global `sm` token so thumbnail stats under `search-results.images.md` render visibly smaller
- kept the change scoped to image-grid metadata rows instead of shrinking all `[[size:sm|...]]` content again
- updated usage docs to clarify that image-grid stat rows get an even tighter no-wrap treatment

## Verification

- `npm test`
- `bash install.sh`
- reattached `/Users/redcreen/Project/style engine` to the live preview session on port `65043`
