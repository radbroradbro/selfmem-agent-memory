# Model-Challenger Accepted Lane Launch Doctor

- Status: READY_FOR_ACCEPTED_LANE_SHARD_LAUNCH
- Claim scope: model-challenger
- Ready for first accepted shard run: true
- Ready for public SOTA claim: false
- Ready for local-full benchmark result: false
- Ready for model-challenger benchmark result: false
- Counts as full memory SOTA evidence: false
- Query count: 500
- Shards: 20
- Accepted lane: model-challenger-accepted-shards
- Progress source: no-progress-inputs
- Progress inputs: 0
- Pending shards: 20

## Gate
- Private inputs ready: true
- Response export ready: true
- Answer-quality scoring ready: true
- Shard results returned: false
- Full memory SOTA score proven: false

## Accepted Lane
- Strategies: bm25-lite, full-hybrid-rerank, query-expanded-full-hybrid-rerank, cloud-gemini2-embed-rerank-proxy, cloud-voyage4-voyage-lite-rerank, cloud-nvidia-nv-embed-v1-mistral-rerank
- Providers: gemini, nvidia, voyage
- Query expansion requirement: local-or-cloud-model-required
- Query expansion model-backed: true
- Diagnostic fallback allowed: false
- Model match policy: challenger-model-allowed
- Benchmark answer model target: gpt-4o
- Benchmark judge model target: gpt-4o

## Local Runtime Health
- Ready for response-arm export: true
- Local Apple required: false
- Local Apple configured: false
- Local Apple reachable: true
- Local rerank required: false
- Local rerank configured: false
- Local rerank reachable: true
- Endpoint values printed: false

## Operator Inputs Needed
- none

## Blockers
- model-challenger-answer-quality-shard-results-not-returned

## Next Actions
- Run the accepted model-challenger shard commands into an outside-repository private output directory.
- Commit only public-safe shard result JSON and markdown after answer-quality scoring completes.
- Treat the completed result as challenger-model benchmark evidence only; public SOTA and production-replacement claims still require exact-target full-SOTA gates.
