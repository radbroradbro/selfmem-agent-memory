# Public Benchmark Answer Quality

- Fixture only: false
- Ready for end-to-end memory score gate: true
- Public benchmark claims allowed: false
- Benchmark: longmemeval
- Query count: 500
- Scored query count: 25
- Query shard: 100-125 of 500
- Answer-label hash: sha256:50a91736969984d01a67dfc20daf3f1e62ecfcd658b8f5bafb2513f1e60b6388

## Arms
- bm25-lite: answerQuality=28, correctRate=0.28, p50=7269ms
- full-hybrid-rerank: answerQuality=24, correctRate=0.24, p50=9208ms
- query-expanded-full-hybrid-rerank: answerQuality=24, correctRate=0.24, p50=11725ms
- wiki-title-amplified-hybrid: answerQuality=4, correctRate=0.04, p50=10278ms
- wiki-subtopic-amplified-hybrid: answerQuality=28, correctRate=0.28, p50=9045ms
- wiki-summary-session-hybrid: answerQuality=16, correctRate=0.16, p50=8881ms
- local-apple-qwen3-0_6b: answerQuality=16, correctRate=0.16, p50=9479ms
- local-apple-qwen3-0_6b-local-rerank: answerQuality=36, correctRate=0.36, p50=9675ms

## Safety
- Metrics only: true
- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false

## Next Actions
- Run benchmark:memory-score:result-gate with this result.
- Send the exact metrics-only packet to independent reviewers before public benchmark wording changes.
