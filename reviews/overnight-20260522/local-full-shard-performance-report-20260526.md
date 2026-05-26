# Local-Full Shard Performance Report

- Status: PARTIAL_LOCAL_FULL_PERFORMANCE_SNAPSHOT
- Accepted shards: 1/20
- Accepted queries: 25/500
- Coverage: 5%
- Next pending shard: shard-002 (25-50)
- Performance snapshot mature: false
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false

## Best Current Strategy
- Strategy: full-hybrid-rerank
- Answer quality: 19.4
- Delta vs BM25: 4.2
- P50 latency ms: 8954

## Local Apple
- Base answer quality: 17.4
- Rerank answer quality: 15.8
- Rerank delta vs base: -1.6

## Runtime
- Runtime blocker status: BLOCKED_LOCAL_FULL_SHARD_RUNTIME
- Failed arm: local-apple-qwen3-0_6b
- Failure class: local-embedding-server-socket-close
- Resume result doctor: BLOCKED_LOCAL_FULL_SHARD_002_RESULT

## Strategy Summary
- full-hybrid-rerank: answerQuality=19.4; p50=8954; scored=25
- local-apple-qwen3-0_6b: answerQuality=17.4; p50=9064; scored=25
- local-apple-qwen3-0_6b-local-rerank: answerQuality=15.8; p50=9199; scored=25
- bm25-lite: answerQuality=15.2; p50=8353; scored=25
- query-expanded-full-hybrid-rerank: answerQuality=12; p50=9360; scored=25

## Blockers
- local-full-coverage-incomplete
- local-full-runtime-blocker-present

## Next Actions
- Finish the shard-002 local-full resume path before treating the next 25-query slice as accepted.
- Regenerate this report after each accepted local-full shard to track quality and latency without claiming SOTA.
- Only use combine and full-memory SOTA gates after local-full or full-SOTA intake reports complete non-overlapping shard coverage.
