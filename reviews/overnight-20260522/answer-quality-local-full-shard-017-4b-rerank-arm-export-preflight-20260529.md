# Answer-Quality Response Arm Export

- Status: READY_TO_EXPORT_RESPONSE_ARMS
- Fixture only: false
- Executes exports: false
- Writes private response files: false
- Ready for answer-quality preflight: false
- Counts as full memory SOTA evidence: false
- Calls provider APIs: false
- Sends benchmark text to provider: false
- Query shard requested: true
- Query offset: 400
- Max queries: 25

## Strategy Coverage
- BM25 lite: true
- Full hybrid rerank: true
- Query expansion: true
- Provider challenger: true
- Local Apple: true
- Local rerank: true

## Local Embedding Durability
- Applicable: true
- Required: true
- Ready: true
- Report present: true
- Report: reviews/overnight-20260522/local-embedding-4b-durability-smoke-shard017-20260529.json

## Arms
- bm25-lite: exported=false, responses=0, providerCalls=0, queryExpansionCalls=0, shard=400-n/a
- full-hybrid-rerank: exported=false, responses=0, providerCalls=0, queryExpansionCalls=0, shard=400-n/a
- query-expanded-full-hybrid-rerank: exported=false, responses=0, providerCalls=0, queryExpansionCalls=0, shard=400-n/a
- local-apple-qwen3-4b: exported=false, responses=0, providerCalls=0, queryExpansionCalls=0, shard=400-n/a
- local-apple-qwen3-4b-local-rerank: exported=false, responses=0, providerCalls=0, queryExpansionCalls=0, shard=400-n/a

## Blockers
- none

## Answer-Quality Arm Args
```bash
--arm bm25-lite=<private-output-dir>/bm25-lite-responses.private.json
--arm full-hybrid-rerank=<private-output-dir>/full-hybrid-rerank-responses.private.json
--arm query-expanded-full-hybrid-rerank=<private-output-dir>/query-expanded-full-hybrid-rerank-responses.private.json
--arm local-apple-qwen3-4b=<private-output-dir>/local-apple-qwen3-4b-responses.private.json
--arm local-apple-qwen3-4b-local-rerank=<private-output-dir>/local-apple-qwen3-4b-local-rerank-responses.private.json
```

## Next Actions
- Re-run this command with --execute to write the private response arm files outside the repository.
- Keep the generated response files private; only commit metrics-only hashes and aggregate evidence.
- Then run benchmark:answer-quality:preflight before answer-quality model scoring.
