# End-to-End Memory Score Gate

- Status: READY_LOCAL_FULL_MEMORY_SCORE
- Claim scope: local-full
- Counts as end-to-end memory benchmark: true
- Counts as local-full benchmark evidence: true
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false
- Target: reviews/overnight-20260522/public-longmemeval-full-run-target.json

## Blockers
- none

## Full SOTA Blockers
- local-full-diagnostic-result-not-sota-comparable

## Result
- Source: result-file
- Fixture only: false
- Answer model: qwen36-a3b-main-q8kv-8192 (target gpt-4o)
- Judge model: qwen36-a3b-main-q8kv-8192 (target gpt-4o)
- Scored queries: 25
- Answer quality metric: result=19.4
- Reviewer approvals: 0
- Arms: bm25-lite, full-hybrid-rerank, query-expanded-full-hybrid-rerank, local-apple-qwen3-0_6b, local-apple-qwen3-0_6b-local-rerank
- Model match policy: local-diagnostic-allowed
- Scoring model policy satisfied: true

## Reported Target
- Source lock status: READY_REPORTED_TARGETS
- Primary target: supermemory-production-research-gemini-3-pro (85.2 percent)
- Score delta: -65.8
- Same benchmark family: true
- Same judge model: false
- Meets reported target: false

## Full Benchmark Policy
- Dataset slice: longmemeval-s-cleaned-full-500-2026-05-25
- Current answer-quality query count: 25
- Total query count: 500
- Minimum full query count: 500
- Full or officially comparable run present: false

## Reviewer Approval
- Report exists: false
- Report status: missing
- Target bound: false
- Independent reviewers: 0

## Next Actions
- Run the same-data local-full answer-quality harness across the full 500-query target.
- Include BM25, full-hybrid, live query-expansion, local Apple, and local reranker arms on the exact source-locked target.
- Keep SOTA and production-replacement claims blocked until the exact-scoring full provider/SOTA lane passes.
- Attach only metrics-only public-safe output, then send the local-full packet to independent reviewers before release wording changes.
