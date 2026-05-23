# RecallWeave Baseline Collector Evidence

Date: 2026-05-23

Verdict: implemented as fixture-safe benchmark plumbing. It does not close the
hosted-baseline blocker by itself.

## What Changed

- Added `packages/bench/recallweave-baseline-collector.mjs`.
- Added `packages/bench/baseline-scoring-contract.mjs` so hosted and
  RecallWeave collectors share the same scoring-code hash.
- Added
  `packages/bench/fixtures/recallweave-baseline-search-responses.fixture.json`.
- Added `baseline:collect:recallweave`.
- Updated the hosted baseline operator packet so agents collect:
  - hosted aggregate result,
  - RecallWeave aggregate result,
  - matched comparison output.

## Commands

```bash
node --check packages/bench/recallweave-baseline-collector.mjs
node --check packages/bench/hosted-baseline-collector.mjs
node --check packages/bench/hosted-baseline-operator-packet.mjs
npm exec --yes pnpm@10.23.0 -- baseline:collect -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:collect:recallweave -- --fixture
node packages/bench/baseline-comparison.mjs --hosted <hosted-fixture-result> --recallweave <recallweave-fixture-result>
npm exec --yes pnpm@10.23.0 -- release:doctor
```

## Result Shape

- Provider: `recallweave`.
- Output: aggregate metrics, cost fields, privacy counters, source hashes,
  response hashes, and result fingerprints only.
- Fixture result shares the hosted collector query-set hash and scoring-code
  hash.
- Raw memory, transcript, prompt, and answer flags remain false.
- Fixture comparisons remain blocked from public benchmark claims.

## Live-Run Contract

The live command is:

```bash
RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 \
npm exec --yes pnpm@10.23.0 -- baseline:collect:recallweave \
  -- --live --responses /tmp/recallweave-search-responses.json \
  --output /tmp/recallweave-result.json
```

The response export must contain ids, scores, timings, token estimates, privacy
counters, and content hashes. Raw response text is rejected by default. Local
experiments may override that only with
`RECALLWEAVE_BASELINE_ALLOW_RAW_RESPONSE_TEXT=1`, but such runs are not public
attachments.

## Safety

- The collector calls no hosted provider.
- The output rejects key-shaped secrets and private local paths.
- The release gate includes a negative check proving raw response text is
  rejected in live mode.
- The operator packet forbids raw hosted memories, raw local memories,
  transcripts, prompts, answers, credentials, cookies, bearer tokens, private
  paths, and unredacted diagnostics.
