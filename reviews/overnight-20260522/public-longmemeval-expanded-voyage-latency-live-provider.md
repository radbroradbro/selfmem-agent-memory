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
- Query set hash: sha256:4386f6fa3280951bffd59b5ae81f067905b1905be3575eff56e2b4168c0ccda7
- Query count: 30
- Expected result refs: 92
- Winner: cloud-voyage4-lite-voyage-lite
- Provider arm beats control: true
- Provider arm decision: Best provider-backed arm beats bm25-lite on retrieval-proxy quality.

## Strategies

| Strategy | Provider arm | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | p50 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bm25-lite | none | 0.2506 | 0.4667 | 0.1583 | 0.1583 | 0.2193 | 75 |
| full-hybrid-rerank | none | 0.2289 | 0.4333 | 0.1417 | 0.1417 | 0.1989 | 156 |
| cloud-voyage4-voyage | cloud-voyage4-voyage | 0.304 | 0.5667 | 0.1917 | 0.1917 | 0.2658 | 6659 |
| cloud-voyage4-voyage-lite-rerank | cloud-voyage4-voyage-lite-rerank | 0.304 | 0.5667 | 0.1917 | 0.1917 | 0.2658 | 2251 |
| cloud-voyage4-lite-voyage-lite | cloud-voyage4-lite-voyage-lite | 0.304 | 0.5667 | 0.1917 | 0.1917 | 0.2658 | 1988 |

## Safety

- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false
- Private output path included: false
