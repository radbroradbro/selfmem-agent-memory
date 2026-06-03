# Local-Full Shard Performance Report

- Status: PARTIAL_LOCAL_FULL_PERFORMANCE_SNAPSHOT
- Accepted shards: 17/20
- Accepted queries: 425/500
- Coverage: 85%
- Next pending shard: shard-018 (425-450)
- Performance snapshot mature: false
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false

## Best Current Strategy
- Strategy: local-apple-qwen3-0_6b-local-rerank
- Answer quality: 27.8824
- Delta vs BM25: 3.2212
- P50 latency ms: 9181.8824

## Local Apple
- Base answer quality: 22.6706
- Rerank answer quality: 27.8824
- Rerank delta vs base: 5.2118

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
- local-apple-qwen3-0_6b-local-rerank: answerQuality=27.8824; p50=9181.8824; scored=425
- bm25-lite: answerQuality=24.6612; p50=8952.2353; scored=425
- local-apple-qwen3-0_6b: answerQuality=22.6706; p50=10233.1765; scored=425
- full-hybrid-rerank: answerQuality=20.6259; p50=10329.7647; scored=425
- query-expanded-full-hybrid-rerank: answerQuality=20.3435; p50=9219.6471; scored=425

## Blockers
- local-full-coverage-incomplete

## Next Actions
- Finish or rerun shard-018 before treating the next 25-query slice as accepted.
- Regenerate this report after each accepted local-full shard to track quality and latency without claiming SOTA.
- Only use combine and full-memory SOTA gates after local-full or full-SOTA intake reports complete non-overlapping shard coverage.
