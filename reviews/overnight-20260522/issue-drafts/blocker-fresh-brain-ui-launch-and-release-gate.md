# Blocking Issue Draft: Final Release Gate And Reviewer Approval

## Summary

The post-12-hour readiness gate should remain blocked until final reviewer
routes and human approval are complete. A later controller run and GitHub CI
proved the fresh Brain UI and `release:check` path can pass, but the release
should still remain conservative until the blocked reviewer routes are resolved
or explicitly accepted.

## Evidence

- `npm run build`: passed.
- `npm run test`: passed, 6 files and 22 tests.
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
- GitHub Actions CI run `26288370812` on `2888f91`: passed, including Test,
  Full smoke, and Release readiness check.
- GitHub Actions CI run `26289073223` on `dd17f44`: passed after the
  conservative release-state guard review became required.
- GitHub Actions CI run `26292137539` on `3b5e140`: passed after the guarded
  selected lifecycle policy apply slice became required.
- GitHub Actions CI run `26292772262` on `19f2577`: passed after the guarded
  selected review queue apply slice became required.
- GitHub Actions CI run `26293533847` on `72ab902`: passed after the guarded
  selected local memory edit overlay slice became required.
- GitHub Actions CI run `26294323086` on `b5352a0`: passed after the guarded
  local edit overlay browse slice became required.
- GitHub Actions CI run `26295772356` on `21fd4d6`: passed after the guarded
  local memory materialize slice became required.
- GitHub Actions CI run `26297064340` on `be47cff`: passed after the dynamic
  Brain UI graph layout slice became required. Fixture browser evidence reports
  `dynamic-graph-layout`, 9 nodes, 9 edges, 2 columns, 5 rows, zero overlaps,
  zero console errors, and no private/key-shaped visible text.
- GitHub Actions CI run `26297876735` on `62367a1`: passed after the graph
  navigation controls slice became required. Fixture browser evidence reports
  neighborhood scope, 3 visible fixture nodes, 9 jump options, selected-node
  visibility, zero console errors, and no private/key-shaped visible text.
- GitHub Actions CI run `26305284384` on `13cbe8d`: passed after the May 2026
  model/autoresearch matrix gate was added. The gate keeps Apple Silicon local
  setup, cloud provider challengers, and query expansion behind controlled
  canary evidence and env-only credentials.
- GitHub issue creation from this draft was attempted and blocked by GitHub app
  permissions. See `reviews/overnight-20260522/github-issue-create-blocked.md`.
- GitHub issue creation from this draft was retried after `13cbe8d` and was
  still blocked by the same 403.
- A top-level PR status comment was also attempted after CI run #44 and was
  blocked by the same GitHub integration permissions.

## Blocker

The initial cron run could not produce fresh localhost UI launch evidence.
Later controller and CI evidence closed that specific gap. Remaining blockers
are final reviewer availability, human approval, alpha limitations around real
local-container mode, and a public release note that does not overclaim.

## Acceptance Criteria

- Fresh `brain:serve` or `brain:smoke` passes on localhost with fixture data.
- Browser or Playwright evidence covers search, graph/index navigation,
  dynamic graph layout, graph navigation controls, provenance, lifecycle/retrieval trace, derived doc edit, save/cancel behavior,
  Nucleus snapshot preview, research lineage, wiki/vault preview, sync conflict
  view, selected local-container browse, selected local memory edit overlay,
  local edit overlay browse visibility, selected local memory materialize,
  selected vault sync dry-run, selected vault sync apply, lifecycle policy
  preview, selected lifecycle policy apply, memory review queue preview, and
  selected review queue apply.
- `npm run release:check` passes without special private machine state or CI
  passes the same release-readiness gate.
- Reviewer packet records Claude and Gemini as either completed with verdicts or
  explicitly blocked with reasons.
- Public evidence contains only fixture data and no raw memories, transcripts,
  diagnostics, credentials, agent logs, or private paths.
