# Local-Full Shard Performance Report

- Status: PARTIAL_LOCAL_FULL_PERFORMANCE_SNAPSHOT
- Accepted shards: 15/20
- Accepted queries: 375/500
- Coverage: 75%
- Next pending shard: shard-016 (375-400)
- Performance snapshot mature: false
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false

## Best Current Strategy
- Strategy: local-apple-qwen3-0_6b-local-rerank
- Answer quality: 29.9733
- Delta vs BM25: 4.504
- P50 latency ms: 9210.9333

## Local Apple
- Base answer quality: 23.8
- Rerank answer quality: 29.9733
- Rerank delta vs base: 6.1733

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
- local-apple-qwen3-0_6b-local-rerank: answerQuality=29.9733; p50=9210.9333; scored=375
- bm25-lite: answerQuality=25.4693; p50=9235.8667; scored=375
- local-apple-qwen3-0_6b: answerQuality=23.8; p50=10348.6667; scored=375
- full-hybrid-rerank: answerQuality=20.9493; p50=10520; scored=375
- query-expanded-full-hybrid-rerank: answerQuality=20.896; p50=9222.2; scored=375

## Blockers
- local-full-coverage-incomplete

## Next Actions
- Finish or rerun shard-016 before treating the next 25-query slice as accepted.
- Regenerate this report after each accepted local-full shard to track quality and latency without claiming SOTA.
- Only use combine and full-memory SOTA gates after local-full or full-SOTA intake reports complete non-overlapping shard coverage.
