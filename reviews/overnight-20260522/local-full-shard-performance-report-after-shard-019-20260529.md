# Local-Full Shard Performance Report

- Status: PARTIAL_LOCAL_FULL_PERFORMANCE_SNAPSHOT
- Accepted shards: 19/20
- Accepted queries: 475/500
- Coverage: 95%
- Next pending shard: shard-020 (475-500)
- Performance snapshot mature: false
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false

## Best Current Strategy
- Strategy: local-apple-qwen3-0_6b-local-rerank
- Answer quality: 26
- Delta vs BM25: 2.8821
- P50 latency ms: 9376.1053

## Local Apple
- Base answer quality: 21.3368
- Rerank answer quality: 26
- Rerank delta vs base: 4.6632

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
- local-apple-qwen3-0_6b-local-rerank: answerQuality=26; p50=9376.1053; scored=475
- bm25-lite: answerQuality=23.1179; p50=8702.8421; scored=475
- local-apple-qwen3-0_6b: answerQuality=21.3368; p50=10431.0526; scored=475
- full-hybrid-rerank: answerQuality=19.2968; p50=10234.7368; scored=475
- query-expanded-full-hybrid-rerank: answerQuality=19.0442; p50=9413; scored=475

## Blockers
- local-full-coverage-incomplete

## Next Actions
- Finish or rerun shard-020 before treating the next 25-query slice as accepted.
- Regenerate this report after each accepted local-full shard to track quality and latency without claiming SOTA.
- Only use combine and full-memory SOTA gates after local-full or full-SOTA intake reports complete non-overlapping shard coverage.
