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
- Query set hash: sha256:04e10ea57d93b48fe6a7182b30920fe93676d597b91e19c6f7db4f29cbacfa95
- Query count: 500
- Selected query count: 5
- Reused control strategies: none
- Expected result refs: 1896
- Winner: bm25-lite
- Provider arm beats control: false
- Provider arm decision: Missing bm25-lite control, full-hybrid-rerank control, or provider-backed arm.

## Strategies

| Strategy | Provider arm | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | p50 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bm25-lite | none | 0.1307 | 0.2 | 0.1 | 0.1 | 0.1226 | 1046 |
| full-hybrid-rerank | none | 0 | 0 | 0 | 0 | 0 | 2854 |

## Failed Arms

| Strategy | Failure class | Retryable/provider limit |
| --- | --- | ---: |
| cloud-gemini2-embed-rerank-proxy | provider-rate-limit | true |
| cloud-voyage4-voyage-lite-rerank | provider-rate-limit | true |
| cloud-nvidia-nv-embed-v1-mistral-rerank | provider-timeout | true |

## Safety

- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false
- Private output path included: false
