# Public Benchmark Answer Quality

- Fixture only: false
- Ready for end-to-end memory score gate: true
- Public benchmark claims allowed: false
- Benchmark: longmemeval
- Claim scope: local-full
- Model match policy: local-diagnostic-allowed
- Counts as model-challenger benchmark evidence: false
- Query count: 500
- Scored query count: 25
- Query shard: 275-300 of 500
- Answer-label hash: sha256:50a91736969984d01a67dfc20daf3f1e62ecfcd658b8f5bafb2513f1e60b6388

## Arms
- bm25-lite: answerQuality=23.4, correctRate=0.2, p50=15974ms
- full-hybrid-rerank: answerQuality=17.4, correctRate=0.16, p50=14123ms
- query-expanded-full-hybrid-rerank: answerQuality=19.8, correctRate=0.16, p50=9063ms
- local-apple-qwen3-0_6b: answerQuality=22.76, correctRate=0.16, p50=8925ms
- local-apple-qwen3-0_6b-local-rerank: answerQuality=35.56, correctRate=0.28, p50=8807ms

## Safety
- Metrics only: true
- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false

## Next Actions
- Run benchmark:memory-score:result-gate with this result.
- Send the exact metrics-only packet to independent reviewers before public benchmark wording changes.
