# Hosted Baseline Preflight Evidence

Date: 2026-05-22

## Purpose

This slice turns the hosted Supermemory comparison blocker into a runnable,
safe contract. It does not call hosted Supermemory by default. It verifies that
benchmark claims stay blocked until a fresh metrics-only hosted baseline, a
matched RecallWeave run, and two independent reviewer approvals exist.

This extension adds a fixture/template route so agents can test the exact
result shape before using a hosted key. The fixture proves parser coverage but
is rejected as real baseline evidence.

## Files Added Or Updated

- `packages/bench/hosted-baseline-preflight.mjs`
- `packages/bench/hosted-baseline-operator-packet.mjs`
- `packages/bench/fixtures/hosted-baseline-result.fixture.json`
- `package.json`
- `packages/bench/release-readiness-check.mjs`
- `packages/bench/release-blocker-doctor.mjs`
- `docs/BENCHMARK_SUMMARY.md`
- `docs/AUTORESEARCH_BENCHMARK_PLAN.md`
- `docs/RELEASE_HANDOFF.md`
- `reviews/overnight-20260522/release-state.json`
- `reviews/overnight-20260522/hosted-baseline-preflight-evidence.md`
- `reviews/overnight-20260522/hosted-baseline-operator-packet-evidence.md`
- `reviews/overnight-20260522/gemini-hosted-baseline-preflight-review.md`

## Local Command

```sh
node packages/bench/hosted-baseline-preflight.mjs
node packages/bench/hosted-baseline-preflight.mjs --fixture
node packages/bench/hosted-baseline-preflight.mjs --print-template
node packages/bench/hosted-baseline-operator-packet.mjs
node packages/bench/hosted-baseline-operator-packet.mjs --format markdown
```

Result:

- `ok: true`
- `mode: hosted-baseline-preflight`
- `writesRealFiles: false`
- `callsHostedProvider: false`
- `metricsOnly: true`
- `releaseBlockerPresent: true`
- `hostedBaselineFresh: false`
- `countsAsHostedBaselineEvidence: false`
- `benchmarkClaimsAllowed: false`
- `publicBenchmarkClaimsAllowed: false`

Fixture result:

- `resultInspection.fixtureOnly: true`
- `resultInspection.failedResultChecks: ["not-fixture"]`
- `resultInspection.countsAsHostedBaselineEvidence: false`
- `benchmarkClaimsAllowed: false`

Template result:

- `resultTemplateIncluded: true`
- template includes provider, run id, source commit, dataset slice,
  query-set hash, scoring-code hash, model ids, privacy counters, aggregate
  metrics, and cost fields.

Operator packet result:

- `mode: hosted-baseline-operator-packet`
- `writesRealFiles: false`
- `callsHostedProvider: false`
- attach-only paths are metrics-only `/tmp` JSON files.
- forbidden artifacts include provider keys, raw hosted memories, raw local
  memories, transcripts, prompts, answers, cookies, bearer tokens, private local
  paths, and unredacted diagnostic archives.

## Safety Contract

- Credential values are never printed.
- Hosted write-back is not permitted.
- Raw memories, raw transcripts, raw prompts, raw answers, credentials, cookies,
  and bearer tokens are forbidden in baseline outputs.
- A live run requires explicit environment opt-in and `RECALLWEAVE_BASELINE_NO_RAW_TEXT=1`.
- Public benchmark claims remain blocked unless a metrics-only hosted baseline,
  matched RecallWeave run, RecallWeave win, and two reviewer approvals are all
  present.
- Fixtures and templates can validate shape only. They cannot satisfy the
  hosted-baseline blocker.

## Live Baseline Inputs

Required live-run inputs are recorded as names only:

- `RECALLWEAVE_BASELINE_LIVE`
- `SUPERMEMORY_API_KEY`
- `RECALLWEAVE_BASELINE_CONTAINER`
- `RECALLWEAVE_BASELINE_QUERYSET`
- `RECALLWEAVE_BASELINE_RUN_ID`
- `RECALLWEAVE_BASELINE_JUDGE_MODEL`
- `RECALLWEAVE_BASELINE_ANSWER_MODEL`
- `RECALLWEAVE_BASELINE_OUTPUT_JSON`
- `RECALLWEAVE_BASELINE_NO_RAW_TEXT`

## Required Metrics

- accuracy or benchmark-native quality
- P@1
- recall@5
- recall@10
- NDCG@10 when available
- latency p50
- latency p95
- context tokens
- ingest cost
- query cost
- redaction failure count

## Required Result Checks

- not a fixture
- hosted Supermemory provider label
- metrics-only output
- zero privacy leaks and redaction failures
- no raw memory, transcript, prompt, or answer text
- same harness, dataset, judge, and answer model
- run id, source commit, dataset slice, query-set hash, and scoring-code hash
- cost and latency fields
- at least one quality or retrieval metric
- fresh collection window

## Boundary

This is a preflight and release gate, not a live hosted benchmark. The blocker
`hosted-supermemory-baseline-not-current` remains valid until a sanitized live
result is reviewed.

The `baseline:preflight -- --fixture` path is now part of full smoke so this
guard cannot silently regress.

The `baseline:operator-packet` path is also part of full smoke. It exists so
agents can send one clear hosted-baseline handoff without inventing ad hoc
instructions or leaking keys.

## Current Local Verification

- `npm exec --yes pnpm@10.23.0 -- test`: 6 files, 22 tests passed.
- `npm exec --yes pnpm@10.23.0 -- smoke`: passed, including the new
  `baseline:preflight` and `baseline:preflight -- --fixture` smoke steps.
- `node packages/bench/release-readiness-check.mjs`: passed.
- `node packages/bench/goal-completion-audit.mjs`: passed with
  `goalComplete: false` and the hosted-baseline blocker preserved.
- `git diff --check`: clean.
- Added-line secret scan: zero hits.

## Prior CI

GitHub Actions CI run `26309563159` passed on `02b3a13`, including Test, Full
smoke, and Release readiness check for the earlier hosted-baseline preflight
slice. For the current branch head, use the live PR checks as the authoritative
CI state because every evidence-only commit creates a new workflow run.
