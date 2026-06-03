# Answer-Quality Method-Ladder Result Gate

- Status: READY_ANSWER_QUALITY_METHOD_LADDER_CHALLENGER
- Counts as method-ladder evidence: true
- Counts as full-memory SOTA evidence: false
- Baseline: session-v1
- Minimum challenger delta: 1
- Total failure rate: 0.004158
- Reason: Same-shard answer-quality method ladder shows a non-session challenger beating the session baseline under failure-accounted scoring; full memory/SOTA claims still require the remaining gates.

## Comparison

| Role | Method | Winner | Answer quality | Correct rate |
| --- | --- | --- | ---: | ---: |
| Baseline | session-v1 | full-hybrid-rerank | 23.3333 | 0.2333 |
| Best challenger | contextual-source-chunk-v1 | bm25-lite | 31.6667 | 0.3 |
| Best overall | contextual-source-chunk-v1 | bm25-lite | 31.6667 | 0.3 |

- Delta vs baseline: 8.3334
- Winning arm failures: 0

## Method Rows

| Method | Winner | Answer quality | Calls | Answer failures | Judge failures |
| --- | --- | ---: | ---: | ---: | ---: |
| session-v1 | full-hybrid-rerank | 23.3333 | 120 | 0 | 0 |
| contextual-source-chunk-v1 | bm25-lite | 31.6667 | 119 | 1 | 0 |
| contextual-index-source-chunk-v1 | bm25-lite | 22.6667 | 120 | 0 | 0 |
| atomic-memory-v1 | bm25-lite | 28.3333 | 120 | 0 | 1 |

## Blockers

- none

## Next Actions

- Use contextual-source-chunk-v1 with bm25-lite as the next larger-slice challenger.
- Carry session-v1, BM25, and full-hybrid controls forward so the next slice can confirm or reject this lift.
- Attach this gate report to the SOTA ladder packet as method-selection evidence only.
