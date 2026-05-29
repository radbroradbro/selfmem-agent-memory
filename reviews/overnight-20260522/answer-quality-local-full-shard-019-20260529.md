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
- Query shard: 450-475 of 500
- Answer-label hash: sha256:50a91736969984d01a67dfc20daf3f1e62ecfcd658b8f5bafb2513f1e60b6388

## Arms
- bm25-lite: answerQuality=12, correctRate=0.12, p50=6951ms
- full-hybrid-rerank: answerQuality=8, correctRate=0.08, p50=8445ms
- query-expanded-full-hybrid-rerank: answerQuality=8, correctRate=0.08, p50=11367ms
- local-apple-qwen3-0_6b: answerQuality=8, correctRate=0.08, p50=12778ms
- local-apple-qwen3-0_6b-local-rerank: answerQuality=8, correctRate=0.08, p50=10429ms

## Safety
- Metrics only: true
- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false

## Next Actions
- Run benchmark:memory-score:result-gate with this result.
- Send the exact metrics-only packet to independent reviewers before public benchmark wording changes.
