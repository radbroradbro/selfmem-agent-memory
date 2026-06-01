# Answer-Quality Memory Method Ladder

- Execute requested: true
- Ready for execution: true
- Claim scope: model-challenger
- Model match policy: challenger-model-allowed
- Query shard: 0 to 30
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
| session-v1 | 30 | 1405 | 1405 | 0 | 0 | 0 | 112 |
| contextual-source-chunk-v1 | 30 | 1405 | 10393 | 10393 | 0 | 0 | 605 |
| contextual-index-source-chunk-v1 | 30 | 1405 | 20786 | 10393 | 10393 | 0 | 605 |
| atomic-memory-v1 | 30 | 1405 | 24716 | 10393 | 0 | 14323 | 605 |

## Response Arms

| Method | Strategy | Responses | Skipped source-only | Result IDs | Provider calls |
| --- | --- | ---: | ---: | --- | ---: |
| session-v1 | bm25-lite | 30 | 0 | session-or-memory | 0 |
| session-v1 | full-hybrid-rerank | 30 | 0 | session-or-memory | 0 |
| contextual-source-chunk-v1 | bm25-lite | 30 | 0 | source-chunk-or-mixed | 0 |
| contextual-source-chunk-v1 | full-hybrid-rerank | 30 | 0 | source-chunk-or-mixed | 0 |
| contextual-index-source-chunk-v1 | bm25-lite | 30 | 10393 | source-chunk-or-mixed | 0 |
| contextual-index-source-chunk-v1 | full-hybrid-rerank | 30 | 10393 | source-chunk-or-mixed | 0 |
| atomic-memory-v1 | bm25-lite | 30 | 10393 | source-chunk-or-mixed | 0 |
| atomic-memory-v1 | full-hybrid-rerank | 30 | 10393 | source-chunk-or-mixed | 0 |

## Answer Quality

| Method | Winner | Answer quality | Correct rate | Calls |
| --- | --- | ---: | ---: | ---: |
| session-v1 | full-hybrid-rerank | 23.3333 | 0.2333 | 120 |
| contextual-source-chunk-v1 | bm25-lite | 31.6667 | 0.3 | 119 |
| contextual-index-source-chunk-v1 | bm25-lite | 22.6667 | 0.2 | 120 |
| atomic-memory-v1 | bm25-lite | 28.3333 | 0.2667 | 120 |

## Next Actions

- Use this diagnostic only to decide whether contextual-index-source-chunk-v1 deserves a larger accepted shard.
- Run the standard result gate and reviewer intake before any public benchmark claim.
