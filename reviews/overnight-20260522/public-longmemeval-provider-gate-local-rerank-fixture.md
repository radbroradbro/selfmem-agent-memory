# Public Benchmark Strategy Compare

- OK: true
- Gate: provider
- Fixture only: true
- Benchmark: longmemeval
- Retrieval proxy only: true
- MemoryBench answer quality: false
- Public benchmark claims allowed: false
- Solo smoke only: true
- Same-data controls required: true
- Query set hash: sha256:b7799e94c2ecb91753e1cce69632cebc99a6a9077a2ef6d2bbd768558d6cf8eb
- Query count: 3
- Expected result refs: 3
- Winner: bm25-lite
- Provider arm beats control: false
- Provider arm decision: Keep bm25-lite and full-hybrid-rerank as controls; provider-backed arm has not earned promotion on this slice.

## Strategies

| Strategy | Provider arm | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | p50 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bm25-lite | none | 1 | 1 | 1 | 1 | 1 | 1 |
| full-hybrid-rerank | none | 1 | 1 | 1 | 1 | 1 | 1 |
| local-apple-qwen3-0_6b-local-rerank | local-apple-qwen3-0_6b-local-rerank | 1 | 1 | 1 | 1 | 1 | 1 |

## Safety

- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false
- Private output path included: false
