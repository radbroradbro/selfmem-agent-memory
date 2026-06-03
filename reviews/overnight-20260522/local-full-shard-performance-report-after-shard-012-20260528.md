# Local-Full Shard Performance Report

- Status: PARTIAL_LOCAL_FULL_PERFORMANCE_SNAPSHOT
- Accepted shards: 12/20
- Accepted queries: 300/500
- Coverage: 60%
- Next pending shard: shard-013 (300-325)
- Performance snapshot mature: false
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false

## Best Current Strategy
- Strategy: local-apple-qwen3-0_6b-local-rerank
- Answer quality: 28.9
- Delta vs BM25: 2.8633
- P50 latency ms: 9366.25

## Local Apple
- Base answer quality: 23.85
- Rerank answer quality: 28.9
- Rerank delta vs base: 5.05

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
- local-apple-qwen3-0_6b-local-rerank: answerQuality=28.9; p50=9366.25; scored=300
- bm25-lite: answerQuality=26.0367; p50=9571.4167; scored=300
- local-apple-qwen3-0_6b: answerQuality=23.85; p50=10810.9167; scored=300
- full-hybrid-rerank: answerQuality=20.72; p50=10746.75; scored=300
- query-expanded-full-hybrid-rerank: answerQuality=20.5867; p50=9411.25; scored=300

## Blockers
- local-full-coverage-incomplete

## Next Actions
- Finish or rerun shard-013 before treating the next 25-query slice as accepted.
- Regenerate this report after each accepted local-full shard to track quality and latency without claiming SOTA.
- Only use combine and full-memory SOTA gates after local-full or full-SOTA intake reports complete non-overlapping shard coverage.
