# Local-Full Shard Performance Report

- Status: PARTIAL_LOCAL_FULL_PERFORMANCE_SNAPSHOT
- Accepted shards: 6/20
- Accepted queries: 150/500
- Coverage: 30%
- Next pending shard: shard-007 (150-175)
- Performance snapshot mature: false
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false

## Best Current Strategy
- Strategy: local-apple-qwen3-0_6b-local-rerank
- Answer quality: 28.8067
- Delta vs BM25: 3.9667
- P50 latency ms: 10026.6667

## Local Apple
- Base answer quality: 21.9733
- Rerank answer quality: 28.8067
- Rerank delta vs base: 6.8334

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
- local-apple-qwen3-0_6b-local-rerank: answerQuality=28.8067; p50=10026.6667; scored=150
- bm25-lite: answerQuality=24.84; p50=8464.1667; scored=150
- local-apple-qwen3-0_6b: answerQuality=21.9733; p50=9384.6667; scored=150
- full-hybrid-rerank: answerQuality=21.3067; p50=9957.3333; scored=150
- query-expanded-full-hybrid-rerank: answerQuality=19.9733; p50=9583.1667; scored=150

## Blockers
- local-full-coverage-incomplete

## Next Actions
- Finish or rerun shard-007 before treating the next 25-query slice as accepted.
- Regenerate this report after each accepted local-full shard to track quality and latency without claiming SOTA.
- Only use combine and full-memory SOTA gates after local-full or full-SOTA intake reports complete non-overlapping shard coverage.
