# Local-Full Shard Performance Report

- Status: PARTIAL_LOCAL_FULL_PERFORMANCE_SNAPSHOT
- Accepted shards: 10/20
- Accepted queries: 250/500
- Coverage: 50%
- Next pending shard: shard-011 (250-275)
- Performance snapshot mature: false
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false

## Best Current Strategy
- Strategy: local-apple-qwen3-0_6b-local-rerank
- Answer quality: 30.724
- Delta vs BM25: 4.52
- P50 latency ms: 9373.7

## Local Apple
- Base answer quality: 24.424
- Rerank answer quality: 30.724
- Rerank delta vs base: 6.3

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
- local-apple-qwen3-0_6b-local-rerank: answerQuality=30.724; p50=9373.7; scored=250
- bm25-lite: answerQuality=26.204; p50=7903.3; scored=250
- local-apple-qwen3-0_6b: answerQuality=24.424; p50=11098.1; scored=250
- full-hybrid-rerank: answerQuality=21.124; p50=9625.1; scored=250
- query-expanded-full-hybrid-rerank: answerQuality=20.724; p50=9368.8; scored=250

## Blockers
- local-full-coverage-incomplete

## Next Actions
- Finish or rerun shard-011 before treating the next 25-query slice as accepted.
- Regenerate this report after each accepted local-full shard to track quality and latency without claiming SOTA.
- Only use combine and full-memory SOTA gates after local-full or full-SOTA intake reports complete non-overlapping shard coverage.
