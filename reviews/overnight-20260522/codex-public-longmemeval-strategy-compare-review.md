# Codex Public LongMemEval Strategy Compare Review

Verdict: PASS WITH CONCERNS

The strategy comparison is useful and correctly bounded. It runs `jaccard`,
`bm25-lite`, and `hybrid-v1` on the same source-locked LongMemEval-S canary
slice, binds every result to the materialized collector-compatible query-set
hash, and keeps raw questions, answers, memories, transcripts, private paths,
and credentials out of committed artifacts.

Evidence checked:

- `packages/bench/public-benchmark-strategy-compare.mjs`
- `packages/bench/recallweave-response-export.mjs`
- `reviews/overnight-20260522/public-longmemeval-materialize-run.json`
- `reviews/overnight-20260522/public-longmemeval-strategy-compare.json`
- `reviews/overnight-20260522/public-longmemeval-strategy-compare-evidence.md`

Result:

- `bm25-lite` won the retrieval-proxy comparison on the same-data slice.
- Quality moved from `0.1089` for `jaccard` to `0.4541`.
- P@1 moved from `0.1667` to `0.8333`.
- Recall@5 and recall@10 moved from `0.0833` to `0.2917`.
- NDCG@10 moved from `0.1022` to `0.3996`.
- Privacy and redaction failures stayed at `0`.

Concerns:

- This is not a MemoryBench answer-quality result. It is retrieval-proxy
  evidence from the local RecallWeave exporter and collector.
- The slice is six LongMemEval-S rows, so it is a canary trend, not a full
  benchmark.
- `hybrid-v1` tied `bm25-lite` on quality but was slower, which suggests the
  next methodology change should stay simple unless later embedding or
  reranker arms need the hybrid signals.

Approval:

Keep `bm25-lite` as the next public canary retrieval strategy. Do not claim
RecallWeave beats Supermemory, MemoryBench leaders, or SOTA from this result.
