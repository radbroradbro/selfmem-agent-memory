# Full-Shard Accepted Lane Launch Doctor

- Status: BLOCKED_ACCEPTED_LANE_SHARD_LAUNCH
- Claim scope: full-sota
- Ready for first accepted shard run: false
- Ready for public SOTA claim: false
- Ready for local-full benchmark result: false
- Counts as full memory SOTA evidence: false
- Query count: 500
- Shards: 20
- Accepted lane: full-sota-accepted-shards
- Progress source: checked-in-progress-intake
- Progress inputs: 0
- Pending shards: 20

## Gate
- Private inputs ready: true
- Response export ready: false
- Answer-quality scoring ready: false
- Shard results returned: false
- Full memory SOTA score proven: false

## Accepted Lane
- Strategies: bm25-lite, full-hybrid-rerank, query-expanded-full-hybrid-rerank, cloud-voyage4-voyage-lite-rerank, cloud-nvidia-nemotron-1b, local-apple-qwen3-0_6b, local-apple-qwen3-0_6b-local-rerank
- Providers: local-apple, local-rerank, nvidia, voyage
- Query expansion requirement: local-or-cloud-model-required
- Query expansion model-backed: false
- Diagnostic fallback allowed: false
- Answer model target: gpt-4o
- Judge model target: gpt-4o

## Operator Inputs Needed
- response-export-consent: RECALLWEAVE_BASELINE_LIVE, RECALLWEAVE_BASELINE_NO_RAW_TEXT
- local-apple-readiness: SELFMEM_LOCAL_EMBED_BASE_URL
- local-rerank-readiness: SELFMEM_LOCAL_RERANK_ENDPOINT, SELFMEM_LOCAL_RERANK_BASE_URL
- nvidia-readiness: NVIDIA_API_KEY, NVIDIA_API_KEYS, NVAPI_KEY, NVAPI_KEYS, NVIDIA_API_KEY_FILE, NVIDIA_API_KEYS_FILE, NVAPI_KEY_FILE, NVAPI_KEYS_FILE
- voyage-readiness: VOYAGE_API_KEY, VOYAGE_API_KEYS, VOYAGE_API_KEY_FILE, VOYAGE_API_KEYS_FILE
- provider-response-arms: RECALLWEAVE_PROVIDER_BENCHMARK_CALLS, RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA
- answer-quality-scoring: RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS, RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA, RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT, RECALLWEAVE_MEMORYBENCH_BASE_URL, RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL, RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL
- query-expansion-evidence: SELFMEM_QUERY_EXPANSION_BASE_URL, SELFMEM_QUERY_EXPANSION_MODEL, RECALLWEAVE_QUERY_EXPANSION_CALLS, RECALLWEAVE_QUERY_EXPANSION_PUBLIC_DATA

## Blockers
- RECALLWEAVE_BASELINE_LIVE-not-enabled
- RECALLWEAVE_BASELINE_NO_RAW_TEXT-not-confirmed
- RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS-not-enabled
- RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT-not-confirmed
- RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA-not-confirmed
- RECALLWEAVE_PROVIDER_BENCHMARK_CALLS-not-enabled
- RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA-not-confirmed
- answer-model-missing
- judge-model-missing
- local-apple-credentials-missing
- local-rerank-credentials-missing
- nvidia-credentials-missing
- openai-compatible-base-url-missing
- query-expansion-local-endpoint-or-cloud-consent-missing
- voyage-credentials-missing
- accepted-lane-response-export-not-ready
- accepted-lane-answer-quality-scoring-not-ready
- full-answer-quality-shard-results-not-returned
- full-memory-sota-score-not-proven
- public-sota-claim-not-allowed

## Next Actions
- Satisfy the private-input doctor, accepted-lane model/provider readiness, answer-quality endpoint, and query-expansion evidence requirements.
- Use local query expansion when available; use cloud query expansion only with explicit public-data and provider-call consent.
- Do not substitute diagnostic BM25/control lanes for the accepted full-SOTA lane.
