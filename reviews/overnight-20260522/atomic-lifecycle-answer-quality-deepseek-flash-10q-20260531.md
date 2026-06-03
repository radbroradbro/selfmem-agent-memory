# Answer-Quality Memory Method Ladder

- Execute requested: true
- Ready for execution: true
- Claim scope: model-challenger
- Model match policy: challenger-model-allowed
- Query shard: 0 to 10
- Same raw query selection: true
- Claim boundary: same-shard answer-quality method diagnostic; not production or SOTA evidence without the normal gates

## Readiness

- Endpoint present: true
- Endpoint local: false
- Answer model present: true
- Judge model present: true
- Blockers: none

## Materialization

| Method | Queries | Sessions | Records | Source chunks | Index records | Atomic records | Expected refs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| session-v1 | 10 | 494 | 494 | 0 | 0 | 0 | 36 |
| atomic-memory-v1 | 10 | 494 | 8455 | 3562 | 0 | 4893 | 192 |

## Response Arms

| Method | Strategy | Responses | Skipped source-only | Result IDs | Provider calls |
| --- | --- | ---: | ---: | --- | ---: |
| session-v1 | bm25-lite | 10 | 0 | session-or-memory | 0 |
| session-v1 | full-hybrid-rerank | 10 | 0 | session-or-memory | 0 |
| atomic-memory-v1 | bm25-lite | 10 | 3562 | source-chunk-or-mixed | 0 |
| atomic-memory-v1 | full-hybrid-rerank | 10 | 3562 | source-chunk-or-mixed | 0 |

## Answer Quality

| Method | Winner | Answer quality | Correct rate | Calls |
| --- | --- | ---: | ---: | ---: |
| session-v1 | bm25-lite | 10 | 0.1 | 40 |
| atomic-memory-v1 | bm25-lite | 35 | 0.3 | 40 |

## Next Actions

- Use this diagnostic only to decide whether contextual-index-source-chunk-v1 deserves a larger accepted shard.
- Run the standard result gate and reviewer intake before any public benchmark claim.
