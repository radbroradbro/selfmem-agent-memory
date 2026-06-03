# Answer-Quality Memory Method Ladder

- Execute requested: true
- Ready for execution: true
- Claim scope: model-challenger
- Model match policy: challenger-model-allowed
- Query shard: 75 to 100
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
| session-v1 | 25 | 1178 | 1178 | 0 | 0 | 0 | 100 |
| contextual-source-chunk-v1 | 25 | 1178 | 8667 | 8667 | 0 | 0 | 516 |

## Response Arms

| Method | Strategy | Responses | Skipped source-only | Result IDs | Provider calls |
| --- | --- | ---: | ---: | --- | ---: |
| session-v1 | bm25-lite | 25 | 0 | session-or-memory | 0 |
| session-v1 | full-hybrid-rerank | 25 | 0 | session-or-memory | 0 |
| contextual-source-chunk-v1 | bm25-lite | 25 | 0 | source-chunk-or-mixed | 0 |
| contextual-source-chunk-v1 | full-hybrid-rerank | 25 | 0 | source-chunk-or-mixed | 0 |

## Answer Quality

| Method | Winner | Answer quality | Correct rate | Calls | Answer failures | Judge failures |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| session-v1 | bm25-lite | 24 | 0.24 | 100 | 0 | 0 |
| contextual-source-chunk-v1 | bm25-lite | 36 | 0.36 | 100 | 0 | 0 |

## Next Actions

- Treat contextual-source-chunk-v1 with bm25-lite as the next larger-slice challenger, not as a production default yet.
- Promote only methods that beat session-v1 on the same raw query selection and retain their edge under failure-accounted answer-quality scoring.
- Run the standard result gate and reviewer intake before any public benchmark claim.
