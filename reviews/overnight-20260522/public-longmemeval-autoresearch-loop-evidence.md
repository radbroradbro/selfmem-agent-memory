# Public Benchmark Autoresearch Loop

- OK: true
- Fixture only: false
- Benchmark: longmemeval
- Retrieval proxy only: true
- MemoryBench answer quality: false
- Public benchmark claims allowed: false
- Solo smoke only: true
- Same-data controls required: true
- Query set hash: sha256:6a7b0da2db62f83beabb6e9cfc27910c47f122289bd7ece9a0d3c8ddfdcde24c
- Arm count: 72
- Winner: bm25-lite-b800-k5

## Top Arms

| Arm | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | Tokens | p50 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| bm25-lite-b800-k5 | 0.4541 | 0.8333 | 0.2917 | 0.2917 | 0.3996 | 800 | 15 |
| bm25-lite-b800-k10 | 0.4541 | 0.8333 | 0.2917 | 0.2917 | 0.3996 | 800 | 16 |
| hybrid-v1-b800-k5 | 0.4541 | 0.8333 | 0.2917 | 0.2917 | 0.3996 | 800 | 21 |
| hybrid-v1-b800-k10 | 0.4541 | 0.8333 | 0.2917 | 0.2917 | 0.3996 | 800 | 23 |
| full-hybrid-rerank-b800-k5 | 0.4541 | 0.8333 | 0.2917 | 0.2917 | 0.3996 | 800 | 32 |
| full-hybrid-rerank-b800-k10 | 0.4541 | 0.8333 | 0.2917 | 0.2917 | 0.3996 | 800 | 32 |
| query-expanded-full-hybrid-rerank-b800-k5 | 0.4541 | 0.8333 | 0.2917 | 0.2917 | 0.3996 | 800 | 32 |
| query-expanded-full-hybrid-rerank-b800-k10 | 0.4541 | 0.8333 | 0.2917 | 0.2917 | 0.3996 | 800 | 32 |

## Decision

- Use bm25-lite with budget 800 and limit 5 for the next canary arm.
- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Private output path included: false
