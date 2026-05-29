# Local-Full Shard Performance Report

- Status: PARTIAL_LOCAL_FULL_PERFORMANCE_SNAPSHOT
- Accepted shards: 13/20
- Accepted queries: 325/500
- Coverage: 65%
- Next pending shard: shard-014 (325-350)
- Performance snapshot mature: false
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false

## Best Current Strategy
- Strategy: local-apple-qwen3-0_6b-local-rerank
- Answer quality: 29.1385
- Delta vs BM25: 3.2585
- P50 latency ms: 9442

## Local Apple
- Base answer quality: 23.5538
- Rerank answer quality: 29.1385
- Rerank delta vs base: 5.5847

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
- local-apple-qwen3-0_6b-local-rerank: answerQuality=29.1385; p50=9442; scored=325
- bm25-lite: answerQuality=25.88; p50=9404.0769; scored=325
- local-apple-qwen3-0_6b: answerQuality=23.5538; p50=10801.6154; scored=325
- full-hybrid-rerank: answerQuality=20.9723; p50=10666.3846; scored=325
- query-expanded-full-hybrid-rerank: answerQuality=20.8492; p50=9437.5385; scored=325

## Blockers
- local-full-coverage-incomplete

## Next Actions
- Finish or rerun shard-014 before treating the next 25-query slice as accepted.
- Regenerate this report after each accepted local-full shard to track quality and latency without claiming SOTA.
- Only use combine and full-memory SOTA gates after local-full or full-SOTA intake reports complete non-overlapping shard coverage.
