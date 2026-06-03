# Answer-Quality Memory Method Ladder

- Execute requested: true
- Ready for execution: true
- Claim scope: model-challenger
- Model match policy: challenger-model-allowed
- Answer prompt policy: support-aware-v1
- Query shard: 150 to 155
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
| session-v1 | 5 | 232 | 232 | 0 | 0 | 0 | 16 |
| contextual-source-chunk-v1 | 5 | 232 | 1749 | 1749 | 0 | 0 | 88 |

## Response Arms

| Method | Strategy | Responses | Skipped source-only | Result IDs | Provider calls |
| --- | --- | ---: | ---: | --- | ---: |
| session-v1 | bm25-lite | 5 | 0 | session-or-memory | 0 |
| contextual-source-chunk-v1 | bm25-lite | 5 | 0 | source-chunk-or-mixed | 0 |

## Answer Quality

| Method | Winner | Answer quality | Correct rate | Calls | Answer failures | Judge failures |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| session-v1 | bm25-lite | 20 | 0.2 | 10 | 0 | 0 |
| contextual-source-chunk-v1 | bm25-lite | 20 | 0.2 | 10 | 0 | 0 |

## Next Actions

- Treat session-v1 with bm25-lite as a baseline/control winner for this slice, not as a challenger promotion.
- Do not combine or promote this slice unless the standard result gate proves a non-session challenger beats session-v1 under failure-accounted answer-quality scoring.
- Check answer and judge failure counts before interpreting zero-score or baseline-winning slices as retrieval evidence.
