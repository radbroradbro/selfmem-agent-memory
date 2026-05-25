# Answer-Quality Response Arm Export

- Status: EXPORTED_RESPONSE_ARMS
- Fixture only: false
- Executes exports: true
- Writes private response files: true
- Ready for answer-quality preflight: true
- Counts as full memory SOTA evidence: false
- Calls provider APIs: true
- Sends benchmark text to provider: true

## Strategy Coverage
- BM25 lite: true
- Full hybrid rerank: true
- Query expansion: true
- Provider challenger: true
- Local Apple: true
- Local rerank: true

## Arms
- bm25-lite: exported=true, responses=30, providerCalls=0, queryExpansionCalls=0
- full-hybrid-rerank: exported=true, responses=30, providerCalls=0, queryExpansionCalls=0
- query-expanded-full-hybrid-rerank: exported=true, responses=30, providerCalls=30, queryExpansionCalls=30
- local-apple-qwen3-0_6b: exported=true, responses=30, providerCalls=79, queryExpansionCalls=0
- local-apple-qwen3-0_6b-local-rerank: exported=true, responses=30, providerCalls=60, queryExpansionCalls=0

## Blockers
- none

## Answer-Quality Arm Args
```bash
--arm bm25-lite=<private-output-dir>/bm25-lite-responses.private.json
--arm full-hybrid-rerank=<private-output-dir>/full-hybrid-rerank-responses.private.json
--arm query-expanded-full-hybrid-rerank=<private-output-dir>/query-expanded-full-hybrid-rerank-responses.private.json
--arm local-apple-qwen3-0_6b=<private-output-dir>/local-apple-qwen3-0_6b-responses.private.json
--arm local-apple-qwen3-0_6b-local-rerank=<private-output-dir>/local-apple-qwen3-0_6b-local-rerank-responses.private.json
```

## Next Actions
- Run benchmark:answer-quality:preflight with these arm files and the private materialized query set, memories, and answer labels.
- Run benchmark:answer-quality only after the preflight passes and answer-quality model-call consent is explicit.
- Attach the metrics-only answer-quality result to benchmark:memory-score:result-gate --require-ready.
