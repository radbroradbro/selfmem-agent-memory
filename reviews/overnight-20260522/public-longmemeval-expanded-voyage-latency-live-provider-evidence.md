# Public LongMemEval-S Voyage Latency Provider Evidence

Status: public-safe, metrics-only, retrieval-proxy evidence.

This run answered the benchmark-shape concern directly: the live provider arm
was not tested alone. It ran on the same source-locked 30-query public
LongMemEval-S target as the `bm25-lite` lexical floor and the
`full-hybrid-rerank` local hybrid control.

## Inputs

- Target:
  `reviews/overnight-20260522/public-longmemeval-expanded-run-target.json`
- Query count: 30
- Expected references: 92
- Haystack sessions: 1,420
- Query-set hash:
  `sha256:4386f6fa3280951bffd59b5ae81f067905b1905be3575eff56e2b4168c0ccda7`
- Output:
  `reviews/overnight-20260522/public-longmemeval-expanded-voyage-latency-live-provider.json`
- Preflight:
  `reviews/overnight-20260522/public-longmemeval-expanded-voyage-latency-live-provider-preflight.json`

## Results

| Strategy | Embedder | Reranker | Quality | P@1 | Recall@5 | NDCG@10 | p50 ms | p95 ms |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `bm25-lite` | none | none | 0.2506 | 0.4667 | 0.1583 | 0.2193 | 75 | 82 |
| `full-hybrid-rerank` | local proxy | local proxy | 0.2289 | 0.4333 | 0.1417 | 0.1989 | 156 | 169 |
| `cloud-voyage4-voyage` | `voyage-4-large` | `rerank-2.5` | 0.3040 | 0.5667 | 0.1917 | 0.2658 | 6659 | 8867 |
| `cloud-voyage4-voyage-lite-rerank` | `voyage-4-large` | `rerank-2.5-lite` | 0.3040 | 0.5667 | 0.1917 | 0.2658 | 2251 | 3557 |
| `cloud-voyage4-lite-voyage-lite` | `voyage-4-lite` | `rerank-2.5-lite` | 0.3040 | 0.5667 | 0.1917 | 0.2658 | 1988 | 2637 |

## Decision

The best live provider-backed arm was `cloud-voyage4-lite-voyage-lite`. It beat
the BM25 lexical control by 0.0534 quality points, improved P@1 from 0.4667 to
0.5667, and improved NDCG@10 from 0.2193 to 0.2658. It preserved the same
quality as the larger `voyage-4-large` plus `rerank-2.5` arm while reducing p50
latency from 6659 ms to 1988 ms.

This supports testing `voyage-4-lite` plus `rerank-2.5-lite` as the next cloud
canary default. It does not yet prove MemoryBench answer quality, Supermemory
replacement quality, or public SOTA. The report keeps
`memoryBenchAnswerQuality: false` and `publicBenchmarkClaimsAllowed: false`.

## Safety

- Privacy leak count: 0
- Redaction failure count: 0
- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcripts included: false
- Credentials printed: false

## Harness Fix

The first live attempt failed because one full `voyage-4-large` embedding call
sent too large a batch. The adapter now batches Voyage document embeddings by
count and estimated tokens before provider calls. That makes the benchmark
slower but production-safer, and it gives the latency-sensitive arms a fair
measured reason to exist.
