# Answer-Quality Response Arm Export

- Status: BLOCKED_RESPONSE_ARM_EXPORT_ENV
- Fixture only: false
- Executes exports: true
- Writes private response files: false
- Ready for answer-quality preflight: false
- Counts as full memory SOTA evidence: false
- Calls provider APIs: true
- Sends benchmark text to provider: true
- Query shard requested: true
- Query offset: 100
- Max queries: 25

## Strategy Coverage
- BM25 lite: false
- Full hybrid rerank: false
- Query expansion: false
- Provider challenger: true
- Local Apple: false
- Local rerank: true

## Local Embedding Durability
- Applicable: false
- Required: false
- Ready: n/a
- Report present: false
- Report: n/a

## Arms
- local-apple-qwen3-0_6b-local-rerank: exported=false, responses=0, providerCalls=0, queryExpansionCalls=0, shard=100-n/a

## Blockers
- bm25-lite-arm-missing
- full-hybrid-rerank-arm-missing
- query-expansion-arm-missing
- local-apple-arm-missing

## Answer-Quality Arm Args
```bash
--arm local-apple-qwen3-0_6b-local-rerank=<private-output-dir>/local-apple-qwen3-0_6b-local-rerank-responses.private.json
```

## Next Actions
- Materialize the source-locked LongMemEval target into a private directory outside the repository.
- Set RECALLWEAVE_BASELINE_LIVE=1 and RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 for live exports.
- Run benchmark:local-embedding:durability before exporting local Apple embedding arms.
- Enable provider or local endpoint consent only for the arms being tested.
- Keep BM25, full-hybrid, query-expansion, provider, local Apple, and local rerank arms on the same data.
