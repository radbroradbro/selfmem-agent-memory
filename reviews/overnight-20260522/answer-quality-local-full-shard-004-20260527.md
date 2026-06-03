# Public Benchmark Answer Quality

- Fixture only: false
- Ready for end-to-end memory score gate: true
- Public benchmark claims allowed: false
- Benchmark: longmemeval
- Query count: 500
- Scored query count: 25
- Query shard: 75-100 of 500
- Answer-label hash: sha256:50a91736969984d01a67dfc20daf3f1e62ecfcd658b8f5bafb2513f1e60b6388

## Arms
- bm25-lite: answerQuality=25.2, correctRate=0.24, p50=6986ms
- full-hybrid-rerank: answerQuality=17.6, correctRate=0.16, p50=8215ms
- query-expanded-full-hybrid-rerank: answerQuality=21, correctRate=0.2, p50=9301ms
- local-apple-qwen3-0_6b: answerQuality=22.6, correctRate=0.2, p50=10396ms
- local-apple-qwen3-0_6b-local-rerank: answerQuality=34, correctRate=0.32, p50=10771ms

## Safety
- Metrics only: true
- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false

## Next Actions
- Run benchmark:memory-score:result-gate with this result.
- Send the exact metrics-only packet to independent reviewers before public benchmark wording changes.
