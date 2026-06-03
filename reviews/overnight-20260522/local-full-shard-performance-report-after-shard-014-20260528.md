# Local-Full Shard Performance Report

- Status: PARTIAL_LOCAL_FULL_PERFORMANCE_SNAPSHOT
- Accepted shards: 14/20
- Accepted queries: 350/500
- Coverage: 70%
- Next pending shard: shard-015 (350-375)
- Performance snapshot mature: false
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false

## Best Current Strategy
- Strategy: local-apple-qwen3-0_6b-local-rerank
- Answer quality: 29.3429
- Delta vs BM25: 3.4543
- P50 latency ms: 9352.1429

## Local Apple
- Base answer quality: 23.7857
- Rerank answer quality: 29.3429
- Rerank delta vs base: 5.5572

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
- local-apple-qwen3-0_6b-local-rerank: answerQuality=29.3429; p50=9352.1429; scored=350
- bm25-lite: answerQuality=25.8886; p50=9160.5; scored=350
- local-apple-qwen3-0_6b: answerQuality=23.7857; p50=10624.7143; scored=350
- query-expanded-full-hybrid-rerank: answerQuality=21.2743; p50=9350.5714; scored=350
- full-hybrid-rerank: answerQuality=21.0457; p50=10493.8571; scored=350

## Blockers
- local-full-coverage-incomplete

## Next Actions
- Finish or rerun shard-015 before treating the next 25-query slice as accepted.
- Regenerate this report after each accepted local-full shard to track quality and latency without claiming SOTA.
- Only use combine and full-memory SOTA gates after local-full or full-SOTA intake reports complete non-overlapping shard coverage.
