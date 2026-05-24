# Public Benchmark Strategy Compare

- OK: true
- Fixture only: false
- Benchmark: longmemeval
- Retrieval proxy only: true
- MemoryBench answer quality: false
- Public benchmark claims allowed: false
- Query set hash: sha256:6a7b0da2db62f83beabb6e9cfc27910c47f122289bd7ece9a0d3c8ddfdcde24c
- Query count: 6
- Expected result refs: 18
- Winner: bm25-lite

## Strategies

| Strategy | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | p50 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| jaccard | 0.1089 | 0.1667 | 0.0833 | 0.0833 | 0.1022 | 75 |
| bm25-lite | 0.4541 | 0.8333 | 0.2917 | 0.2917 | 0.3996 | 84 |
| hybrid-v1 | 0.4541 | 0.8333 | 0.2917 | 0.2917 | 0.3996 | 267 |

## Safety

- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false
- Private output path included: false
