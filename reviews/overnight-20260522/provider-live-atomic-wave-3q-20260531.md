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
- Query set hash: sha256:78c5653dd9e49a0d222af17ec486acf81145e03acfd54e8d50a1517c6588d0f6
- Query count: 3
- Selected query count: 3
- Reused control strategies: none
- Expected result refs: 61
- Winner: cloud-voyage4-lite-voyage-lite
- Provider arm beats control: true
- Provider arm decision: Best provider-backed arm beats both bm25-lite and full-hybrid-rerank on retrieval-proxy quality.

## Strategies

| Strategy | Provider arm | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | p50 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bm25-lite | none | 0.4188 | 1 | 0.1419 | 0.1419 | 0.3914 | 11 |
| full-hybrid-rerank | none | 0.2838 | 0.6667 | 0.1035 | 0.1035 | 0.2613 | 25 |
| cloud-voyage4-lite-voyage-lite | cloud-voyage4-lite-voyage-lite | 0.4349 | 1 | 0.1452 | 0.1452 | 0.4492 | 837 |
| cloud-nvidia-nv-embed-v1-mistral-rerank | cloud-nvidia-nv-embed-v1-mistral-rerank | 0.4349 | 1 | 0.1452 | 0.1452 | 0.4492 | 14905 |

## Failed Arms

| Strategy | Failure class | Retryable/provider limit |
| --- | --- | ---: |
| cloud-gemini2-voyage-rerank | provider-rate-limit | true |

## Safety

- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false
- Private output path included: false
