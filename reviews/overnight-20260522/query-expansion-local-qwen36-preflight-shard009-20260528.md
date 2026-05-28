# Query Expansion Benchmark Preflight

- Status: PURE_LOCAL_QUERY_EXPANSION_READY
- Pure local ready: true
- Mixed local-plus-cloud ready: false
- Sends benchmark text to provider: false
- Live LLM wiring present: true

## Blockers
- none

## Candidate Policy
- Label rule: A run with cloud query expansion must be reported as mixed local-plus-cloud, never as pure local.
- Payload rule: Only the current user query may be sent to a query expansion provider; stored memories, raw transcripts, provider keys, and private-tagged content stay out of provider payloads.

## Next Actions
- Run query-expanded-full-hybrid-rerank as a pure local query-expansion arm on the same source-locked target.
- Report query expansion latency separately from embedding and rerank latency.
- Compare against bm25-lite, dense/vector-only, full-hybrid-rerank, and provider arms before promotion.
