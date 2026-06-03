# Returned Downloads Classification Baseline Refresh

Date: 2026-05-25

Verdict: baseline refreshed, launch still blocked.

## Scope

- Commit: `f2feec90880e87481fbd05ca70ff272cd6f2fb92`
- GitHub Actions run: `26378580702`
- Change: returned canary inbox/downloads classification now uses sanitized zip
  entry basenames for evidence detection while keeping raw zip entry paths out
  of public output.

## Local Verification

- `node --check packages/bench/canary-returned-inbox.mjs`
- `node --check packages/bench/canary-returned-downloads.mjs`
- `git diff --check`
- `pnpm canary:returned-downloads:strict`: expected failure with 0 production
  evidence packets, 1 handoff packet, 10 diagnostics, 22 unknown packets, and
  0 unreadable packets.
- `pnpm release:check`: passed.
- `pnpm goal:audit`: passed and kept `goalComplete: false`.
- `pnpm release:github-sync`: passed after PR #5 and issue #6 were refreshed.

## Safety

- No raw memory text, transcripts, diagnostics, private paths, provider keys, or
  credentials were printed or committed.
- Handoff packets, diagnostic bundles, and unknown zips still do not count as
  production canary evidence.
- The approved runtime canary adapter/report commit remains
  `18d606aff589986b4d8b416a686bedb7ff1506d2`.

## Remaining Blockers

- Human approval is still required before merge, visibility change, or public
  release messaging.
- One real-container production canary packet is still missing.
