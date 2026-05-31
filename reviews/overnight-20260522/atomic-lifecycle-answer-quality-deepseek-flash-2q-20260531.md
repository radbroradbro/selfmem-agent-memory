# Answer-Quality Memory Method Ladder

- Execute requested: true
- Ready for execution: true
- Claim scope: model-challenger
- Model match policy: challenger-model-allowed
- Query shard: 0 to 2
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
| session-v1 | 2 | 97 | 97 | 0 | 0 | 0 | 8 |
| atomic-memory-v1 | 2 | 97 | 1695 | 706 | 0 | 989 | 42 |

## Response Arms

| Method | Strategy | Responses | Skipped source-only | Result IDs | Provider calls |
| --- | --- | ---: | ---: | --- | ---: |
| session-v1 | bm25-lite | 2 | 0 | session-or-memory | 0 |
| session-v1 | full-hybrid-rerank | 2 | 0 | session-or-memory | 0 |
| atomic-memory-v1 | bm25-lite | 2 | 706 | source-chunk-or-mixed | 0 |
| atomic-memory-v1 | full-hybrid-rerank | 2 | 706 | source-chunk-or-mixed | 0 |

## Answer Quality

| Method | Winner | Answer quality | Correct rate | Calls |
| --- | --- | ---: | ---: | ---: |
| session-v1 | bm25-lite | 0 | 0 | 8 |
| atomic-memory-v1 | full-hybrid-rerank | 50 | 0.5 | 8 |

## Next Actions

- Use this diagnostic only to decide whether contextual-index-source-chunk-v1 deserves a larger accepted shard.
- Run the standard result gate and reviewer intake before any public benchmark claim.
