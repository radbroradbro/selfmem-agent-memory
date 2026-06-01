# Public Benchmark Strategy Compare

- OK: false
- Status: PARTIAL_COMPLETED_WITH_ARM_FAILURES
- Gate: provider
- Fixture only: false
- Benchmark: longmemeval
- Retrieval proxy only: true
- MemoryBench answer quality: false
- Public benchmark claims allowed: false
- Partial results allowed: true
- Solo smoke only: true
- Same-data controls required: true
- Query set hash: sha256:15b1f211048f47a7bbcfccf0274aa09b36aa130129c469145788e14ff26746d6
- Query count: 5
- Selected query count: 5
- Reused control strategies: none
- Expected result refs: 101
- Winner: cloud-nvidia-nv-embed-v1-mistral-rerank
- Provider arm promoted: false
- Provider arm decision: Best provider-backed arm beats both bm25-lite and full-hybrid-rerank on retrieval-proxy quality. Directional only: promotion blocked until paired-query floor and bootstrap confidence gates pass.

## Strategies

| Strategy | Provider arm | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | p50 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bm25-lite | none | 0.3656 | 0.8 | 0.1409 | 0.1409 | 0.3804 | 17 |
| full-hybrid-rerank | none | 0.3265 | 0.8 | 0.1012 | 0.1012 | 0.3034 | 37 |
| query-expanded-full-hybrid-rerank | none | 0.3265 | 0.8 | 0.1012 | 0.1012 | 0.3034 | 1609 |
| cloud-gemini2-embed-rerank-proxy | cloud-gemini2-embed-rerank-proxy | 0.3145 | 0.8 | 0.0907 | 0.0907 | 0.2764 | 1245 |
| cloud-nvidia-nv-embed-v1-mistral-rerank | cloud-nvidia-nv-embed-v1-mistral-rerank | 0.4289 | 1 | 0.1471 | 0.1471 | 0.4213 | 12076 |

## Failed Arms

| Strategy | Failure class | Summary | Retryable/provider limit |
| --- | --- | --- | ---: |
| cloud-voyage4-voyage-lite-rerank | provider-rate-limit | node packages/bench/recallweave-response-export.mjs --live --queryset <private-path> --memories <private-path> --preserve-ids --strategy cloud-voyage4-voyage-lite-rerank --context-token-budget 1400 --limit 5 --max-memory-bytes 2000000000 -- | true |

## Safety

- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false
- Private output path included: false
