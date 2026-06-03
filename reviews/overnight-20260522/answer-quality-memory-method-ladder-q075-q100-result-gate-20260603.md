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
| Baseline | session-v1 | bm25-lite | 24 | 0.24 |
| Best challenger | contextual-source-chunk-v1 | bm25-lite | 36 | 0.36 |
| Best overall | contextual-source-chunk-v1 | bm25-lite | 36 | 0.36 |

- Delta vs baseline: 12
- Winning arm failures: 0
- Paired bootstrap available: true
- Paired bootstrap mean delta: 12
- Paired bootstrap 95% lower bound: -4

## Promotion Boundary

- Status: BLOCKED_NEXT_LARGER_SLICE_CHALLENGER
- Scope: next-larger-slice-challenger-only
- Ready for next larger slice: false
- Production default allowed: false
- Public SOTA claim allowed: false
- Challenger: contextual-source-chunk-v1:bm25-lite
- Bootstrap required for promotion: true
- Bootstrap common queries: 25
- Bootstrap lower bound: -4
- Promotion warnings: does-not-promote-production-default; does-not-count-as-full-memory-sota-evidence
- Promotion blockers: promotion-query-count-below-minimum; promotion-paired-bootstrap-lower-bound-below-threshold

## Method Rows

| Method | Winner | Answer quality | Calls | Answer failures | Judge failures |
| --- | --- | ---: | ---: | ---: | ---: |
| session-v1 | bm25-lite | 24 | 100 | 0 | 0 |
| contextual-source-chunk-v1 | bm25-lite | 36 | 100 | 0 | 0 |

## Blockers

- none

## Next Actions

- Use contextual-source-chunk-v1 with bm25-lite as the next larger-slice challenger.
- Carry session-v1, BM25, and full-hybrid controls forward so the next slice can confirm or reject this lift.
- Attach this gate report to the SOTA ladder packet as method-selection evidence only.
