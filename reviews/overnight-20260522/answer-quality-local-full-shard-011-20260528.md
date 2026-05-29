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
- Query shard: 250-275 of 500
- Answer-label hash: sha256:50a91736969984d01a67dfc20daf3f1e62ecfcd658b8f5bafb2513f1e60b6388

## Arms
- bm25-lite: answerQuality=27, correctRate=0.24, p50=19850ms
- full-hybrid-rerank: answerQuality=20, correctRate=0.2, p50=18587ms
- query-expanded-full-hybrid-rerank: answerQuality=20, correctRate=0.2, p50=10184ms
- local-apple-qwen3-0_6b: answerQuality=19.2, correctRate=0.2, p50=9825ms
- local-apple-qwen3-0_6b-local-rerank: answerQuality=4, correctRate=0.04, p50=9851ms

## Safety
- Metrics only: true
- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false

## Next Actions
- Run benchmark:memory-score:result-gate with this result.
- Send the exact metrics-only packet to independent reviewers before public benchmark wording changes.
