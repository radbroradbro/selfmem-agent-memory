# Answer-Quality Response Arm Export

- Status: EXPORTED_RESPONSE_ARMS
- Claim scope: model-challenger
- Fixture only: false
- Executes exports: true
- Writes private response files: true
- Ready for answer-quality preflight: true
- Counts as full memory SOTA evidence: false
- Calls provider APIs: true
- Sends benchmark text to provider: true
- Query shard requested: true
- Query offset: 0
- Max queries: 25

## Strategy Coverage
- BM25 lite: true
- Full hybrid rerank: true
- Query expansion: true
- Provider challenger: true
- Local Apple: true
- Local rerank: true
- Local sidecars required: false

## Provider Hybrid Contract
- BM25 lexical floor required: true
- Full hybrid control required: true
- Same-shard controls required: true
- Provider challengers are hybrid context arms: true
- Provider-only dense claims allowed: false
- Provider challenger controls present: true
- Cloud provider strategies: cloud-gemini2-embed-rerank-proxy, cloud-nvidia-nv-embed-v1-mistral-rerank, cloud-voyage4-voyage-lite-rerank

## Provider Execution Policy
- Throttle scope: provider
- Key-scoped throttle enabled: false
- Retry attempts: 2
- Timeout ms: 45000
- Global min interval ms: 0
- gemini: minIntervalMs=1000
- local-apple: minIntervalMs=0
- local-rerank: minIntervalMs=0
- nvidia: minIntervalMs=1500
- voyage: minIntervalMs=250

## Local Embedding Durability
- Applicable: true
- Required: false
- Ready: n/a
- Report present: true
- Report: n/a

## Arms
- bm25-lite: exported=true, responses=25, providerCalls=0, queryExpansionCalls=0, shard=0-25
- dense-proxy: exported=true, responses=25, providerCalls=0, queryExpansionCalls=0, shard=0-25
- full-hybrid-rerank: exported=true, responses=25, providerCalls=0, queryExpansionCalls=0, shard=0-25
- query-expanded-full-hybrid-rerank: exported=true, responses=25, providerCalls=0, queryExpansionCalls=0, shard=0-25
- cloud-gemini2-embed-rerank-proxy: exported=true, responses=25, providerCalls=50, queryExpansionCalls=0, shard=0-25
- cloud-voyage4-voyage-lite-rerank: exported=true, responses=25, providerCalls=75, queryExpansionCalls=0, shard=0-25
- cloud-nvidia-nv-embed-v1-mistral-rerank: exported=true, responses=25, providerCalls=75, queryExpansionCalls=0, shard=0-25
- local-apple-qwen3-0_6b: exported=true, responses=25, providerCalls=365, queryExpansionCalls=0, shard=0-25
- local-apple-qwen3-0_6b-local-rerank: exported=true, responses=25, providerCalls=50, queryExpansionCalls=0, shard=0-25

## Blockers
- none

## Answer-Quality Arm Args
```bash
--arm bm25-lite=<private-output-dir>/bm25-lite-responses.private.json
--arm dense-proxy=<private-output-dir>/dense-proxy-responses.private.json
--arm full-hybrid-rerank=<private-output-dir>/full-hybrid-rerank-responses.private.json
--arm query-expanded-full-hybrid-rerank=<private-output-dir>/query-expanded-full-hybrid-rerank-responses.private.json
--arm cloud-gemini2-embed-rerank-proxy=<private-output-dir>/cloud-gemini2-embed-rerank-proxy-responses.private.json
--arm cloud-voyage4-voyage-lite-rerank=<private-output-dir>/cloud-voyage4-voyage-lite-rerank-responses.private.json
--arm cloud-nvidia-nv-embed-v1-mistral-rerank=<private-output-dir>/cloud-nvidia-nv-embed-v1-mistral-rerank-responses.private.json
--arm local-apple-qwen3-0_6b=<private-output-dir>/local-apple-qwen3-0_6b-responses.private.json
--arm local-apple-qwen3-0_6b-local-rerank=<private-output-dir>/local-apple-qwen3-0_6b-local-rerank-responses.private.json
```

## Next Actions
- Run benchmark:answer-quality:preflight with these arm files and the private materialized query set, memories, and answer labels.
- Run benchmark:answer-quality only after the preflight passes and answer-quality model-call consent is explicit.
- Attach the metrics-only answer-quality result to benchmark:memory-score:result-gate --require-ready.
