# End-to-End Memory Score Gate

- Status: BLOCKED_END_TO_END_MEMORY_SCORE
- Counts as end-to-end memory benchmark: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false
- Target: reviews/overnight-20260522/public-longmemeval-expanded-run-target.json

## Blockers
- answer-model-does-not-match-target
- judge-model-does-not-match-target
- missing-voyage-provider-arm
- memory-score-reviewer-approval-report-not-ready
- missing-two-independent-reviewer-approvals

## Full SOTA Blockers
- reported-target-judge-model-does-not-match-result
- missing-full-or-officially-comparable-memory-benchmark-run
- best-end-to-end-score-below-primary-reported-memory-target

## Result
- Source: result-file
- Fixture only: false
- Answer model: qwen36-a3b-main-q8kv-8192 (target gpt-4o)
- Judge model: qwen36-a3b-main-q8kv-8192 (target gpt-4o)
- Scored queries: 30
- Answer quality metric: result=43.1667
- Reviewer approvals: 0
- Arms: bm25-lite, cloud-nvidia-nemotron-1b, full-hybrid-rerank, local-apple-qwen3-0_6b, local-apple-qwen3-0_6b-local-rerank, query-expanded-full-hybrid-rerank

## Reported Target
- Source lock status: READY_REPORTED_TARGETS
- Primary target: supermemory-production-research-gemini-3-pro (85.2 percent)
- Score delta: -42.0333
- Same benchmark family: true
- Same judge model: false
- Meets reported target: false

## Full Benchmark Policy
- Dataset slice: longmemeval-s-cleaned-canary-30-first-per-type-2026-05-24
- Current answer-quality query count: 30
- Minimum full query count: 500
- Full or officially comparable run present: false

## Reviewer Approval
- Report exists: true
- Report status: BLOCKED_MEMORY_SCORE_REVIEWERS
- Target bound: true
- Independent reviewers: 0

## Next Actions
- Run the same-data LongMemEval/MemoryBench answer-quality harness across the full target or an officially comparable benchmark target.
- Include BM25, dense/vector, full-hybrid, live query-expansion, provider challenger, local Apple, and local reranker arms on the exact source-locked target.
- Beat the source-locked reported memory-system target under matching benchmark and judge semantics before claiming full-memory SOTA evidence.
- Attach only metrics-only public-safe output, then re-run this gate with --require-ready before SOTA ladder promotion.
- Send the exact gate-passing packet to two independent reviewers before owner/public release approval.
