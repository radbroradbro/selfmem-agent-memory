# Answer-Quality Response Arm Export

- Status: BLOCKED_RESPONSE_ARM_EXPORT_ENV
- Fixture only: false
- Executes exports: false
- Writes private response files: false
- Ready for answer-quality preflight: false
- Counts as full memory SOTA evidence: false
- Calls provider APIs: false
- Sends benchmark text to provider: false
- Query shard requested: false
- Query offset: 0
- Max queries: all

## Strategy Coverage
- BM25 lite: true
- Full hybrid rerank: true
- Query expansion: true
- Provider challenger: true
- Local Apple: true
- Local rerank: true

## Arms
- bm25-lite: exported=false, responses=0, providerCalls=0, queryExpansionCalls=0, shard=0-n/a
- full-hybrid-rerank: exported=false, responses=0, providerCalls=0, queryExpansionCalls=0, shard=0-n/a
- query-expanded-full-hybrid-rerank: exported=false, responses=0, providerCalls=0, queryExpansionCalls=0, shard=0-n/a
- cloud-voyage4-voyage-lite-rerank: exported=false, responses=0, providerCalls=0, queryExpansionCalls=0, shard=0-n/a
- cloud-nvidia-nemotron-1b: exported=false, responses=0, providerCalls=0, queryExpansionCalls=0, shard=0-n/a
- local-apple-qwen3-0_6b: exported=false, responses=0, providerCalls=0, queryExpansionCalls=0, shard=0-n/a
- local-apple-qwen3-0_6b-local-rerank: exported=false, responses=0, providerCalls=0, queryExpansionCalls=0, shard=0-n/a

## Blockers
- RECALLWEAVE_BASELINE_LIVE-not-enabled
- RECALLWEAVE_BASELINE_NO_RAW_TEXT-not-confirmed
- private-queryset-missing
- private-memories-missing
- private-response-output-dir-missing
- RECALLWEAVE_PROVIDER_BENCHMARK_CALLS-not-enabled
- RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA-not-confirmed
- query-expansion-endpoint-or-consent-missing

## Answer-Quality Arm Args
```bash
--arm bm25-lite=<private-output-dir>/bm25-lite-responses.private.json
--arm full-hybrid-rerank=<private-output-dir>/full-hybrid-rerank-responses.private.json
--arm query-expanded-full-hybrid-rerank=<private-output-dir>/query-expanded-full-hybrid-rerank-responses.private.json
--arm cloud-voyage4-voyage-lite-rerank=<private-output-dir>/cloud-voyage4-voyage-lite-rerank-responses.private.json
--arm cloud-nvidia-nemotron-1b=<private-output-dir>/cloud-nvidia-nemotron-1b-responses.private.json
--arm local-apple-qwen3-0_6b=<private-output-dir>/local-apple-qwen3-0_6b-responses.private.json
--arm local-apple-qwen3-0_6b-local-rerank=<private-output-dir>/local-apple-qwen3-0_6b-local-rerank-responses.private.json
```

## Next Actions
- Materialize the source-locked LongMemEval target into a private directory outside the repository.
- Set RECALLWEAVE_BASELINE_LIVE=1 and RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 for live exports.
- Enable provider or local endpoint consent only for the arms being tested.
- Keep BM25, full-hybrid, query-expansion, provider, local Apple, and local rerank arms on the same data.
