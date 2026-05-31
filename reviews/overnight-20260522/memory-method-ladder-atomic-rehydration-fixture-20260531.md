# Memory Method Retrieval-Proxy Ladder

- Fixture only: true
- Query shard: 0 to 10
- Same raw query selection: true
- Context token budget: 800
- Limit: 5
- Claim boundary: retrieval-proxy memory-method diagnostic only; not answer-quality, production, or SOTA evidence

## Results

| Method | Strategy | Quality | P@1 | Recall@5 | NDCG@10 | p50 ms | Expected refs |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| session-v1 | bm25-lite | 0.4899 | 0.5 | 0.5 | 0.4598 | 1 | 4 |
| session-v1 | full-hybrid-rerank | 0.4899 | 0.5 | 0.5 | 0.4598 | 1 | 4 |
| contextual-source-chunk-v1 | bm25-lite | 0.8125 | 0.5 | 1 | 0.75 | 1 | 2 |
| contextual-source-chunk-v1 | full-hybrid-rerank | 0.8125 | 0.5 | 1 | 0.75 | 1 | 2 |
| contextual-index-source-chunk-v1 | bm25-lite | 0.8125 | 0.5 | 1 | 0.75 | 1 | 2 |
| contextual-index-source-chunk-v1 | full-hybrid-rerank | 0.8125 | 0.5 | 1 | 0.75 | 1 | 2 |
| atomic-memory-v1 | bm25-lite | 0.8125 | 0.5 | 1 | 0.75 | 1 | 2 |
| atomic-memory-v1 | full-hybrid-rerank | 0.8125 | 0.5 | 1 | 0.75 | 1 | 2 |

## Materialization

| Method | Queries | Sessions | Records | Source chunks | Index records | Atomic records | Expected refs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| session-v1 | 2 | 3 | 3 | 0 | 0 | 0 | 4 |
| contextual-source-chunk-v1 | 2 | 3 | 3 | 3 | 0 | 0 | 2 |
| contextual-index-source-chunk-v1 | 2 | 3 | 6 | 3 | 3 | 0 | 2 |
| atomic-memory-v1 | 2 | 3 | 9 | 3 | 0 | 6 | 2 |

## Interpretation

A chunked method won the retrieval-proxy ladder, but answer-quality scoring is still required before promotion.
