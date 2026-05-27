# Local-Full Shard Performance Report

- Status: PARTIAL_LOCAL_FULL_PERFORMANCE_SNAPSHOT
- Accepted shards: 7/20
- Accepted queries: 175/500
- Coverage: 35%
- Next pending shard: shard-008 (175-200)
- Performance snapshot mature: false
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false

## Best Current Strategy
- Strategy: local-apple-qwen3-0_6b-local-rerank
- Answer quality: 29.2629
- Delta vs BM25: 4.5429
- P50 latency ms: 9665.8571

## Local Apple
- Base answer quality: 22.2629
- Rerank answer quality: 29.2629
- Rerank delta vs base: 7

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
- local-apple-qwen3-0_6b-local-rerank: answerQuality=29.2629; p50=9665.8571; scored=175
- bm25-lite: answerQuality=24.72; p50=8336.1429; scored=175
- local-apple-qwen3-0_6b: answerQuality=22.2629; p50=12074.2857; scored=175
- full-hybrid-rerank: answerQuality=21.6914; p50=9806; scored=175
- query-expanded-full-hybrid-rerank: answerQuality=21.12; p50=9534.5714; scored=175

## Blockers
- local-full-coverage-incomplete

## Next Actions
- Finish or rerun shard-008 before treating the next 25-query slice as accepted.
- Regenerate this report after each accepted local-full shard to track quality and latency without claiming SOTA.
- Only use combine and full-memory SOTA gates after local-full or full-SOTA intake reports complete non-overlapping shard coverage.
