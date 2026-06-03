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
- Query shard: 400-425 of 500
- Answer-label hash: sha256:50a91736969984d01a67dfc20daf3f1e62ecfcd658b8f5bafb2513f1e60b6388

## Arms
- bm25-lite: answerQuality=8, correctRate=0.08, p50=6476ms
- full-hybrid-rerank: answerQuality=8, correctRate=0.08, p50=8938ms
- query-expanded-full-hybrid-rerank: answerQuality=8, correctRate=0.08, p50=9327ms
- local-apple-qwen3-0_6b: answerQuality=4, correctRate=0.04, p50=9429ms
- local-apple-qwen3-0_6b-local-rerank: answerQuality=4, correctRate=0.04, p50=9024ms

## Safety
- Metrics only: true
- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false

## Next Actions
- Run benchmark:memory-score:result-gate with this result.
- Send the exact metrics-only packet to independent reviewers before public benchmark wording changes.
