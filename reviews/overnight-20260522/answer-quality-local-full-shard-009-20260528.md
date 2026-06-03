# Public Benchmark Answer Quality

- Fixture only: false
- Ready for end-to-end memory score gate: true
- Public benchmark claims allowed: false
- Benchmark: longmemeval
- Query count: 500
- Scored query count: 25
- Query shard: 200-225 of 500
- Answer-label hash: sha256:50a91736969984d01a67dfc20daf3f1e62ecfcd658b8f5bafb2513f1e60b6388

## Arms
- bm25-lite: answerQuality=36, correctRate=0.36, p50=7028ms
- full-hybrid-rerank: answerQuality=20, correctRate=0.2, p50=9730ms
- query-expanded-full-hybrid-rerank: answerQuality=20, correctRate=0.2, p50=9274ms
- local-apple-qwen3-0_6b: answerQuality=36, correctRate=0.36, p50=8490ms
- local-apple-qwen3-0_6b-local-rerank: answerQuality=40, correctRate=0.4, p50=8488ms

## Safety
- Metrics only: true
- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false

## Next Actions
- Run benchmark:memory-score:result-gate with this result.
- Send the exact metrics-only packet to independent reviewers before public benchmark wording changes.
