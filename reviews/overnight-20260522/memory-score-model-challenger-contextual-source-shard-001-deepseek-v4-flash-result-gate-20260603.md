# End-to-End Memory Score Gate

- Status: BLOCKED_END_TO_END_MEMORY_SCORE
- Claim scope: model-challenger
- Counts as end-to-end memory benchmark: false
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false
- Counts as model-challenger reported-score evidence: false
- Public benchmark claims allowed: false
- Target: reviews/overnight-20260522/public-longmemeval-full-run-target.json

## Blockers
- missing-dense-or-vector-control
- missing-local-apple-arm
- missing-local-rerank-arm

## Full SOTA Blockers
- model-challenger-result-not-strict-sota-comparable

## Model-Challenger Blockers
- missing-full-or-officially-comparable-memory-benchmark-run
- best-end-to-end-score-below-selected-reported-memory-target

## Result
- Source: result-file
- Fixture only: false
- Answer model: deepseek-v4-flash (target gpt-4o)
- Judge model: deepseek-v4-flash (target gpt-4o)
- Scored queries: 25
- Answer quality metric: result=42
- Reviewer approvals: 0
- Arms: bm25-lite, full-hybrid-rerank, query-expanded-full-hybrid-rerank, cloud-gemini2-embed-rerank-proxy, cloud-voyage4-voyage-lite-rerank, cloud-nvidia-nv-embed-v1-mistral-rerank
- Model match policy: challenger-model-allowed
- Scoring model policy satisfied: true

## Reported Target
- Source lock status: READY_REPORTED_TARGETS
- Primary target: supermemory-production-research-gpt4o (81.6 percent)
- Score delta: -39.6
- Same benchmark family: true
- Same judge model: false
- Meets reported score comparison: false
- Meets reported target: false

## Model-Challenger Claim
- Ready: false
- Statement: No model-challenger claim is ready yet; run the full same-data answer-quality benchmark with the selected challenger model and beat Supermemory's reported gpt-4o score (81.6 percent).
- Caveat: This statement is valid only as a labeled model-challenger comparison; strict SOTA still requires matching judge/model semantics.

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
- Run the same-data LongMemEval/MemoryBench answer-quality harness across the full target with the selected stronger answer/judge model.
- Compare the resulting score to the selected reported Supermemory row with --reported-target-id, keeping same-judge/SOTA wording separate.
- Attach only metrics-only public-safe output, then send the model-challenger packet to independent reviewers before public wording changes.
