# Gemini Baseline Labeled Query-Set Gate Review

Date: 2026-05-23

Reviewer: Gemini CLI

Scope:

- `packages/bench/hosted-baseline-collector.mjs`
- `packages/bench/recallweave-baseline-collector.mjs`
- `packages/bench/baseline-comparison.mjs`
- `packages/bench/hosted-baseline-preflight.mjs`
- benchmark and release handoff docs

Verdict: `PASS`

Findings:

- Both collectors reject unlabeled query sets before aggregate benchmark metrics
  can be produced.
- The comparison gate now requires labeled query-set evidence from both hosted
  Supermemory and RecallWeave results.
- Fixture blocking, privacy checks, and public-claim blockers remain in place.

Required fixes: none.
