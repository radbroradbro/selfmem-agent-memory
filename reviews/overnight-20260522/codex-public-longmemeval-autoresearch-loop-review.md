# Codex Public LongMemEval Autoresearch Loop Review

Verdict: PASS WITH CONCERNS

The autoresearch loop is correctly scoped. It runs multiple retrieval-proxy
arms against the same-data source-locked LongMemEval-S materialized slice, keeps raw
benchmark data outside the repository, and records only metrics, hashes,
configuration, and safety flags.

Evidence checked:

- `packages/bench/public-benchmark-autoresearch-loop.mjs`
- `reviews/overnight-20260522/public-longmemeval-autoresearch-loop.json`
- `reviews/overnight-20260522/public-longmemeval-autoresearch-loop-evidence.md`
- `reviews/overnight-20260522/public-longmemeval-materialize-run.json`
- `reviews/overnight-20260522/public-longmemeval-recallweave-run-result.json`

Result:

- 24 arms ran on the same query-set hash.
- The loop winner is `bm25-lite-b800-k5`.
- Quality stayed at `0.4541`, P@1 stayed at `0.8333`, and average context
  tokens dropped to `800`.
- The initial `jaccard-b1600-k10` baseline remains at quality `0.1089`.
- Privacy and redaction failures stayed at `0`.

Concerns:

- This is still retrieval-proxy evidence, not MemoryBench answer-quality
  evaluation.
- The loop searched sparse retrieval, context budget, and candidate limit only.
  It did not yet test embedding, reranking, temporal retrieval, graph expansion,
  or query expansion.
- The six-row slice is a useful canary but not enough for public SOTA language.

Approval:

Keep `bm25-lite-b800-k5` as the next local-only canary setting. Expand the
autoresearch loop next with embedding, reranking, temporal, or query-expansion
arms against the same source-locked slice before making broader claims.
