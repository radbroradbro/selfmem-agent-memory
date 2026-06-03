# Memory Method Retrieval-Proxy Ladder

- Fixture only: false
- Query shard: 0 to 10
- Same raw query selection: true
- Context token budget: 800
- Limit: 5
- Claim boundary: retrieval-proxy memory-method diagnostic only; not answer-quality, production, or SOTA evidence

## Results

| Method | Strategy | Quality | P@1 | Recall@5 | NDCG@10 | p50 ms | Expected refs |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| session-v1 | bm25-lite | 0.2772 | 0.6 | 0.1417 | 0.2255 | 25 | 36 |
| session-v1 | full-hybrid-rerank | 0.1418 | 0.3 | 0.075 | 0.1171 | 55 | 36 |
| contextual-source-chunk-v1 | bm25-lite | 0.1595 | 0.4 | 0.0431 | 0.1517 | 36 | 192 |
| contextual-source-chunk-v1 | full-hybrid-rerank | 0.2003 | 0.5 | 0.0576 | 0.1861 | 82 | 192 |
| contextual-index-source-chunk-v1 | bm25-lite | 0.1973 | 0.4 | 0.0802 | 0.229 | 19 | 192 |
| contextual-index-source-chunk-v1 | full-hybrid-rerank | 0.2114 | 0.5 | 0.0673 | 0.211 | 46 | 192 |

## Materialization

| Method | Queries | Sessions | Records | Source chunks | Index records | Expected refs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| session-v1 | 10 | 494 | 494 | 0 | 0 | 36 |
| contextual-source-chunk-v1 | 10 | 494 | 3562 | 3562 | 0 | 192 |
| contextual-index-source-chunk-v1 | 10 | 494 | 7124 | 3562 | 3562 | 192 |

## Interpretation

The session-level control still wins this retrieval-proxy ladder. Chunked methods should not be promoted from this evidence alone; use answer-quality scoring to test whether finer source rehydration helps final answers despite lower proxy recall.
