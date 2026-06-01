# Public Benchmark Answer Quality

- Fixture only: false
- Ready for end-to-end memory score gate: true
- Public benchmark claims allowed: false
- Benchmark: longmemeval
- Claim scope: model-challenger
- Model match policy: challenger-model-allowed
- Counts as model-challenger benchmark evidence: true
- Query count: 500
- Scored query count: 25
- Query shard: 0-25 of 500
- Answer-label hash: sha256:50a91736969984d01a67dfc20daf3f1e62ecfcd658b8f5bafb2513f1e60b6388

## Arms
- bm25-lite: answerQuality=28.4, correctRate=0.24, p50=2478ms
- full-hybrid-rerank: answerQuality=26, correctRate=0.2, p50=2465ms
- query-expanded-full-hybrid-rerank: answerQuality=26, correctRate=0.2, p50=2218ms

## Safety
- Metrics only: true
- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false

## Next Actions
- Run benchmark:memory-score:result-gate with this result.
- Send the exact metrics-only packet to independent reviewers before public benchmark wording changes.
