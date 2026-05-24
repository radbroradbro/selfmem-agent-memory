# Codex Public LongMemEval Hybrid Gate Review

Verdict: PASS WITH CONCERNS

The hybrid gate now answers the BM25 concern directly. It compares the
`bm25-lite` lexical control against local-only hybrid-family proxy arms on the
same source-locked LongMemEval-S canary slice, while keeping raw questions,
answers, memories, transcripts, private paths, and credentials out of committed
artifacts.

Evidence checked:

- `packages/bench/recallweave-response-export.mjs`
- `packages/bench/public-benchmark-strategy-compare.mjs`
- `reviews/overnight-20260522/public-longmemeval-hybrid-gate.json`
- `reviews/overnight-20260522/public-longmemeval-hybrid-gate-evidence.md`

Result:

- `bm25-lite` remains the winner and control floor.
- `bm25-lite`: quality 0.4541, P@1 0.8333, recall@5 0.2917, NDCG@10 0.3996,
  p50 latency 16 ms.
- `full-hybrid-rerank` and `query-expanded-full-hybrid-rerank` tied quality but
  were slower at 33 ms p50.
- `dense-proxy` was faster but lower quality.
- Privacy and redaction failures stayed at 0 for every arm.

Concerns:

- This is still retrieval-proxy evidence, not MemoryBench answer-quality.
- The dense, graph, rerank, and query-expansion pieces are deterministic
  local-only proxies. They prove benchmark wiring and ranking behavior, not
  Voyage, Gemini, NVIDIA, or Apple Silicon model quality.
- The slice is six LongMemEval-S rows. It is useful as a canary but too small
  for public SOTA or leaderboard language.

Approval:

Keep `bm25-lite-b800-k5` as the fallback/control. Do not promote the hybrid
proxy stack to the agent default from this run. The next methodology step should
test real embedding and reranker provider arms on the same source-locked slice,
then repeat on a larger slice before any product-default change.
