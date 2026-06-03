# Local-Full Shard 002 Runtime Blocker

- Status: BLOCKED_LOCAL_FULL_SHARD_RUNTIME
- Claim scope: local-full
- Accepted shard: false
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false
- Query shard: 25-50 of 500
- Completed private arms: 3
- Missing private arms: 2
- Failed arm: local-apple-qwen3-0_6b
- Failure class: local-embedding-server-socket-close
- Public synthetic reproduction: true

## Completed Arms

- bm25-lite: responses=25, providerCalls=0, queryExpansionCalls=0
- full-hybrid-rerank: responses=25, providerCalls=0, queryExpansionCalls=0
- query-expanded-full-hybrid-rerank: responses=25, providerCalls=25, queryExpansionCalls=25

## Blockers

- local-apple-embedding-server-socket-close
- local-full-shard-002-incomplete
- local-full-shard-coverage-incomplete

## Notes

Shard 002 did not produce a complete five-arm response packet. The local Apple
embedding arm failed with a socket-close from the local embedding service, and
the same failure reproduced on a public synthetic embedding smoke without
private benchmark text. Keep shard 002 out of local-full intake until the local
embedding runtime passes a long-input durability smoke and all five private arm
files exist for the same shard.
