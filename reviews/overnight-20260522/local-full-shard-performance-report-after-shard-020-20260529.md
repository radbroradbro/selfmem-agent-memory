# Local-Full Shard Performance Report

- Status: COMPLETE_LOCAL_FULL_PERFORMANCE_SNAPSHOT
- Accepted shards: 20/20
- Accepted queries: 500/500
- Coverage: 100%
- Next pending shard: n/a (n/a)
- Performance snapshot mature: true
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false

## Best Current Strategy
- Strategy: local-apple-qwen3-0_6b-local-rerank
- Answer quality: 24.9
- Delta vs BM25: 2.738
- P50 latency ms: 9316.8

## Local Apple
- Base answer quality: 20.67
- Rerank answer quality: 24.9
- Rerank delta vs base: 4.23

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
- local-apple-qwen3-0_6b-local-rerank: answerQuality=24.9; p50=9316.8; scored=500
- bm25-lite: answerQuality=22.162; p50=8618.9; scored=500
- local-apple-qwen3-0_6b: answerQuality=20.67; p50=10334.25; scored=500
- full-hybrid-rerank: answerQuality=18.532; p50=10167.75; scored=500
- query-expanded-full-hybrid-rerank: answerQuality=18.292; p50=9386.85; scored=500

## Blockers
- none

## Next Actions
- No next local-full shard is pending; run shard intake and combine gates before any claim changes.
- Use the combined local-full and memory-score gates as the stable local diagnostic baseline; keep public SOTA claims blocked.
- Only use combine and full-memory SOTA gates after local-full or full-SOTA intake reports complete non-overlapping shard coverage.
