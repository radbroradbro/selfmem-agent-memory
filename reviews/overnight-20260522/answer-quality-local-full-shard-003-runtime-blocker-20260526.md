# Local-Full Shard 003 Runtime Blocker

- Status: BLOCKED_LOCAL_FULL_SHARD_RUNTIME
- Claim scope: local-full
- Accepted shard: false
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false
- Query shard: 50-75 of 500
- Completed private arms: 4
- Missing private arms: 1
- Failed arm: local-apple-qwen3-0_6b-local-rerank
- Failure class: local-rerank-response-body-stall

## Completed Arms

- bm25-lite: responses=25, providerCalls=0, queryExpansionCalls=0
- full-hybrid-rerank: responses=25, providerCalls=0, queryExpansionCalls=0
- query-expanded-full-hybrid-rerank: responses=25, providerCalls=0, queryExpansionFallbacks=25
- local-apple-qwen3-0_6b: responses=25, providerCalls=401, embeddingCalls=401

## Blockers

- local-rerank-response-body-stall
- local-full-shard-003-incomplete
- local-full-shard-coverage-incomplete

## Notes

Shard 003 did not produce a complete five-arm response packet. The local Apple
embedding arm completed, but the local rerank sidecar accepted work without
finishing a response file inside the bounded run window. The response exporter
now keeps local provider response-body parsing under the same abort timeout as
the request, and the rerank launch job was stopped to free local compute.

Keep cloud Voyage as the default personal/Codex memory provider arm. Use local
arms for methodology refinement and plugin benchmark loops, with hosted
Supermemory search disabled unless the run is explicitly a hosted-baseline
parity lane.
