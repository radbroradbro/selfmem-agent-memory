# Answer-Quality Method-Ladder Result Gate

- Status: BLOCKED_ANSWER_QUALITY_METHOD_LADDER_RESULT
- Counts as method-ladder evidence: false
- Counts as full-memory SOTA evidence: false
- Baseline: session-v1
- Minimum challenger delta: 1
- Total failure rate: 0.000833
- Reason: Method-ladder result is missing, unsafe, unscored, not same-shard, or does not prove a challenger over the session baseline.

## Comparison

| Role | Method | Winner | Answer quality | Correct rate |
| --- | --- | --- | ---: | ---: |
| Baseline | session-v1 | bm25-lite | 23.1667 | 0.2333 |
| Best challenger | contextual-source-chunk-v1 | bm25-lite | 39.8 | 0.38 |
| Best overall | contextual-source-chunk-v1 | bm25-lite | 39.8 | 0.38 |

- Delta vs baseline: 16.6333
- Winning arm failures: 1
- Paired bootstrap available: true
- Paired bootstrap mean delta: 16.6333
- Paired bootstrap 95% lower bound: 10.6

## Promotion Boundary

- Status: BLOCKED_NEXT_LARGER_SLICE_CHALLENGER
- Scope: next-larger-slice-challenger-only
- Ready for next larger slice: false
- Production default allowed: false
- Public SOTA claim allowed: false
- Challenger: contextual-source-chunk-v1:bm25-lite
- Bootstrap required for promotion: true
- Bootstrap common queries: 150
- Bootstrap lower bound: 10.6
- Promotion warnings: winner-arm-has-tolerated-call-failures; this remains challenger-only evidence; does-not-promote-production-default; does-not-count-as-full-memory-sota-evidence
- Promotion blockers: method-ladder-evidence-not-ready; promotion-winner-arm-failure-limit-exceeded

## Method Rows

| Method | Winner | Answer quality | Calls | Answer failures | Judge failures |
| --- | --- | ---: | ---: | ---: | ---: |
| session-v1 | bm25-lite | 23.1667 | 600 | 0 | 0 |
| contextual-source-chunk-v1 | bm25-lite | 39.8 | 600 | 0 | 1 |

## Blockers

- winning-arm-has-too-many-call-failures

## Next Actions

- Re-run the method ladder with the same raw query selection, answer-quality execution enabled, and failure accounting enabled.
- Keep session-v1 as the baseline and require the challenger winner to beat it before promoting any materializer.
- Do not attach this result to public SOTA claims until the standard full-memory gates pass.
