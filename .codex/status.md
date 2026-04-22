# Project Status

## Delivery Tier
- Tier: `medium`
- Why this tier: multi-session maintenance needs a lightweight but durable control surface
- Last reviewed: 2026-04-22

## Current Phase

Standalone baseline closeout and first tagged release.

## Active Slice

standalone baseline release closeout

## Current Execution Line

- Objective: close Stage 1, converge release-facing docs, and cut the first standalone tag from this repo
- Plan Link: standalone baseline release closeout
- Runway: one release closeout pass
- Progress: 3 / 3 tasks complete
- Stop Conditions:
  - blocker requires human direction
  - validation fails and changes the direction
  - business, compatibility, or cost decision requires user judgment

## Execution Tasks

- [x] EL-1 converge release-facing docs, governance paths, and install surfaces
- [x] EL-2 validate repo, installer, and Codex patch gates for release
- [x] EL-3 tag the standalone baseline release from this repo

## Development Log Capture
- Trigger Level: high
- Pending Capture: no
- Reason: latest devlog already captures the most recent durable reasoning
- Last Entry: `docs/devlog/2026-04-22-support-safe-text-sizes-inside-markdown-tables.md`

## Architecture Supervision
- Signal: `green`
- Signal Basis: install surfaces, rollback paths, release docs, validation gates, and same-root port reuse rules are now encoded in repo files rather than left to ad-hoc session memory
- Root Cause Hypothesis: future host updates can still change bundle shape, and preview runtime changes can accidentally allocate a new port for the same project root if this rule is not enforced explicitly
- Correct Layer: adapter isolation, staged app-bundle swap, durable docs, release validation, and shared session governance
- Automatic Review Trigger: no automatic trigger is currently active
- Escalation Gate: continue automatically

## Current Escalation State
- Current Gate: continue automatically
- Reason: the current release line stays inside the agreed product boundary and no user-level tradeoff is open
- Next Review Trigger: review again when a host update changes install, runtime, or release-facing behavior materially

## Done

- standalone repo created
- first runnable adapter code moved into the repo
- Codex app patch playbook captured in [.codex/codex-app-patch-playbook.md](codex-app-patch-playbook.md)
- release governance, version surface, and release docs aligned with the standalone repo

## In Progress

shared runtime extraction planning
same-project-root port preservation across runtime upgrades

## Blockers / Open Decisions

None.

## Next 3 Actions
1. Preserve the same preview port for the same project root even when the runtime code changes.
2. Start shared runtime extraction without regressing the current release baseline.
3. Keep Codex / Finder / VS Code install paths green after host updates.
