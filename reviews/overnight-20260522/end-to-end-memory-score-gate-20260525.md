# End-to-End Memory Score Gate

- Status: BLOCKED_END_TO_END_MEMORY_SCORE
- Counts as end-to-end memory benchmark: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false
- Target: reviews/overnight-20260522/public-longmemeval-expanded-run-target.json

## Blockers
- missing-voyage-provider-arm

## Result
- Source: result-file
- Fixture only: false
- Answer quality metric: result=43.1667
- Reviewer approvals: 2
- Arms: bm25-lite, cloud-nvidia-nemotron-1b, full-hybrid-rerank, local-apple-qwen3-0_6b, local-apple-qwen3-0_6b-local-rerank, query-expanded-full-hybrid-rerank

## Reviewer Approval
- Report exists: true
- Report status: READY_MEMORY_SCORE_REVIEWERS
- Target bound: true
- Independent reviewers: 2

## Next Actions
- Run the same-data LongMemEval/MemoryBench answer-quality harness, not only the retrieval-proxy strategy comparison.
- Include BM25, dense/vector, full-hybrid, live query-expansion, provider challenger, local Apple, and local reranker arms on the exact source-locked target.
- Attach only metrics-only public-safe output, then re-run this gate with --require-ready before claiming full-memory SOTA evidence.
- Send the exact gate-passing packet to two independent reviewers before owner/public release approval.
