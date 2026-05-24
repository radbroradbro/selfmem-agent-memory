# Public Benchmark Strategy Compare

- OK: true
- Gate: hybrid
- Fixture only: false
- Benchmark: longmemeval
- Retrieval proxy only: true
- MemoryBench answer quality: false
- Public benchmark claims allowed: false
- Query set hash: sha256:6a7b0da2db62f83beabb6e9cfc27910c47f122289bd7ece9a0d3c8ddfdcde24c
- Query count: 6
- Expected result refs: 18
- Winner: bm25-lite
- Hybrid promotion: false
- Hybrid decision: Keep bm25-lite as control/fallback; hybrid-family arm has not earned promotion on this slice.

## Strategies

| Strategy | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | p50 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bm25-lite | 0.4541 | 0.8333 | 0.2917 | 0.2917 | 0.3996 | 16 |
| dense-proxy | 0.1876 | 0.3333 | 0.125 | 0.125 | 0.1673 | 1 |
| sparse-dense-rrf | 0.2664 | 0.5 | 0.1667 | 0.1667 | 0.2323 | 16 |
| sparse-dense-temporal | 0.2664 | 0.5 | 0.1667 | 0.1667 | 0.2323 | 16 |
| sparse-dense-graph-temporal | 0.2664 | 0.5 | 0.1667 | 0.1667 | 0.2323 | 16 |
| full-hybrid-rerank | 0.4541 | 0.8333 | 0.2917 | 0.2917 | 0.3996 | 33 |
| query-expanded-full-hybrid-rerank | 0.4541 | 0.8333 | 0.2917 | 0.2917 | 0.3996 | 33 |

## Safety

- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false
- Private output path included: false
