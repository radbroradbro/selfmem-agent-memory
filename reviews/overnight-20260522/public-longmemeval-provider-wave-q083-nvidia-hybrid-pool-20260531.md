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
- Selected query count: 1
- Reused control strategies: bm25-lite, full-hybrid-rerank
- Expected result refs: 1896
- Winner: bm25-lite
- Provider arm beats control: false
- Provider arm decision: Missing bm25-lite control, full-hybrid-rerank control, or provider-backed arm.

## Strategies

| Strategy | Provider arm | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | p50 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bm25-lite | none | 0 | 0 | 0 | 0 | 0 | 1243 |
| full-hybrid-rerank | none | 0 | 0 | 0 | 0 | 0 | 4799 |

## Reused Controls

| Strategy | Source report | Source report hash |
| --- | --- | --- |
| bm25-lite | reviews/overnight-20260522/public-longmemeval-full-provider-wave-q083-nvidia-mitigated-20260531.json | sha256:7436ed29744e3700c0feacf4ba3f2c189aee5ba262ee5b7eaf71c5202dfe079e |
| full-hybrid-rerank | reviews/overnight-20260522/public-longmemeval-full-provider-wave-q083-nvidia-mitigated-20260531.json | sha256:7436ed29744e3700c0feacf4ba3f2c189aee5ba262ee5b7eaf71c5202dfe079e |

## Failed Arms

| Strategy | Failure class | Retryable/provider limit |
| --- | --- | ---: |
| cloud-nvidia-nv-embed-v1-mistral-rerank | provider-timeout | true |

## Safety

- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false
- Private output path included: false
