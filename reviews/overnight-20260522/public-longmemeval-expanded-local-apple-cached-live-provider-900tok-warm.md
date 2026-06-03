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
- Winner: bm25-lite
- Provider arm beats control: false
- Provider arm decision: Keep bm25-lite and full-hybrid-rerank as controls; provider-backed arm has not earned promotion on this slice.

## Strategies

| Strategy | Provider arm | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | p50 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bm25-lite | none | 0.2506 | 0.4667 | 0.1583 | 0.1583 | 0.2193 | 90 |
| full-hybrid-rerank | none | 0.2289 | 0.4333 | 0.1417 | 0.1417 | 0.1989 | 192 |
| local-apple-qwen3-0_6b | local-apple-qwen3-0_6b | 0.2506 | 0.4667 | 0.1583 | 0.1583 | 0.2193 | 133 |

## Safety

- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false
- Private output path included: false
