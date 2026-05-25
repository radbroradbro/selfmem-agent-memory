# End-to-End Memory Score Gate

- Status: BLOCKED_END_TO_END_MEMORY_SCORE
- Counts as end-to-end memory benchmark: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false
- Target: reviews/overnight-20260522/public-longmemeval-expanded-run-target.json

## Blockers
- result-not-end-to-end-memory-score-report
- fixture-result-cannot-count-as-end-to-end-memory-score
- retrieval-proxy-result-cannot-count-as-answer-quality
- memorybench-answer-quality-not-proven
- result-not-bound-to-source-locked-target
- target-hash-does-not-match-source-locked-target
- missing-materializer-hash
- scoring-code-hash-does-not-match-target
- answer-labels-hash-does-not-match-target
- missing-answer-quality-score
- answer-quality-score-out-of-range
- missing-voyage-provider-arm
- missing-nvidia-or-gemini-provider-arm
- missing-local-apple-arm
- missing-local-rerank-arm
- missing-two-independent-reviewer-approvals

## Result
- Source: generated-fixture-retrieval-proxy-smoke
- Fixture only: true
- Answer quality metric: missing=missing
- Reviewer approvals: 0
- Arms: bm25-lite, dense-proxy, full-hybrid-rerank, query-expanded-full-hybrid-rerank

## Next Actions
- Run the same-data LongMemEval/MemoryBench answer-quality harness, not only the retrieval-proxy strategy comparison.
- Include BM25, dense/vector, full-hybrid, live query-expansion, provider challenger, local Apple, and local reranker arms on the exact source-locked target.
- Attach only metrics-only public-safe output, then re-run this gate with --require-ready before claiming full-memory SOTA evidence.
- Send the exact gate-passing packet to two independent reviewers before owner/public release approval.
