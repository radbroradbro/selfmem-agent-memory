# Local-Full Shard Performance Report

- Status: PARTIAL_LOCAL_FULL_PERFORMANCE_SNAPSHOT
- Accepted shards: 2/20
- Accepted queries: 50/500
- Coverage: 10%
- Next pending shard: shard-003 (50-75)
- Performance snapshot mature: false
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false

## Best Current Strategy
- Strategy: full-hybrid-rerank
- Answer quality: 25.52
- Delta vs BM25: 2
- P50 latency ms: 9329.5

## Local Apple
- Base answer quality: 24.62
- Rerank answer quality: 19.82
- Rerank delta vs base: -4.8

## Runtime
- Runtime blocker status: BLOCKED_LOCAL_FULL_SHARD_RUNTIME
- Failed arm: local-apple-qwen3-0_6b-local-rerank
- Failure class: local-rerank-response-body-stall
- Resume result doctor: BLOCKED_LOCAL_FULL_SHARD_002_RESULT

## Strategy Summary
- full-hybrid-rerank: answerQuality=25.52; p50=9329.5; scored=50
- local-apple-qwen3-0_6b: answerQuality=24.62; p50=9887.5; scored=50
- bm25-lite: answerQuality=23.52; p50=7516; scored=50
- query-expanded-full-hybrid-rerank: answerQuality=21.82; p50=9642; scored=50
- local-apple-qwen3-0_6b-local-rerank: answerQuality=19.82; p50=11383.5; scored=50

## Blockers
- local-full-coverage-incomplete
- local-full-runtime-blocker-present

## Next Actions
- Finish or rerun shard-003 before treating the next 25-query slice as accepted.
- Regenerate this report after each accepted local-full shard to track quality and latency without claiming SOTA.
- Only use combine and full-memory SOTA gates after local-full or full-SOTA intake reports complete non-overlapping shard coverage.
