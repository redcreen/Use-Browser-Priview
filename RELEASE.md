# Release Process

[English](RELEASE.md) | [中文](RELEASE.zh-CN.md)

## Purpose

This repo ships as a standalone local product. A release should leave behind:

- a tagged version
- matching repo / adapter versions
- green local validation
- install docs that point to the released tag

## Patch Release

1. Make sure the working tree is clean.
2. Run `npm test`.
3. Run `python3 ~/.codex/skills/project-assistant/scripts/validate_gate_set.py "<repo>" --profile release`.
4. Update:
   `VERSION`
   `package.json`
   `adapters/vscode/package.json`
   `install.sh`
   release-tag install examples in `README.md` and `README.zh-CN.md`
5. Commit with `chore: release vX.Y.Z`.
6. Create tag `vX.Y.Z`.
7. Push the commit and the tag.

## Current Release Baseline

- current version file: `0.0.3`
- current release tag target: `v0.0.3`
- remote install examples should use `https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/v0.0.3/install.sh`

## Validation Notes

- local repo installs can still run from the checked-out workspace
- remote installer validation must confirm the tagged installer no longer falls back to `master`
- Codex app patch releases should keep the staged bundle swap and clean backup path intact
