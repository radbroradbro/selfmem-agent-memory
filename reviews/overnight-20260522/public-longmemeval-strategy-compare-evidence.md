# Public Benchmark Strategy Compare

- OK: true
- Gate: strategy
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
- Winner: bm25-lite
- Hybrid promotion: false
- Hybrid decision: Keep bm25-lite as control/fallback; hybrid-family arm has not earned promotion on this slice.

## Strategies

| Strategy | Provider arm | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | p50 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| jaccard | none | 0.1089 | 0.1667 | 0.0833 | 0.0833 | 0.1022 | 6 |
| bm25-lite | none | 0.4541 | 0.8333 | 0.2917 | 0.2917 | 0.3996 | 16 |
| hybrid-v1 | none | 0.4541 | 0.8333 | 0.2917 | 0.2917 | 0.3996 | 21 |

## Safety

- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false
- Private output path included: false
