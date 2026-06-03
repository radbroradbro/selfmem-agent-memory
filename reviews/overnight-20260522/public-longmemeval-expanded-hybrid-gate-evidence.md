# Public Benchmark Strategy Compare

- OK: true
- Gate: hybrid
- Fixture only: false
- Benchmark: longmemeval
- Retrieval proxy only: true
- MemoryBench answer quality: false
- Public benchmark claims allowed: false
- Query set hash: sha256:4386f6fa3280951bffd59b5ae81f067905b1905be3575eff56e2b4168c0ccda7
- Query count: 30
- Expected result refs: 92
- Winner: bm25-lite
- Hybrid promotion: false
- Hybrid decision: Keep bm25-lite as control/fallback; hybrid-family arm has not earned promotion on this slice.

## Strategies

| Strategy | Provider arm | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | p50 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bm25-lite | none | 0.2506 | 0.4667 | 0.1583 | 0.1583 | 0.2193 | 180 |
| dense-proxy | none | 0.0533 | 0.1 | 0.0333 | 0.0333 | 0.0465 | 2 |
| sparse-dense-rrf | none | 0.1024 | 0.1667 | 0.075 | 0.075 | 0.0928 | 202 |
| sparse-dense-temporal | none | 0.1339 | 0.2333 | 0.0917 | 0.0917 | 0.1188 | 198 |
| sparse-dense-graph-temporal | none | 0.1756 | 0.3333 | 0.1083 | 0.1083 | 0.1524 | 222 |
| full-hybrid-rerank | none | 0.2289 | 0.4333 | 0.1417 | 0.1417 | 0.1989 | 417 |
| query-expanded-full-hybrid-rerank | none | 0.1756 | 0.3333 | 0.1083 | 0.1083 | 0.1524 | 383 |

## Safety

- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false
- Private output path included: false
