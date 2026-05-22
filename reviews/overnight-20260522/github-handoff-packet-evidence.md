# GitHub Handoff Packet Evidence

Date: 2026-05-22

## Scope

The GitHub connector can read PR #5, but it cannot update the PR body, add a
top-level PR status comment, or create the blocker issue. This slice adds a
generated, public-safe handoff packet so a maintainer or agent can copy the
right PR body, status comment, issue title, issue body, labels, and manual
steps without reconstructing the release state from scattered notes.

## Implementation

- Added `packages/bench/github-handoff-packet.mjs`.
- Added `release:handoff` to `package.json`.
- Added `github-handoff-packet` to `release-state.json` proven surfaces.
- Updated `packages/bench/release-readiness-check.mjs` so the release gate now
  requires the handoff packet script, evidence, Gemini review, package script,
  release-state surface, and a fresh packet run.
- Updated the packet so the status comment points maintainers to
  `baseline:preflight` before any hosted Supermemory comparison claim.

## Fresh Blocked Routes

- Claude Opus review later completed with `CONCERNS`; this handoff now treats
  that review as alpha-PR evidence only.
- PR body update after current head returned GitHub 403:
  `Resource not accessible by integration`.
- Top-level PR status comment after current head returned the same GitHub 403.
- Blocker issue creation after current head returned the same GitHub 403.

## Packet Verification

`node packages/bench/github-handoff-packet.mjs` prints JSON with:

- `ok: true`
- `mode: "github-handoff-packet"`
- `writesRealFiles: false`
- repository `radbroradbro/selfmem-agent-memory`
- PR number `5`
- public launch blocked
- production readiness false
- latest verified code baseline `02b3a13`
- CI run `26309563159`
- PR body from `pr-body-update-draft.md`
- status comment text
- blocker issue title and body
- release labels
- manual GitHub steps
- `privateLeakCount: 0`
- `hasSecretPattern: false`
- fixture-only safety boundary
- hosted baseline preflight reminder in the status comment

The packet does not call GitHub, write files, include provider keys, include raw
memories, include raw transcripts, include diagnostics zips, or expose private
agent data.

## Outcome

The slice does not remove the GitHub blocker. It makes the manual handoff
auditable and repeatable while keeping `publicLaunchVerdict: "FAIL"` and
`productionReady: false`.

## Review And Local Verification

- Gemini focused review returned `CLEAN`.
- `node packages/bench/github-handoff-packet.mjs`: passed.
- `node packages/bench/release-readiness-check.mjs`: passed and requires the
  handoff packet plus Gemini review.
- `npm exec --yes pnpm@10.23.0 -- test`: passed, 6 files and 22 tests.
- `npm exec --yes pnpm@10.23.0 -- smoke`: passed.
- `git diff --check`: passed.
- GitHub Actions CI run `26308475033` passed on `6a33e62`, including Test,
  Full smoke, and Release readiness check.
- GitHub Actions CI run `26308588261` passed on `8efe4d0`, including Test,
  Full smoke, and Release readiness check after the handoff packet gate was
  made dynamic.
- GitHub Actions CI run `26309563159` passed on `02b3a13`, including Test,
  Full smoke, and Release readiness check after the hosted baseline preflight
  reminder was added to the handoff packet.
