# Answer-Quality Method-Ladder Result Gate

- Status: BLOCKED_ANSWER_QUALITY_METHOD_LADDER_RESULT
- Counts as method-ladder evidence: false
- Counts as full-memory SOTA evidence: false
- Baseline: session-v1
- Minimum challenger delta: 1
- Total failure rate: 0.00222
- Reason: Method-ladder result is missing, unsafe, unscored, not same-shard, or does not prove a challenger over the session baseline.

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

- winning-arm-has-too-many-call-failures

## Next Actions

- Re-run the method ladder with the same raw query selection, answer-quality execution enabled, and failure accounting enabled.
- Keep session-v1 as the baseline and require the challenger winner to beat it before promoting any materializer.
- Do not attach this result to public SOTA claims until the standard full-memory gates pass.
