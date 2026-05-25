# Public Benchmark Answer Quality

- Fixture only: true
- Ready for end-to-end memory score gate: false
- Public benchmark claims allowed: false
- Benchmark: longmemeval
- Query count: 2
- Scored query count: 2
- Answer-label hash: sha256:ae94858febc7847535f476e767ebf4a3452d1f8354a5b0112149c50c1699e2bf

## Arms
- bm25-lite: answerQuality=100, correctRate=1, p50=3ms
- full-hybrid-rerank: answerQuality=100, correctRate=1, p50=3ms
- query-expanded-full-hybrid-rerank: answerQuality=100, correctRate=1, p50=3ms

## Safety
- Metrics only: true
- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false

## Next Actions
- Run this harness with --live against private materialized LongMemEval inputs and explicit model-call consent.
- Attach the metrics-only answer-quality result to benchmark:memory-score:result-gate.
