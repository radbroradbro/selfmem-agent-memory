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
- bm25-lite: answerQuality=34, correctRate=0.32, p50=2042ms
- dense-proxy: answerQuality=20, correctRate=0.2, p50=1965ms
- full-hybrid-rerank: answerQuality=22, correctRate=0.2, p50=2004ms
- query-expanded-full-hybrid-rerank: answerQuality=22, correctRate=0.2, p50=2039ms
- cloud-gemini2-embed-rerank-proxy: answerQuality=22, correctRate=0.2, p50=2072ms
- cloud-voyage4-voyage-lite-rerank: answerQuality=42, correctRate=0.32, p50=2043ms
- cloud-nvidia-nv-embed-v1-mistral-rerank: answerQuality=33.2, correctRate=0.24, p50=2127ms

## Safety
- Metrics only: true
- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false

## Next Actions
- Run benchmark:memory-score:result-gate with this result.
- Send the exact metrics-only packet to independent reviewers before public benchmark wording changes.
