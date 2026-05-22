# Hosted Baseline Preflight Evidence

Date: 2026-05-22

## Purpose

This slice turns the hosted Supermemory comparison blocker into a runnable,
safe contract. It does not call hosted Supermemory by default. It verifies that
benchmark claims stay blocked until a fresh metrics-only hosted baseline, a
matched RecallWeave run, and two independent reviewer approvals exist.

## Files Added Or Updated

- `packages/bench/hosted-baseline-preflight.mjs`
- `package.json`
- `packages/bench/release-readiness-check.mjs`
- `reviews/overnight-20260522/release-state.json`
- `reviews/overnight-20260522/hosted-baseline-preflight-evidence.md`
- `reviews/overnight-20260522/gemini-hosted-baseline-preflight-review.md`

## Local Command

```sh
node packages/bench/hosted-baseline-preflight.mjs
```

Result:

- `ok: true`
- `mode: hosted-baseline-preflight`
- `writesRealFiles: false`
- `callsHostedProvider: false`
- `metricsOnly: true`
- `releaseBlockerPresent: true`
- `hostedBaselineFresh: false`
- `benchmarkClaimsAllowed: false`
- `publicBenchmarkClaimsAllowed: false`

## Safety Contract

- Credential values are never printed.
- Hosted write-back is not permitted.
- Raw memories, raw transcripts, raw prompts, raw answers, credentials, cookies,
  and bearer tokens are forbidden in baseline outputs.
- A live run requires explicit environment opt-in and `RECALLWEAVE_BASELINE_NO_RAW_TEXT=1`.
- Public benchmark claims remain blocked unless a metrics-only hosted baseline,
  matched RecallWeave run, RecallWeave win, and two reviewer approvals are all
  present.

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

## Boundary

This is a preflight and release gate, not a live hosted benchmark. The blocker
`hosted-supermemory-baseline-not-current` remains valid until a sanitized live
result is reviewed.
