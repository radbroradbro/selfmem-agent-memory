# Answer-Quality Method-Ladder Result Gate

- Status: BLOCKED_ANSWER_QUALITY_METHOD_LADDER_RESULT
- Counts as method-ladder evidence: false
- Counts as full-memory SOTA evidence: false
- Baseline: session-v1
- Minimum challenger delta: 1
- Total failure rate: 0
- Reason: Method-ladder result is missing, unsafe, unscored, not same-shard, or does not prove a challenger over the session baseline.

## Comparison

| Role | Method | Winner | Answer quality | Correct rate |
| --- | --- | --- | ---: | ---: |
| Baseline | session-v1 | bm25-lite | 20 | 0.2 |
| Best challenger | contextual-source-chunk-v1 | bm25-lite | 20 | 0.2 |
| Best overall | session-v1 | bm25-lite | 20 | 0.2 |

- Delta vs baseline: 0
- Winning arm failures: 0
- Paired bootstrap available: true
- Paired bootstrap mean delta: 0
- Paired bootstrap 95% lower bound: 0

## Promotion Boundary

- Status: BLOCKED_NEXT_LARGER_SLICE_CHALLENGER
- Scope: next-larger-slice-challenger-only
- Ready for next larger slice: false
- Production default allowed: false
- Public SOTA claim allowed: false
- Challenger: contextual-source-chunk-v1:bm25-lite
- Bootstrap required for promotion: true
- Bootstrap common queries: 5
- Bootstrap lower bound: 0
- Promotion warnings: does-not-promote-production-default; does-not-count-as-full-memory-sota-evidence
- Promotion blockers: method-ladder-evidence-not-ready; promotion-query-count-below-minimum; promotion-paired-bootstrap-mean-delta-below-threshold

## Method Rows

| Method | Winner | Answer quality | Calls | Answer failures | Judge failures |
| --- | --- | ---: | ---: | ---: | ---: |
| session-v1 | bm25-lite | 20 | 10 | 0 | 0 |
| contextual-source-chunk-v1 | bm25-lite | 20 | 10 | 0 | 0 |

## Blockers

- best-challenger-does-not-clear-baseline-delta
- best-overall-method-is-still-baseline

## Next Actions

- Re-run the method ladder with the same raw query selection, answer-quality execution enabled, and failure accounting enabled.
- Keep session-v1 as the baseline and require the challenger winner to beat it before promoting any materializer.
- Do not attach this result to public SOTA claims until the standard full-memory gates pass.
