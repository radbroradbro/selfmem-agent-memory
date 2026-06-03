# Answer-Quality Memory Method Ladder

- Execute requested: true
- Ready for execution: true
- Claim scope: model-challenger
- Model match policy: challenger-model-allowed
- Query shard: 0 to 75
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
| session-v1 | 75 | 3427 | 3427 | 0 | 0 | 0 | 252 |
| contextual-source-chunk-v1 | 75 | 3427 | 25398 | 25398 | 0 | 0 | 1283 |
| atomic-memory-v1 | 75 | 3427 | 60550 | 25398 | 0 | 35152 | 1283 |

## Response Arms

| Method | Strategy | Responses | Skipped source-only | Result IDs | Provider calls |
| --- | --- | ---: | ---: | --- | ---: |
| session-v1 | bm25-lite | 75 | 0 | session-or-memory | 0 |
| session-v1 | full-hybrid-rerank | 75 | 0 | session-or-memory | 0 |
| contextual-source-chunk-v1 | bm25-lite | 75 | 0 | source-chunk-or-mixed | 0 |
| contextual-source-chunk-v1 | full-hybrid-rerank | 75 | 0 | source-chunk-or-mixed | 0 |
| atomic-memory-v1 | bm25-lite | 75 | 25398 | source-chunk-or-mixed | 0 |
| atomic-memory-v1 | full-hybrid-rerank | 75 | 25398 | source-chunk-or-mixed | 0 |

## Answer Quality

| Method | Winner | Answer quality | Correct rate | Calls | Answer failures | Judge failures |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| session-v1 | full-hybrid-rerank | 21.7333 | 0.2133 | 300 | 0 | 0 |
| contextual-source-chunk-v1 | bm25-lite | 37.4667 | 0.3467 | 300 | 0 | 1 |
| atomic-memory-v1 | bm25-lite | 33.0667 | 0.32 | 299 | 1 | 0 |

## Next Actions

- Treat contextual-source-chunk-v1 with bm25-lite as the next larger-slice challenger, not as a production default yet.
- Promote only methods that beat session-v1 on the same raw query selection and retain their edge under failure-accounted answer-quality scoring.
- Run the standard result gate and reviewer intake before any public benchmark claim.
