# Public Benchmark Strategy Compare

- OK: true
- Status: COMPLETED
- Gate: provider
- Fixture only: false
- Benchmark: longmemeval
- Retrieval proxy only: true
- MemoryBench answer quality: false
- Public benchmark claims allowed: false
- Partial results allowed: true
- Solo smoke only: true
- Same-data controls required: true
- Query set hash: sha256:04e10ea57d93b48fe6a7182b30920fe93676d597b91e19c6f7db4f29cbacfa95
- Query count: 500
- Selected query count: 1
- Reused control strategies: none
- Expected result refs: 1896
- Winner: bm25-lite
- Provider arm beats control: false
- Provider arm decision: Keep bm25-lite and full-hybrid-rerank as controls; provider-backed arm has not earned promotion on this slice.

## Strategies

| Strategy | Provider arm | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | p50 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bm25-lite | none | 0 | 0 | 0 | 0 | 0 | 1262 |
| full-hybrid-rerank | none | 0 | 0 | 0 | 0 | 0 | 3505 |
| cloud-nvidia-nv-embed-v1-mistral-rerank | cloud-nvidia-nv-embed-v1-mistral-rerank | 0 | 0 | 0 | 0 | 0 | 19052 |

## Safety

- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false
- Private output path included: false
