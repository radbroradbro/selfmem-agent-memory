# Public Benchmark Answer Quality

- Fixture only: false
- Ready for end-to-end memory score gate: true
- Public benchmark claims allowed: false
- Benchmark: longmemeval
- Query count: 30
- Scored query count: 30
- Answer-label hash: sha256:1463b12802582c0bf0dcf1ba9d080bb1bf0a85bad15fd7dd0f4e528342ebae9a

## Arms
- bm25-lite: answerQuality=20, correctRate=0.2, p50=9636ms
- full-hybrid-rerank: answerQuality=26.6667, correctRate=0.2667, p50=10072ms
- query-expanded-full-hybrid-rerank: answerQuality=20, correctRate=0.2, p50=10106ms
- local-apple-qwen3-0_6b: answerQuality=26.6667, correctRate=0.2667, p50=9823ms
- local-apple-qwen3-0_6b-local-rerank: answerQuality=36, correctRate=0.3667, p50=10260ms

## Safety
- Metrics only: true
- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false

## Next Actions
- Run benchmark:memory-score:result-gate with this result.
- Send the exact metrics-only packet to independent reviewers before public benchmark wording changes.
