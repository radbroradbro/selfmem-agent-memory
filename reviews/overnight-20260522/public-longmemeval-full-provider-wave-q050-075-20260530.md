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
- Expected result refs: 1896
- Winner: cloud-nvidia-nemotron-1b
- Provider arm beats control: true
- Provider arm decision: Best provider-backed arm beats both bm25-lite and full-hybrid-rerank on retrieval-proxy quality.

## Strategies

| Strategy | Provider arm | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | p50 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bm25-lite | none | 0.0064 | 0.012 | 0.004 | 0.004 | 0.0056 | 0 |
| full-hybrid-rerank | none | 0.0077 | 0.014 | 0.005 | 0.005 | 0.0068 | 0 |
| cloud-nvidia-nemotron-1b | cloud-nvidia-nemotron-1b | 0.009 | 0.016 | 0.006 | 0.006 | 0.008 | 0 |
| cloud-nvidia-nemotron-vl-1b | cloud-nvidia-nemotron-vl-1b | 0 | 0 | 0 | 0 | 0 | 0 |

## Failed Arms

| Strategy | Failure class | Retryable/provider limit |
| --- | --- | ---: |
| cloud-nvidia-e5-mistral | strategy-arm-failed | false |
| cloud-gemini2-embed-rerank-proxy | strategy-arm-failed | false |
| cloud-voyage4-voyage-lite-rerank | provider-rate-limit | true |

## Safety

- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false
- Private output path included: false
