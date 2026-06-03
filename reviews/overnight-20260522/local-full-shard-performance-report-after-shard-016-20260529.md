# Local-Full Shard Performance Report

- Status: PARTIAL_LOCAL_FULL_PERFORMANCE_SNAPSHOT
- Accepted shards: 16/20
- Accepted queries: 400/500
- Coverage: 80%
- Next pending shard: shard-017 (400-425)
- Performance snapshot mature: false
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false

## Best Current Strategy
- Strategy: local-apple-qwen3-0_6b-local-rerank
- Answer quality: 29.375
- Delta vs BM25: 3.6725
- P50 latency ms: 9191.75

## Local Apple
- Base answer quality: 23.8375
- Rerank answer quality: 29.375
- Rerank delta vs base: 5.5375

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
- local-apple-qwen3-0_6b-local-rerank: answerQuality=29.375; p50=9191.75; scored=400
- bm25-lite: answerQuality=25.7025; p50=9107; scored=400
- local-apple-qwen3-0_6b: answerQuality=23.8375; p50=10283.4375; scored=400
- full-hybrid-rerank: answerQuality=21.415; p50=10416.75; scored=400
- query-expanded-full-hybrid-rerank: answerQuality=21.115; p50=9212.9375; scored=400

## Blockers
- local-full-coverage-incomplete

## Next Actions
- Finish or rerun shard-017 before treating the next 25-query slice as accepted.
- Regenerate this report after each accepted local-full shard to track quality and latency without claiming SOTA.
- Only use combine and full-memory SOTA gates after local-full or full-SOTA intake reports complete non-overlapping shard coverage.
