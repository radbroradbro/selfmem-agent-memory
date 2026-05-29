# Local-Full Shard Performance Report

- Status: PARTIAL_LOCAL_FULL_PERFORMANCE_SNAPSHOT
- Accepted shards: 11/20
- Accepted queries: 275/500
- Coverage: 55%
- Next pending shard: shard-012 (275-300)
- Performance snapshot mature: false
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false

## Best Current Strategy
- Strategy: local-apple-qwen3-0_6b-local-rerank
- Answer quality: 28.2945
- Delta vs BM25: 2.0181
- P50 latency ms: 9417.0909

## Local Apple
- Base answer quality: 23.9491
- Rerank answer quality: 28.2945
- Rerank delta vs base: 4.3454

## Runtime
- Runtime blocker status: BLOCKED_LOCAL_FULL_SHARD_RUNTIME
- Runtime recovery status: RETRIEVAL_AND_SCORING_READY
- Active runtime-blocked shards: 0
- Historical runtime-blocked shards: 1
- Failed arm: local-apple-qwen3-0_6b-local-rerank
- Failure class: local-rerank-response-body-stall
- Recovery arm export ready: true
- Recovery preflight same-data ready: true
- Recovery scoring env ready: true
- Resume result doctor: BLOCKED_LOCAL_FULL_SHARD_002_RESULT

## Strategy Summary
- local-apple-qwen3-0_6b-local-rerank: answerQuality=28.2945; p50=9417.0909; scored=275
- bm25-lite: answerQuality=26.2764; p50=8989.3636; scored=275
- local-apple-qwen3-0_6b: answerQuality=23.9491; p50=10982.3636; scored=275
- full-hybrid-rerank: answerQuality=21.0218; p50=10439.8182; scored=275
- query-expanded-full-hybrid-rerank: answerQuality=20.6582; p50=9442.9091; scored=275

## Blockers
- local-full-coverage-incomplete

## Next Actions
- Finish or rerun shard-012 before treating the next 25-query slice as accepted.
- Regenerate this report after each accepted local-full shard to track quality and latency without claiming SOTA.
- Only use combine and full-memory SOTA gates after local-full or full-SOTA intake reports complete non-overlapping shard coverage.
