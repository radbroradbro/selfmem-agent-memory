# RecallWeave Response Export Evidence

Date: 2026-05-23

Scope:

- Added `packages/bench/recallweave-response-export.mjs`.
- Added
  `packages/bench/fixtures/recallweave-local-container.fixture/local-memories.fixture.jsonl`.
- Added `baseline:export:recallweave`.
- Wired the exporter into the smoke path, consumer smoke, release doctor,
  release readiness gate, and hosted baseline operator packet.
- Gemini focused review returned `CLEAN`.

Commands:

```bash
node --check packages/bench/recallweave-response-export.mjs
npm exec --yes pnpm@10.23.0 -- baseline:export:recallweave -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:collect:recallweave -- --fixture --responses <exported-responses.json>
```

Expected behavior:

- Fixture mode reads the local-container fixture and emits a metrics-only
  response export.
- Live mode requires `--live` or `RECALLWEAVE_BASELINE_LIVE=1` and
  `RECALLWEAVE_BASELINE_NO_RAW_TEXT=1`.
- Live mode reads `memories.jsonl` from `--container-dir` or `--memories`.
- Output includes query response ids or hashed ids, content hashes, scores,
  timings, token estimates, source labels, and privacy counters.
- Output does not include raw memory, transcript, prompt, answer, document,
  chunk, content, text, private tags, private paths, or credentials.
- Fully private memories are skipped and counted.
- The exporter now builds strategy-specific candidate features. Lexical control
  arms such as `bm25-lite` and `jaccard` avoid dense vectors, graph/topic
  features, role coverage, and date extraction, while hybrid/provider arms keep
  the richer feature profile they need.
- The exported response file can feed
  `baseline:collect:recallweave -- --responses <path>`.
- Operators must use the exporter's `--output` flag. They must not redirect the
  package-manager command's stdout into the JSON file, because wrapper banners
  can corrupt the evidence file before the collector reads it.

Boundary:

- This exporter does not call hosted Supermemory.
- This exporter does not close the hosted-baseline blocker by itself.
- Fixture exports remain fixture-only and cannot support public comparison
  claims.
- The full-shard BM25 control export probe in
  `full-shard-bm25-control-export-probe-20260526` proves only that the first
  25-query lexical control shard is now runnable against the regenerated
  private 500-row LongMemEval inputs. It is not an answer-quality result,
  reviewer-approved result, or SOTA claim.
- Real comparison claims still require a live hosted baseline, a live
  RecallWeave export/result, matched query/scoring hashes, a RecallWeave win,
  and two reviewer approvals.
