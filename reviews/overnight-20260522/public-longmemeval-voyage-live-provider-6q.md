# Public Benchmark Strategy Compare

- OK: true
- Gate: provider
- Fixture only: false
- Benchmark: longmemeval
- Retrieval proxy only: true
- MemoryBench answer quality: false
- Public benchmark claims allowed: false
- Solo smoke only: true
- Same-data controls required: true
- Query set hash: sha256:6a7b0da2db62f83beabb6e9cfc27910c47f122289bd7ece9a0d3c8ddfdcde24c
- Query count: 6
- Expected result refs: 18
- Winner: cloud-voyage4-voyage
- Provider arm beats control: true
- Provider arm decision: Best provider-backed arm beats bm25-lite on retrieval-proxy quality.

## Strategies

| Strategy | Provider arm | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | p50 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bm25-lite | none | 0.4541 | 0.8333 | 0.2917 | 0.2917 | 0.3996 | 16 |
| full-hybrid-rerank | none | 0.4541 | 0.8333 | 0.2917 | 0.2917 | 0.3996 | 34 |
| cloud-voyage4-voyage | cloud-voyage4-voyage | 0.563 | 1 | 0.375 | 0.375 | 0.5018 | 1874 |

## Safety

- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false
- Private output path included: false
