# Answer-Quality Method-Ladder Result Gate

- Status: READY_ANSWER_QUALITY_METHOD_LADDER_CHALLENGER
- Counts as method-ladder evidence: true
- Counts as full-memory SOTA evidence: false
- Baseline: session-v1
- Minimum challenger delta: 1
- Total failure rate: 0.00222
- Reason: Same-shard answer-quality method ladder shows a non-session challenger beating the session baseline under failure-accounted scoring; full memory/SOTA claims still require the remaining gates.

## Comparison

| Role | Method | Winner | Answer quality | Correct rate |
| --- | --- | --- | ---: | ---: |
| Baseline | session-v1 | full-hybrid-rerank | 21.7333 | 0.2133 |
| Best challenger | contextual-source-chunk-v1 | bm25-lite | 37.4667 | 0.3467 |
| Best overall | contextual-source-chunk-v1 | bm25-lite | 37.4667 | 0.3467 |

- Delta vs baseline: 15.7334
- Winning arm failures: 1
- Paired bootstrap available: true
- Paired bootstrap mean delta: 15.7333
- Paired bootstrap 95% lower bound: 8

## Method Rows

| Method | Winner | Answer quality | Calls | Answer failures | Judge failures |
| --- | --- | ---: | ---: | ---: | ---: |
| session-v1 | full-hybrid-rerank | 21.7333 | 300 | 0 | 0 |
| contextual-source-chunk-v1 | bm25-lite | 37.4667 | 300 | 0 | 1 |
| atomic-memory-v1 | bm25-lite | 33.0667 | 299 | 1 | 0 |

## Blockers

- none

## Next Actions

- Use contextual-source-chunk-v1 with bm25-lite as the next larger-slice challenger.
- Carry session-v1, BM25, and full-hybrid controls forward so the next slice can confirm or reject this lift.
- Attach this gate report to the SOTA ladder packet as method-selection evidence only.
