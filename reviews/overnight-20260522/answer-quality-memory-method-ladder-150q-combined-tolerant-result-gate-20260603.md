# Answer-Quality Method-Ladder Result Gate

- Status: READY_ANSWER_QUALITY_METHOD_LADDER_CHALLENGER
- Counts as method-ladder evidence: true
- Counts as full-memory SOTA evidence: false
- Baseline: session-v1
- Minimum challenger delta: 1
- Total failure rate: 0.000833
- Reason: Same-shard answer-quality method ladder shows a non-session challenger beating the session baseline under failure-accounted scoring; full memory/SOTA claims still require the remaining gates.

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

- Status: READY_NEXT_LARGER_SLICE_CHALLENGER
- Scope: next-larger-slice-challenger-only
- Ready for next larger slice: true
- Production default allowed: false
- Public SOTA claim allowed: false
- Challenger: contextual-source-chunk-v1:bm25-lite
- Bootstrap required for promotion: true
- Bootstrap common queries: 150
- Bootstrap lower bound: 10.6
- Promotion warnings: winner-arm-has-tolerated-call-failures; this remains challenger-only evidence; does-not-promote-production-default; does-not-count-as-full-memory-sota-evidence
- Promotion blockers: none

## Method Rows

| Method | Winner | Answer quality | Calls | Answer failures | Judge failures |
| --- | --- | ---: | ---: | ---: | ---: |
| session-v1 | bm25-lite | 23.1667 | 600 | 0 | 0 |
| contextual-source-chunk-v1 | bm25-lite | 39.8 | 600 | 0 | 1 |

## Blockers

- none

## Next Actions

- Use contextual-source-chunk-v1 with bm25-lite as the next larger-slice challenger.
- Carry session-v1, BM25, and full-hybrid controls forward so the next slice can confirm or reject this lift.
- Attach this gate report to the SOTA ladder packet as method-selection evidence only.
