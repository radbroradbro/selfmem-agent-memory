# Local Rerank Result Gate

- Status: BLOCKED_LOCAL_RERANK_RESULT
- Counts as live local rerank benchmark: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false
- Target: reviews/overnight-20260522/public-longmemeval-expanded-run-target.json

## Blockers
- fixture-result-cannot-count-as-live-local-rerank
- result-not-bound-to-source-locked-target
- missing-materializer-hash
- local-rerank-live-consent-not-proven
- local-rerank-live-calls-missing
- local-rerank-used-mock-calls
- local-rerank-endpoints-not-proven

## Result
- Source: generated-fixture-local-rerank-smoke
- Fixture only: true
- Model arm: local-apple-qwen3-0_6b-local-rerank
- Provider calls made: 0
- Provider mock calls: 6
- Embedding calls: 3
- Rerank calls: 3

## Next Actions
- Run the same-data provider comparison with configured local embedding and local rerank endpoints.
- Include bm25-lite, full-hybrid-rerank, and local-apple-qwen3-0_6b-local-rerank on the source-locked target.
- Re-run this gate with --require-ready before counting the local reranker row in the SOTA ladder.
