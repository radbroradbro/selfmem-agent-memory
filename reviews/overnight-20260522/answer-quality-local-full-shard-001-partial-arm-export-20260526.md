# Local-Full Shard 001 Partial Arm Export

Status: `PARTIAL_LOCAL_FULL_SHARD_EXPORT`

Claim scope: `local-full`

This packet is metrics-only and public-safe. Raw queries, raw answers, raw memories, transcripts, prompts, and private output paths are not included. Raw sources were retained only in the external private run directory.

## Completed Arms

| Strategy | Responses | Query expansion calls | Provider calls | Embedding calls | Rerank calls |
| --- | ---: | ---: | ---: | ---: | ---: |
| `bm25-lite` | 25 | 0 | 0 | 0 | 0 |
| `full-hybrid-rerank` | 25 | 0 | 0 | 0 | 0 |
| `query-expanded-full-hybrid-rerank` | 25 | 25 | 25 | 0 | 0 |
| `local-apple-qwen3-0_6b` | 25 | 0 | 2420 | 2420 | 0 |

The local Qwen embedding arm wrote 2395 cache entries and reused 605 cached entries during the run.

## Blocked Arm

`local-apple-qwen3-0_6b-local-rerank` remains blocked. The current adapter uses a local chat model as a scoring sidecar, and it did not complete the 25-query shard within an interactive run window even after candidate and output caps were reduced. This does not count as accepted shard evidence.

## Harness Findings

- Local query expansion produced usable rewrites, including newline-delimited JSON arrays, after parser hardening.
- Query expansion retries remain model-backed and still fail closed if the provider returns no usable rewrites.
- Response-arm export can now reuse existing private response files after an interrupted run, avoiding repeated work across long local benchmark attempts.

## Next Gate

Do not report SOTA or accepted local-full shard performance from this partial packet. The answer-quality preflight should run only after all five private arm files exist for the same shard, or after the rerank arm is formally reclassified as a slow diagnostic outside the accepted five-arm shard.
