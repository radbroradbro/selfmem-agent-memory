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
- Answer-label hash: sha256:f83c98d1c58cd0000466fd54a27248fb49571dd93bf33035ee0a3e7f09668d63

## Arms
- bm25-lite: answerQuality=35.2, correctRate=0.32, p50=2049ms
- full-hybrid-rerank: answerQuality=22, correctRate=0.2, p50=2184ms
- query-expanded-full-hybrid-rerank: answerQuality=22, correctRate=0.2, p50=2055ms
- cloud-gemini2-embed-rerank-proxy: answerQuality=22, correctRate=0.2, p50=2191ms
- cloud-voyage4-voyage-lite-rerank: answerQuality=42, correctRate=0.32, p50=2135ms
- cloud-nvidia-nv-embed-v1-mistral-rerank: answerQuality=36, correctRate=0.28, p50=2164ms

## Safety
- Metrics only: true
- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false

## Next Actions
- Run benchmark:memory-score:result-gate with this result.
- Send the exact metrics-only packet to independent reviewers before public benchmark wording changes.
