# Public Benchmark Autoresearch Loop

- OK: true
- Fixture only: false
- Benchmark: longmemeval
- Retrieval proxy only: true
- MemoryBench answer quality: false
- Public benchmark claims allowed: false
- Query set hash: sha256:4386f6fa3280951bffd59b5ae81f067905b1905be3575eff56e2b4168c0ccda7
- Arm count: 48
- Winner: bm25-lite-b800-k10

## Top Arms

| Arm | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | Tokens | p50 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| bm25-lite-b800-k10 | 0.2506 | 0.4667 | 0.1583 | 0.1583 | 0.2193 | 800 | 75 |
| bm25-lite-b800-k5 | 0.2506 | 0.4667 | 0.1583 | 0.1583 | 0.2193 | 800 | 76 |
| bm25-lite-b1200-k10 | 0.2506 | 0.4667 | 0.1583 | 0.1583 | 0.2193 | 1200 | 73 |
| bm25-lite-b1200-k5 | 0.2506 | 0.4667 | 0.1583 | 0.1583 | 0.2193 | 1200 | 75 |
| bm25-lite-b1600-k5 | 0.2506 | 0.4667 | 0.1583 | 0.1583 | 0.2193 | 1600 | 74 |
| bm25-lite-b1600-k10 | 0.2506 | 0.4667 | 0.1583 | 0.1583 | 0.2193 | 1600 | 76 |
| bm25-lite-b2400-k10 | 0.2506 | 0.4667 | 0.1583 | 0.1583 | 0.2193 | 2400 | 74 |
| bm25-lite-b2400-k5 | 0.2506 | 0.4667 | 0.1583 | 0.1583 | 0.2193 | 2400 | 76 |

## Decision

- Use bm25-lite with budget 800 and limit 10 for the next canary arm.
- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Private output path included: false
