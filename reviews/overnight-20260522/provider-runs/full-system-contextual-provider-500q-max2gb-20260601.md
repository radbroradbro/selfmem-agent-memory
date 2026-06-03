# Public Benchmark Strategy Compare

- OK: false
- Status: FAILED_ALL_ARMS
- Gate: provider
- Fixture only: false
- Benchmark: longmemeval
- Retrieval proxy only: true
- MemoryBench answer quality: false
- Public benchmark claims allowed: false
- Partial results allowed: true
- Solo smoke only: true
- Same-data controls required: true
- Query set hash: sha256:f6289bfe2c68d4370234ce8194ea2b32fd71f3e93cde984d16f88d2081cec22f
- Query count: 500
- Selected query count: unknown
- Reused control strategies: none
- Expected result refs: 9495
- Winner: none
- Provider arm promoted: false
- Provider arm decision: Missing bm25-lite control, full-hybrid-rerank control, or provider-backed arm.

## Strategies

| Strategy | Provider arm | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | p50 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |

## Failed Arms

| Strategy | Failure class | Retryable/provider limit |
| --- | --- | ---: |
| bm25-lite | arm-timeout | false |
| full-hybrid-rerank | strategy-arm-failed | false |
| query-expanded-full-hybrid-rerank | strategy-arm-failed | false |
| cloud-gemini2-embed-rerank-proxy | strategy-arm-failed | false |
| cloud-voyage4-voyage-lite-rerank | strategy-arm-failed | false |
| cloud-nvidia-nv-embed-v1-mistral-rerank | strategy-arm-failed | false |

## Safety

- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false
- Private output path included: false
