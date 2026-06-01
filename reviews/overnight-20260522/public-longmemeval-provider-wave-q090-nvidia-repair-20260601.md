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
- Query set hash: sha256:61cf1784de29e1fd62e36c4854d3279bd0528e598608cadac56623581195edb0
- Query count: 500
- Selected query count: 1
- Reused control strategies: none
- Expected result refs: 21
- Winner: cloud-nvidia-nv-embed-v1-mistral-rerank
- Provider arm promoted: false
- Provider arm decision: Best provider-backed arm beats both bm25-lite and full-hybrid-rerank on retrieval-proxy quality. Directional only: promotion blocked until paired-query floor and bootstrap confidence gates pass.

## Strategies

| Strategy | Provider arm | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | p50 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bm25-lite | none | 0.0585 | 0 | 0.0476 | 0.0476 | 0.1389 | 9 |
| full-hybrid-rerank | none | 0.3288 | 1 | 0.0476 | 0.0476 | 0.2201 | 15 |
| cloud-nvidia-nv-embed-v1-mistral-rerank | cloud-nvidia-nv-embed-v1-mistral-rerank | 0.3873 | 1 | 0.0952 | 0.0952 | 0.359 | 11815 |

## Safety

- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false
- Private output path included: false
