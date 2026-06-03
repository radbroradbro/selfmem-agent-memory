# Atomic Rehydration And Provider Readiness

Generated: 2026-05-31

## Summary

This pass implemented the review plan's highest-ROI harness refinement before starting a larger provider wave:

- Provider key bundles were staged privately outside repository history. Public evidence records only provider readiness and key counts.
- Provider live preflight is ready under the no-spend/free-tier contract for Gemini, NVIDIA, and Voyage.
- `atomic-memory-v1` now materializes separate atomic fact records with provenance back to the retained contextual source chunk.
- Response export ranks atomic fact records independently, then exports the rehydrated source chunk result ID so answer-quality reconstruction can retrieve source context without treating raw source chunks as searchable memories.
- The Opus reviewer lane did not return inside a useful bounded window and was stopped. DeepSeek V4 Pro returned a cold review; its strongest concern, losing the atomic ranking identity during source rehydration, was addressed before this evidence note.

## Provider Readiness

Evidence:

- `provider-live-preflight-free-tier-keys-20260531.json`
- `provider-live-preflight-free-tier-keys-20260531.md`

Status:

- `READY_FOR_LIVE_PROVIDER_BENCHMARK`
- Calls provider APIs during preflight: `false`
- Sends benchmark text during preflight: `false`
- Budget mode: `no-spend-free-tier`
- Max paid USD: `0`
- Providers present: Gemini, NVIDIA, Voyage
- Key counts: Gemini `6`, NVIDIA `1`, Voyage `8`
- Cross-provider fallback: disabled
- Blockers: none

## Harness Change

Materialization:

- Previous atomic method emitted one atomic memory record per source chunk with multiple fact lines inside the same record.
- New atomic method emits one record per atomic fact and keeps source chunk records as non-searchable rehydration targets.
- Each atomic fact carries `sourceChunkId`, `rehydrateId`, `sourceContentHash`, `sourceEstimatedTokens`, `parentSessionId`, and atomic fact index metadata.

Response export:

- Search/ranking IDs stay atomic.
- Exported result IDs use the rehydrated source chunk when present.
- Top-k deduplication is by exported result ID, so multiple atoms from the same chunk do not crowd out other chunks, while the winning atomic fact still determines the score/order.

## Verification

Commands run:

- `node --check packages/bench/recallweave-response-export.mjs`
- `node --check packages/bench/public-benchmark-materialize-run.mjs`
- `npm exec --yes pnpm@10.23.0 -- test -- tests/bench/benchmark-contract.test.ts --runInBand`

Result:

- 7 test files passed.
- 33 tests passed.

New contract coverage:

- Atomic materialization produces more atomic records than contextual source chunks.
- Atomic materialization preserves expected result references.
- Rehydrated atomic export keeps atomic ranking IDs while exporting unique source result IDs.

## Retrieval-Proxy Evidence

Fixture ladder:

- Evidence: `memory-method-ladder-atomic-rehydration-fixture-20260531.json`
- Atomic method records: 3 contextual source chunks, 6 atomic memories, 9 total records.
- Result: chunked/contextual/atomic fixture arms tie at quality `0.8125`.
- Claim boundary: fixture diagnostic only.

Live 10-query ladder:

- Evidence: `memory-method-ladder-atomic-rehydration-live-10q-20260531.json`
- Query shard: 10 questions from the source-locked LongMemEval target.
- Atomic materialization: 494 sessions, 3,562 contextual source chunks, 4,908 atomic memories, 8,470 total records.

Scores:

| Method | Strategy | Quality | p@1 | Recall@5 | NDCG@10 | P50 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| session-v1 | bm25-lite | 0.2772 | 0.6 | 0.1417 | 0.2255 | 47 |
| atomic-memory-v1 | bm25-lite | 0.2586 | 0.6 | 0.0842 | 0.2660 | 34 |
| atomic-memory-v1 | full-hybrid-rerank | 0.2396 | 0.6 | 0.0675 | 0.2235 | 96 |
| contextual-index-source-chunk-v1 | full-hybrid-rerank | 0.2114 | 0.5 | 0.0673 | 0.2110 | 77 |
| contextual-source-chunk-v1 | full-hybrid-rerank | 0.2003 | 0.5 | 0.0576 | 0.1861 | 119 |

Interpretation:

- Session-level BM25 still wins this small retrieval-proxy lane.
- Atomic BM25 is the best chunked method on this lane and has better NDCG@10 than session BM25.
- This is not answer-quality evidence, production readiness, or SOTA evidence.
- The next large wave should test whether atomic source rehydration improves final answers under the same answer model, judge model, prompt template, and context budget.

## External Review Notes

DeepSeek V4 Pro review concerns:

- Deduping by source can discard a lower-ranked atom from the same chunk if multiple facts are needed.
- Position-based atomic IDs are not stable under chunking changes.
- Supermemory comparisons are invalid unless answer model, judge model, prompt template, context budget, and latency reporting are controlled.

Disposition:

- Addressed now: ranking identity and rehydrated result identity are split, so atoms stay independently rankable before source-result dedupe.
- Still open: content-derived atomic IDs or a documented chunking-stability contract.
- Still open: answer-quality benchmark over a larger shard with the same model/judge/budget across arms.

## Claim Boundary

This pass improves benchmark methodology and provider readiness. It does not prove:

- RecallWeave is production-ready.
- RecallWeave beats Supermemory.
- The current method is SOTA.
- Title/wiki amplification improves answer quality.

The appropriate next step is a no-spend provider wave plus answer-quality scoring on the accepted source-locked target, with Supermemory search/write disabled for the benchmark unless explicitly re-enabled for a separate product-parity lane.
