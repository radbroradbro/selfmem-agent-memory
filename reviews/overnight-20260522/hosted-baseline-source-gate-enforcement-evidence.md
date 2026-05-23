# Hosted Baseline Source-Gate Enforcement Evidence

Generated: 2026-05-23T14:04:54Z

## Scope

Extended the hosted Supermemory versus RecallWeave baseline lane so a matching
label is not enough to spend hosted calls. The operator packet, state-aware
next-run planner, and one-command baseline runner now require both:

- `baseline:source-match`, proving the reviewed query labels are collectable
  from the selected local RecallWeave source.
- `baseline:source-align`, proving the hosted label and local container map
  align and `matchedBaselineRunAllowed` is true.

## Code Paths

- `packages/bench/hosted-baseline-run.mjs`
- `packages/bench/hosted-baseline-next-run.mjs`
- `packages/bench/hosted-baseline-operator-packet.mjs`
- `packages/bench/release-blocker-doctor.mjs`
- `packages/bench/release-readiness-check.mjs`
- `docs/RELEASE_HANDOFF.md`
- `docs/AGENT_LIVE_BUILD_GUIDE.md`
- `docs/BENCHMARK_SUMMARY.md`
- `docs/AUTORESEARCH_BENCHMARK_PLAN.md`
- `reviews/overnight-20260522/release-state.json`

## Verification

All checks passed:

- `node --check` on changed benchmark scripts.
- `baseline:operator-packet`.
- `baseline:next-run -- --format markdown`.
- `baseline:run -- --fixture`.
- `consumer:smoke`.
- `release:doctor`.
- `goal:audit`.
- `release:check`.
- `test`: 22 passed.
- `smoke`.
- `git diff --check`.
- Changed-diff key pattern scan: zero hits.

## Observed Gate Behavior

`baseline:run -- --fixture` now reports 11 steps. The new steps run before
hosted collection:

- `preflight-local-source-match`
- `preflight-source-alignment`

The fixture evidence reports:

- `sourceMatch.sourceMatchReady: true`
- `sourceAlignment.matchedBaselineRunAllowed: true`
- `publicBenchmarkClaimsAllowed: false`

Live mode now requires:

- `--local-map` or `RECALLWEAVE_BASELINE_LOCAL_MAP`
- `--private-map` or `RECALLWEAVE_BASELINE_PRIVATE_MAP`

The operator packet and next-run planner include
`preflight-source-alignment`, include `/tmp/recallweave-baseline-source-alignment.json`
in attach-only lists, and continue to forbid private container maps, private env
files, private query sets, credentials, raw memories, transcripts, prompts, and
answers.

## Review

Gemini CLI reviewed the public-safe diff payload with a read-only prompt:

```text
CLEAN
```

