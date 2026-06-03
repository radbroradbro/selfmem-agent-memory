# Local-Full Shard Performance Report

- Status: PARTIAL_LOCAL_FULL_PERFORMANCE_SNAPSHOT
- Accepted shards: 9/20
- Accepted queries: 225/500
- Coverage: 45%
- Next pending shard: shard-010 (225-250)
- Performance snapshot mature: false
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false

## Best Current Strategy
- Strategy: local-apple-qwen3-0_6b-local-rerank
- Answer quality: 29.6933
- Delta vs BM25: 4.2444
- P50 latency ms: 9435.4444

## Local Apple
- Base answer quality: 23.5378
- Rerank answer quality: 29.6933
- Rerank delta vs base: 6.1555

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
- local-apple-qwen3-0_6b-local-rerank: answerQuality=29.6933; p50=9435.4444; scored=225
- bm25-lite: answerQuality=25.4489; p50=7984.6667; scored=225
- local-apple-qwen3-0_6b: answerQuality=23.5378; p50=11307.4444; scored=225
- full-hybrid-rerank: answerQuality=20.8711; p50=9674.3333; scored=225
- query-expanded-full-hybrid-rerank: answerQuality=20.4267; p50=9406.1111; scored=225

## Blockers
- local-full-coverage-incomplete

## Next Actions
- Finish or rerun shard-010 before treating the next 25-query slice as accepted.
- Regenerate this report after each accepted local-full shard to track quality and latency without claiming SOTA.
- Only use combine and full-memory SOTA gates after local-full or full-SOTA intake reports complete non-overlapping shard coverage.
