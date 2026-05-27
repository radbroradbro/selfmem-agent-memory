# Local-Full Shard Performance Report

- Status: PARTIAL_LOCAL_FULL_PERFORMANCE_SNAPSHOT
- Accepted shards: 4/20
- Accepted queries: 100/500
- Coverage: 20%
- Next pending shard: shard-005 (100-125)
- Performance snapshot mature: false
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false

## Best Current Strategy
- Strategy: local-apple-qwen3-0_6b-local-rerank
- Answer quality: 26.41
- Delta vs BM25: 3.15
- P50 latency ms: 10226.75

## Local Apple
- Base answer quality: 23.96
- Rerank answer quality: 26.41
- Rerank delta vs base: 2.45

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
- local-apple-qwen3-0_6b-local-rerank: answerQuality=26.41; p50=10226.75; scored=100
- local-apple-qwen3-0_6b: answerQuality=23.96; p50=9291.5; scored=100
- bm25-lite: answerQuality=23.26; p50=8822.25; scored=100
- full-hybrid-rerank: answerQuality=23.16; p50=10217.5; scored=100
- query-expanded-full-hybrid-rerank: answerQuality=21.16; p50=8835.25; scored=100

## Blockers
- local-full-coverage-incomplete

## Next Actions
- Finish or rerun shard-005 before treating the next 25-query slice as accepted.
- Regenerate this report after each accepted local-full shard to track quality and latency without claiming SOTA.
- Only use combine and full-memory SOTA gates after local-full or full-SOTA intake reports complete non-overlapping shard coverage.
