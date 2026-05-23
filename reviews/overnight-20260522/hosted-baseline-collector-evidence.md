# Hosted Baseline Collector Evidence

Date: 2026-05-23

Scope:

- Added `packages/bench/hosted-baseline-collector.mjs`.
- Added fixture query and response files for CI-safe collection tests.
- Added `baseline:collect` as the metrics-only hosted baseline collection
  command.
- Gemini focused review returned `CLEAN`.

Source-locked API surface:

- Supermemory documentation checked on 2026-05-23 shows read search through
  `POST https://api.supermemory.ai/v4/search`.
- Requests use Bearer authentication, `containerTag`, `q`, `searchMode:
  hybrid`, `limit`, threshold, and optional rerank.
- The collector uses that read-only search surface only when `--live` or
  `RECALLWEAVE_BASELINE_LIVE=1` is set.

Commands:

```bash
npm exec --yes pnpm@10.23.0 -- baseline:collect -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:collect -- --fixture --output /tmp/recallweave-hosted-baseline-result.json
npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --result /tmp/recallweave-hosted-baseline-result.json
```

Live command shape:

```bash
RECALLWEAVE_BASELINE_LIVE=1 \
RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 \
RECALLWEAVE_BASELINE_CONTAINER=<hosted-container-label> \
RECALLWEAVE_BASELINE_QUERYSET=<source-locked-queryset-path> \
RECALLWEAVE_BASELINE_RUN_ID=<unique-run-id> \
RECALLWEAVE_BASELINE_JUDGE_MODEL=<judge-model> \
RECALLWEAVE_BASELINE_ANSWER_MODEL=<answer-model> \
RECALLWEAVE_BASELINE_OUTPUT_JSON=/tmp/recallweave-hosted-baseline-result.json \
npm exec --yes pnpm@10.23.0 -- baseline:collect -- --live --output /tmp/recallweave-hosted-baseline-result.json
```

Expected behavior:

- Fixture mode calls no hosted provider.
- Live mode fails closed unless `RECALLWEAVE_BASELINE_LIVE=1`,
  `RECALLWEAVE_BASELINE_NO_RAW_TEXT=1`, `SUPERMEMORY_API_KEY`, container,
  query set, run id, judge model, and answer model are present.
- Output is aggregate metrics and hashes only.
- Output includes query-set hash, scoring-code hash, latency p50/p95, P@1,
  recall@5, recall@10, NDCG@10, query count, and result fingerprints.
- Output sets `rawMemoryIncluded`, `rawTranscriptIncluded`,
  `rawPromptIncluded`, and `rawAnswerIncluded` to false.
- Output does not include query text, result text, raw memory ids, provider
  keys, private paths, cookies, or bearer tokens.
- Fixture output is intentionally rejected by `baseline:preflight` as real
  hosted-baseline evidence.

Boundary:

- This collector does not write to hosted Supermemory.
- This collector does not close the hosted-baseline blocker by itself.
- Public comparison claims still require a non-fixture metrics-only hosted
  baseline, a matched RecallWeave run, a RecallWeave win, and two independent
  reviewer approvals.
