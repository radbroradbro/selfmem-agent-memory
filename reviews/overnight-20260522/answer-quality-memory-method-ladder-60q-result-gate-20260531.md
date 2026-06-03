# Answer-Quality Method-Ladder Result Gate

- Status: READY_ANSWER_QUALITY_METHOD_LADDER_CHALLENGER
- Counts as method-ladder evidence: true
- Counts as full-memory SOTA evidence: false
- Baseline: session-v1
- Minimum challenger delta: 1
- Total failure rate: 0
- Reason: Same-shard answer-quality method ladder shows a non-session challenger beating the session baseline under failure-accounted scoring; full memory/SOTA claims still require the remaining gates.

## Comparison

| Role | Method | Winner | Answer quality | Correct rate |
| --- | --- | --- | ---: | ---: |
| Baseline | session-v1 | full-hybrid-rerank | 22.1667 | 0.2167 |
| Best challenger | contextual-source-chunk-v1 | bm25-lite | 37.5 | 0.3667 |
| Best overall | contextual-source-chunk-v1 | bm25-lite | 37.5 | 0.3667 |

- Delta vs baseline: 15.3333
- Winning arm failures: 0
- Paired bootstrap available: false
- Paired bootstrap mean delta: null
- Paired bootstrap 95% lower bound: null

## Method Rows

| Method | Winner | Answer quality | Calls | Answer failures | Judge failures |
| --- | --- | ---: | ---: | ---: | ---: |
| session-v1 | full-hybrid-rerank | 22.1667 | 240 | 0 | 0 |
| contextual-source-chunk-v1 | bm25-lite | 37.5 | 240 | 0 | 0 |
| atomic-memory-v1 | bm25-lite | 35 | 240 | 0 | 0 |

## Blockers

- none

## Next Actions

- Use contextual-source-chunk-v1 with bm25-lite as the next larger-slice challenger.
- Carry session-v1, BM25, and full-hybrid controls forward so the next slice can confirm or reject this lift.
- Attach this gate report to the SOTA ladder packet as method-selection evidence only.
