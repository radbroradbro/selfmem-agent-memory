# Local-Full Shard Performance Report

- Status: PARTIAL_LOCAL_FULL_PERFORMANCE_SNAPSHOT
- Accepted shards: 5/20
- Accepted queries: 125/500
- Coverage: 25%
- Next pending shard: shard-006 (125-150)
- Performance snapshot mature: false
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false

## Best Current Strategy
- Strategy: local-apple-qwen3-0_6b-local-rerank
- Answer quality: 28.328
- Delta vs BM25: 4.12
- P50 latency ms: 10116.4

## Local Apple
- Base answer quality: 22.368
- Rerank answer quality: 28.328
- Rerank delta vs base: 5.96

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
- local-apple-qwen3-0_6b-local-rerank: answerQuality=28.328; p50=10116.4; scored=125
- bm25-lite: answerQuality=24.208; p50=8511.6; scored=125
- full-hybrid-rerank: answerQuality=23.328; p50=10015.6; scored=125
- local-apple-qwen3-0_6b: answerQuality=22.368; p50=9329; scored=125
- query-expanded-full-hybrid-rerank: answerQuality=21.728; p50=9413.2; scored=125

## Blockers
- local-full-coverage-incomplete

## Next Actions
- Finish or rerun shard-006 before treating the next 25-query slice as accepted.
- Regenerate this report after each accepted local-full shard to track quality and latency without claiming SOTA.
- Only use combine and full-memory SOTA gates after local-full or full-SOTA intake reports complete non-overlapping shard coverage.
