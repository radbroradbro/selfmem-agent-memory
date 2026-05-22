# Blocking Issue Draft: Final Release Gate And Reviewer Approval

## Summary

The post-12-hour readiness gate should remain blocked until final reviewer
routes and human approval are complete. A later controller run and GitHub CI
proved the fresh Brain UI and `release:check` path can pass, but the release
should still remain conservative until the blocked reviewer routes are resolved
or explicitly accepted.

## Evidence

- `npm run build`: passed.
- `npm run test`: passed, 5 files and 18 tests.
- `npm run typecheck`: passed.
- `npm run privacy:test`: passed.
- `npm run smoke:openclaw`: passed with `privacyLeakCount: 0`.
- `npm run smoke:hermes`: passed with `privacyLeakCount: 0`.
- `npm run compaction:smoke:built`: passed.
- `npm run compaction:benchmark:built`: passed, 5 of 5 scenarios and
  `privacyLeakCount: 0`.
- `npm run wiki:smoke:built`: passed.
- `npm run wiki:sync:smoke:built`: passed with conflict handling and dry-run
  coverage.
- `npm run update:smoke`: passed for Hermes and OpenClaw fixture runtimes.
- `git diff --check`: passed.
- Core package `npm pack --dry-run`: passed when npm used a writable temporary
  cache.
- Initial cron `npm run release:check`: failed because the fresh Brain UI smoke
  could not bind to localhost in that sandbox.
- Controller follow-up: `pnpm brain:smoke` and `pnpm release:check` passed.
- GitHub Actions `Verify` run #43 on `9e6554c`: passed, including Test, Full smoke, and
  Release readiness check.
- GitHub issue creation from this draft was attempted and blocked by GitHub app
  permissions. See `reviews/overnight-20260522/github-issue-create-blocked.md`.

## Blocker

The initial cron run could not produce fresh localhost UI launch evidence.
Later controller and CI evidence closed that specific gap. Remaining blockers
are final reviewer availability, human approval, alpha limitations around real
local-container mode, and a public release note that does not overclaim.

## Acceptance Criteria

- Fresh `brain:serve` or `brain:smoke` passes on localhost with fixture data.
- Browser or Playwright evidence covers search, graph/index navigation,
  provenance, lifecycle/retrieval trace, derived doc edit, save/cancel behavior,
  Nucleus snapshot preview, research lineage, wiki/vault preview, and sync
  conflict view.
- `npm run release:check` passes without special private machine state or CI
  passes the same release-readiness gate.
- Reviewer packet records Claude and Gemini as either completed with verdicts or
  explicitly blocked with reasons.
- Public evidence contains only fixture data and no raw memories, transcripts,
  diagnostics, credentials, agent logs, or private paths.
