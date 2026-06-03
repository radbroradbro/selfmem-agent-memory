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
- Query set hash: sha256:996c752ae05959a6af40ae8ffa104523dcc84eea7959a27041bd24472353fc1f
- Query count: 5
- Selected query count: 5
- Reused control strategies: none
- Expected result refs: 52
- Winner: cloud-nvidia-nv-embed-v1-mistral-rerank
- Provider arm promoted: false
- Provider arm decision: Best provider-backed arm beats both bm25-lite and full-hybrid-rerank on retrieval-proxy quality. Directional only: promotion blocked until paired-query floor and bootstrap confidence gates pass.

## Strategies

| Strategy | Provider arm | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | p50 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bm25-lite | none | 0.2154 | 0.4 | 0.13 | 0.13 | 0.2016 | 17 |
| full-hybrid-rerank | none | 0.1282 | 0.2 | 0.09 | 0.09 | 0.1328 | 36 |
| cloud-gemini2-embed-rerank-proxy | cloud-gemini2-embed-rerank-proxy | 0.1697 | 0.4 | 0.0733 | 0.0733 | 0.132 | 1591 |
| cloud-nvidia-nv-embed-v1-mistral-rerank | cloud-nvidia-nv-embed-v1-mistral-rerank | 0.2874 | 0.6 | 0.1467 | 0.1467 | 0.2564 | 8428 |

## Failed Arms

| Strategy | Failure class | Retryable/provider limit |
| --- | --- | ---: |
| cloud-voyage4-voyage-lite-rerank | provider-rate-limit | true |

## Safety

- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false
- Private output path included: false
