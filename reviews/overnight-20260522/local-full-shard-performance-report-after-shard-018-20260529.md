# Local-Full Shard Performance Report

- Status: PARTIAL_LOCAL_FULL_PERFORMANCE_SNAPSHOT
- Accepted shards: 18/20
- Accepted queries: 450/500
- Coverage: 90%
- Next pending shard: shard-019 (450-475)
- Performance snapshot mature: false
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false

## Best Current Strategy
- Strategy: local-apple-qwen3-0_6b-local-rerank
- Answer quality: 27
- Delta vs BM25: 3.2644
- P50 latency ms: 9317.6111

## Local Apple
- Base answer quality: 22.0778
- Rerank answer quality: 27
- Rerank delta vs base: 4.9222

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
- local-apple-qwen3-0_6b-local-rerank: answerQuality=27; p50=9317.6111; scored=450
- bm25-lite: answerQuality=23.7356; p50=8800.1667; scored=450
- local-apple-qwen3-0_6b: answerQuality=22.0778; p50=10300.6667; scored=450
- full-hybrid-rerank: answerQuality=19.9244; p50=10334.1667; scored=450
- query-expanded-full-hybrid-rerank: answerQuality=19.6578; p50=9304.4444; scored=450

## Blockers
- local-full-coverage-incomplete

## Next Actions
- Finish or rerun shard-019 before treating the next 25-query slice as accepted.
- Regenerate this report after each accepted local-full shard to track quality and latency without claiming SOTA.
- Only use combine and full-memory SOTA gates after local-full or full-SOTA intake reports complete non-overlapping shard coverage.
