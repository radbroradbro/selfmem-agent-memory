# Local-Full Accepted Lane Launch Doctor

- Status: BLOCKED_ACCEPTED_LANE_SHARD_LAUNCH
- Claim scope: local-full
- Ready for first accepted shard run: false
- Ready for public SOTA claim: false
- Ready for local-full benchmark result: false
- Ready for model-challenger benchmark result: false
- Counts as full memory SOTA evidence: false
- Query count: 500
- Shards: 20
- Accepted lane: local-full-accepted-shards
- Progress source: checked-in-progress-intake
- Progress inputs: 2
- Pending shards: 20

## Gate
- Private inputs ready: true
- Response export ready: false
- Answer-quality scoring ready: false
- Shard results returned: false
- Full memory SOTA score proven: false

## Accepted Lane
- Strategies: bm25-lite, full-hybrid-rerank, local-apple-qwen3-0_6b, local-apple-qwen3-0_6b-local-rerank
- Providers: local-apple, local-rerank
- Query expansion requirement: not-required
- Query expansion model-backed: undefined
- Diagnostic fallback allowed: false
- Model match policy: local-diagnostic-allowed
- Benchmark answer model target: gpt-4o
- Benchmark judge model target: gpt-4o

## Local Runtime Health
- Ready for response-arm export: false
- Local Apple required: true
- Local Apple configured: false
- Local Apple reachable: false
- Local rerank required: true
- Local rerank configured: false
- Local rerank reachable: false
- Endpoint values printed: false

## Operator Inputs Needed
- response-export-consent: RECALLWEAVE_BASELINE_LIVE, RECALLWEAVE_BASELINE_NO_RAW_TEXT
- local-apple-readiness: SELFMEM_LOCAL_EMBED_BASE_URL
- local-rerank-readiness: SELFMEM_LOCAL_RERANK_ENDPOINT, SELFMEM_LOCAL_RERANK_BASE_URL
- answer-quality-scoring: RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS, RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA, RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT, RECALLWEAVE_MEMORYBENCH_BASE_URL, RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL, RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL

## Blockers
- RECALLWEAVE_BASELINE_LIVE-not-enabled
- RECALLWEAVE_BASELINE_NO_RAW_TEXT-not-confirmed
- RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS-not-enabled
- RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT-not-confirmed
- RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA-not-confirmed
- answer-model-missing
- judge-model-missing
- local-apple-credentials-missing
- local-rerank-credentials-missing
- openai-compatible-base-url-missing
- local-apple-endpoint-missing
- local-rerank-endpoint-missing
- accepted-lane-response-export-not-ready
- accepted-lane-answer-quality-scoring-not-ready
- local-full-answer-quality-shard-results-not-returned

## Next Actions
- Satisfy the private-input doctor, local embedding, local rerank, and answer-quality endpoint requirements.
- Keep query expansion as a labeled ablation unless the accepted lane explicitly includes it.
- Do not substitute BM25, deterministic expansion, or provider-only lanes for the accepted local-full lane.
