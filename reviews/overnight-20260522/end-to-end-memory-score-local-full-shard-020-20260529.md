# End-to-End Memory Score Gate

- Status: READY_LOCAL_FULL_MEMORY_SCORE
- Claim scope: local-full
- Counts as end-to-end memory benchmark: true
- Counts as local-full benchmark evidence: true
- Counts as full memory SOTA evidence: false
- Counts as model-challenger reported-score evidence: false
- Public benchmark claims allowed: false
- Target: reviews/overnight-20260522/public-longmemeval-full-run-target.json

## Blockers
- none

## Full SOTA Blockers
- local-full-diagnostic-result-not-sota-comparable

## Model-Challenger Blockers
- not-a-model-challenger-claim-scope

## Result
- Source: result-file
- Fixture only: false
- Answer model: qwen36-a3b-main-q8kv-8192 (target gpt-4o)
- Judge model: qwen36-a3b-main-q8kv-8192 (target gpt-4o)
- Scored queries: 25
- Answer quality metric: result=8
- Reviewer approvals: 0
- Arms: bm25-lite, full-hybrid-rerank, query-expanded-full-hybrid-rerank, local-apple-qwen3-0_6b, local-apple-qwen3-0_6b-local-rerank
- Model match policy: local-diagnostic-allowed
- Scoring model policy satisfied: true

## Reported Target
- Source lock status: READY_REPORTED_TARGETS
- Primary target: supermemory-production-research-gemini-3-pro (85.2 percent)
- Score delta: -77.2
- Same benchmark family: true
- Same judge model: false
- Meets reported score comparison: false
- Meets reported target: false

## Model-Challenger Claim
- Ready: false
- Statement: No model-challenger claim is ready yet; run the full same-data answer-quality benchmark with the selected challenger model and beat Supermemory's reported gemini-3-pro score (85.2 percent).
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
- Attach this gate report to the benchmark packet and reviewer packet.
- Update UI evidence, docs, and release notes against the reviewed result before owner approval.
