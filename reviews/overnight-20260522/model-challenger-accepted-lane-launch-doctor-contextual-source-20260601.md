# Model-Challenger Accepted Lane Launch Doctor

- Status: BLOCKED_ACCEPTED_LANE_SHARD_LAUNCH
- Claim scope: model-challenger
- Ready for first accepted shard run: false
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
- Answer-quality scoring ready: false
- Shard results returned: false
- Full memory SOTA score proven: false

## Accepted Lane
- Strategies: bm25-lite, full-hybrid-rerank, cloud-gemini2-embed-rerank-proxy, cloud-voyage4-lite-voyage-lite, cloud-nvidia-nv-embed-v1-mistral-rerank
- Providers: gemini, nvidia, voyage
- Query expansion requirement: not-required
- Query expansion model-backed: undefined
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
- answer-quality-scoring: RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS, RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA, RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT, RECALLWEAVE_MEMORYBENCH_BASE_URL, RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL, RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL

## Blockers
- answer-model-missing
- judge-model-missing
- openai-compatible-base-url-missing
- accepted-lane-answer-quality-scoring-not-ready
- model-challenger-answer-quality-shard-results-not-returned

## Next Actions
- Satisfy the private-input doctor, cloud provider credentials, and challenger answer-quality endpoint requirements.
- Keep query expansion as a labeled ablation unless the accepted lane explicitly includes it.
- Do not claim public SOTA from this lane; exact-target full-SOTA evidence remains a separate gate.
