# Query Expansion Benchmark Preflight

- Status: BLOCKED_QUERY_EXPANSION_ENV
- Pure local ready: false
- Mixed local-plus-cloud ready: false
- Sends benchmark text to provider: false

## Blockers
- no-query-expansion-arm-ready

## Candidate Policy
- Label rule: A run with cloud query expansion must be reported as mixed local-plus-cloud, never as pure local.
- Payload rule: Only the current user query may be sent to a query expansion provider; stored memories, raw transcripts, provider keys, and private-tagged content stay out of provider payloads.

## Next Actions
- For pure local: start a local OpenAI-compatible query-expansion endpoint and set SELFMEM_QUERY_EXPANSION_BASE_URL plus SELFMEM_QUERY_EXPANSION_MODEL.
- For mixed cloud: set RECALLWEAVE_QUERY_EXPANSION_CALLS=1, RECALLWEAVE_QUERY_EXPANSION_PUBLIC_DATA=1, and an env-only provider key or key file.
- Keep query expansion off by default until a same-data canary wins and reviewers approve the exact metrics-only packet.
