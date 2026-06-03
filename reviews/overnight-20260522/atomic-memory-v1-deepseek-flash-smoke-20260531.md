# Atomic Memory V1 DeepSeek Flash Smoke

Generated: 2026-05-31

## Scope

- Ran a bounded same-data answer-quality smoke for `atomic-memory-v1`.
- Used `deepseek-v4-flash` as both answer and judge model under the explicit `model-challenger` scope.
- Hosted Supermemory search was disabled for the benchmark run.
- Public report files are metrics-only and contain no raw questions, answers, memories, transcripts, prompts, or credentials.

## Evidence Files

- `reviews/overnight-20260522/answer-quality-atomic-deepseek-flash-smoke-20260531.json`
  - Wrapper method-ladder smoke comparing `session-v1` and `atomic-memory-v1`.
- `reviews/overnight-20260522/answer-quality-atomic-v1-deepseek-flash-3q-20260531.json`
  - Normal answer-quality report for the atomic-memory method.
- `reviews/overnight-20260522/memory-score-gate-atomic-v1-deepseek-flash-3q-20260531.json`
  - Result-gate output for the normal atomic answer-quality report.

## Result

Method-ladder smoke:

- Methods: `session-v1`, `atomic-memory-v1`.
- Strategies: `bm25-lite`, `full-hybrid-rerank`.
- Query shard: 3 / 500 questions.
- Same raw query selection across methods: true.
- Winner: `atomic-memory-v1` + `full-hybrid-rerank`.
- Answer quality: `66.6667`.
- Provider calls: 24 total across the two methods.
- Answer failures: 0.
- Judge failures: 0.

Normal atomic answer-quality report:

- Method: `atomic-memory-v1`.
- Strategies: `bm25-lite`, `full-hybrid-rerank`.
- Winner on the rerun: `bm25-lite`.
- Answer quality: `66.6667`.
- Judge correct rate: `0.6667`.
- Provider calls: 12.
- Answer failures: 0.
- Judge failures: 0.

## Gate Status

- Gate status: `BLOCKED_END_TO_END_MEMORY_SCORE`.
- `answerLabelsHashMatches`: true after carrying the parent target answer-label hash and shard metadata into the answer-quality report.
- Current query count: 3.
- Minimum full comparable LongMemEval count: 500.

Remaining blockers include:

- Missing dense/vector control.
- Missing query-expansion arm.
- Missing local Apple arm.
- Missing local rerank arm.
- Missing full or officially comparable benchmark run.

## Interpretation

This is a useful end-to-end smoke for the new atomic-memory path, not production or SOTA evidence. It proves the atomic materializer, response export, answer-quality scorer, and result gate can operate together on public benchmark data without hosted Supermemory search. The next promotion step is a larger same-data answer-quality wave with the accepted arm matrix and paired deltas.

## UI Evidence

- Updated the Brain benchmark dashboard fixture to surface the atomic smoke as bounded challenger evidence.
- Browser DOM verification at `http://127.0.0.1:4189/` confirmed:
  - `Atomic smoke` / `Atomic coverage` appear.
  - The blocked gate status appears.
  - The existing local-full and provider-wave summaries still render.
- `brain:evidence:static` passed with `privacyLeakCount: 0`, `releaseVerdict: FAIL`, and hosted write-back disabled.
