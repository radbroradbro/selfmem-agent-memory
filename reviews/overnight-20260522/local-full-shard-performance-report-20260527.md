# Local-Full Shard Performance Report

- Status: PARTIAL_LOCAL_FULL_PERFORMANCE_SNAPSHOT
- Accepted shards: 3/20
- Accepted queries: 75/500
- Coverage: 15%
- Next pending shard: shard-004 (75-100)
- Performance snapshot mature: false
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false

## Best Current Strategy
- Strategy: full-hybrid-rerank
- Answer quality: 25.0133
- Delta vs BM25: 2.4
- P50 latency ms: 10885

## Local Apple
- Base answer quality: 24.4133
- Rerank answer quality: 23.88
- Rerank delta vs base: -0.5333

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
- full-hybrid-rerank: answerQuality=25.0133; p50=10885; scored=75
- local-apple-qwen3-0_6b: answerQuality=24.4133; p50=8923.3333; scored=75
- local-apple-qwen3-0_6b-local-rerank: answerQuality=23.88; p50=10045.3333; scored=75
- bm25-lite: answerQuality=22.6133; p50=9434.3333; scored=75
- query-expanded-full-hybrid-rerank: answerQuality=21.2133; p50=8680; scored=75

## Blockers
- local-full-coverage-incomplete

## Next Actions
- Finish or rerun shard-004 before treating the next 25-query slice as accepted.
- Regenerate this report after each accepted local-full shard to track quality and latency without claiming SOTA.
- Only use combine and full-memory SOTA gates after local-full or full-SOTA intake reports complete non-overlapping shard coverage.
