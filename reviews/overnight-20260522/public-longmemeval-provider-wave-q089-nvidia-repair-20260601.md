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
- Query set hash: sha256:c740f67a895be6f2e13f6b6406a3740fa0f142c1af18cf21611429a47a5e11fb
- Query count: 500
- Selected query count: 1
- Reused control strategies: none
- Expected result refs: 21
- Winner: bm25-lite
- Provider arm promoted: false
- Provider arm decision: Keep bm25-lite and full-hybrid-rerank as controls; provider-backed arm has not earned promotion on this slice.

## Strategies

| Strategy | Provider arm | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | p50 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bm25-lite | none | 0.4387 | 1 | 0.1429 | 0.1429 | 0.469 | 9 |
| full-hybrid-rerank | none | 0.3873 | 1 | 0.0952 | 0.0952 | 0.359 | 18 |
| cloud-nvidia-nv-embed-v1-mistral-rerank | cloud-nvidia-nv-embed-v1-mistral-rerank | 0.4387 | 1 | 0.1429 | 0.1429 | 0.469 | 6738 |

## Safety

- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false
- Private output path included: false
