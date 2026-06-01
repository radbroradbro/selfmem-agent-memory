# Public Benchmark Strategy Shard Combine

- OK: true
- Status: COMBINED_WITH_ARM_FAILURES
- Gate: provider
- Benchmark: longmemeval
- Report count: 1
- Query count: 500
- Require complete: false
- Winner: cloud-nvidia-nv-embed-v1-mistral-rerank
- Best coverage: 1%

## Strategies

| Strategy | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | p50 ms | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| bm25-lite | 0.3656 | 0.8 | 0.1409 | 0.1409 | 0.3804 | 17 | 1% |
| cloud-gemini2-embed-rerank-proxy | 0.3145 | 0.8 | 0.0907 | 0.0907 | 0.2764 | 1245 | 1% |
| cloud-nvidia-nv-embed-v1-mistral-rerank | 0.4289 | 1 | 0.1471 | 0.1471 | 0.4213 | 12076 | 1% |
| full-hybrid-rerank | 0.3265 | 0.8 | 0.1012 | 0.1012 | 0.3034 | 37 | 1% |
| query-expanded-full-hybrid-rerank | 0.3265 | 0.8 | 0.1012 | 0.1012 | 0.3034 | 1609 | 1% |

## Failed Arms

| Strategy | Query offset | Max queries | Failure class | Summary |
| --- | ---: | ---: | --- | --- |
| cloud-voyage4-voyage-lite-rerank | 0 | 5 | provider-rate-limit | node packages/bench/recallweave-response-export.mjs --live --queryset <private-path> --memories <private-path> --preserve-ids --strategy cloud-voyage4-voyage-lite-rerank --context-token-budget 1400 --limit 5 --max-memory-bytes 2000000000 -- |

## Safety

- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false
- Private output path included: false
