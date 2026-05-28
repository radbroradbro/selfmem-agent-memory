# Local-Full Shard Performance Report

- Status: PARTIAL_LOCAL_FULL_PERFORMANCE_SNAPSHOT
- Accepted shards: 8/20
- Accepted queries: 200/500
- Coverage: 40%
- Next pending shard: shard-009 (200-225)
- Performance snapshot mature: false
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false

## Best Current Strategy
- Strategy: local-apple-qwen3-0_6b-local-rerank
- Answer quality: 28.405
- Delta vs BM25: 4.275
- P50 latency ms: 9553.875

## Local Apple
- Base answer quality: 21.98
- Rerank answer quality: 28.405
- Rerank delta vs base: 6.425

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
- local-apple-qwen3-0_6b-local-rerank: answerQuality=28.405; p50=9553.875; scored=200
- bm25-lite: answerQuality=24.13; p50=8104.25; scored=200
- local-apple-qwen3-0_6b: answerQuality=21.98; p50=11659.625; scored=200
- full-hybrid-rerank: answerQuality=20.98; p50=9667.375; scored=200
- query-expanded-full-hybrid-rerank: answerQuality=20.48; p50=9422.625; scored=200

## Blockers
- local-full-coverage-incomplete

## Next Actions
- Finish or rerun shard-009 before treating the next 25-query slice as accepted.
- Regenerate this report after each accepted local-full shard to track quality and latency without claiming SOTA.
- Only use combine and full-memory SOTA gates after local-full or full-SOTA intake reports complete non-overlapping shard coverage.
