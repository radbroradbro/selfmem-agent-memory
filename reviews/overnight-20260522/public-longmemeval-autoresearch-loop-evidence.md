# Public Benchmark Autoresearch Loop

- OK: true
- Fixture only: false
- Benchmark: longmemeval
- Retrieval proxy only: true
- MemoryBench answer quality: false
- Public benchmark claims allowed: false
- Query set hash: sha256:6a7b0da2db62f83beabb6e9cfc27910c47f122289bd7ece9a0d3c8ddfdcde24c
- Arm count: 24
- Winner: bm25-lite-b800-k5

## Top Arms

| Arm | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | Tokens | p50 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| bm25-lite-b800-k5 | 0.4541 | 0.8333 | 0.2917 | 0.2917 | 0.3996 | 800 | 75 |
| bm25-lite-b800-k10 | 0.4541 | 0.8333 | 0.2917 | 0.2917 | 0.3996 | 800 | 76 |
| hybrid-v1-b800-k5 | 0.4541 | 0.8333 | 0.2917 | 0.2917 | 0.3996 | 800 | 235 |
| hybrid-v1-b800-k10 | 0.4541 | 0.8333 | 0.2917 | 0.2917 | 0.3996 | 800 | 235 |
| bm25-lite-b1200-k5 | 0.4541 | 0.8333 | 0.2917 | 0.2917 | 0.3996 | 1200 | 74 |
| bm25-lite-b1200-k10 | 0.4541 | 0.8333 | 0.2917 | 0.2917 | 0.3996 | 1200 | 75 |
| hybrid-v1-b1200-k5 | 0.4541 | 0.8333 | 0.2917 | 0.2917 | 0.3996 | 1200 | 231 |
| hybrid-v1-b1200-k10 | 0.4541 | 0.8333 | 0.2917 | 0.2917 | 0.3996 | 1200 | 234 |

## Decision

- Use bm25-lite with budget 800 and limit 5 for the next canary arm.
- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Private output path included: false
