# Release Handoff Evidence

Date: 2026-05-22

Scope: add a public-safe handoff page for the blocked launch path and require it
in the release gate.

## What Changed

- Added `docs/RELEASE_HANDOFF.md`.
- Linked the handoff from `README.md`.
- Added the handoff to the public release checklist and production-readiness
  evidence requirements.
- Added operations guidance for GitHub permission blockers.
- Updated `packages/bench/release-readiness-check.mjs` so the gate requires the
  handoff page and checks for the manual PR update path, blocker issue draft,
  blocked Claude route, conservative public verdict, `selfmem_update`, and
  one-agent canary language.

## Why This Matters

The repo can have green code checks while still being unapproved for public
launch. The handoff keeps those states separate:

- code checks pass,
- fixture UI evidence exists,
- reviewer route remains blocked,
- human approval remains required,
- public launch verdict remains `FAIL`.

This prevents a downstream agent from treating a passing release gate as owner
approval to publish, merge, or roll out broadly.

## Verification

- `npm exec --yes pnpm@10.23.0 -- release:check`: passed.
- `npm exec --yes pnpm@10.23.0 -- smoke`: passed.
- `npm run test`: passed, 6 files and 22 tests.
- `git diff --check`: passed.
- Private-name sweep over the public tree: no hits.
- Gemini release handoff review: `CLEAN`.
- GitHub Actions CI run `26298339106` on commit `aebd205`: passed Test, Full
  smoke, and Release readiness check.

The new evidence is docs and release-gate logic only. It does not include raw
memories, raw transcripts, credentials, private diagnostics, private agent
paths, or hosted Supermemory content.
