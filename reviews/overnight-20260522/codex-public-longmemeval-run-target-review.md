# Codex Review: Public LongMemEval Run-Only Target

Date: 2026-05-23

Reviewer route: focused Codex subagent review.

## Verdict

PASS WITH CONCERNS.

The LongMemEval run-only target work should not block commit. It should still
block release-readiness and public comparison language until GitHub live-sync is
refreshed and a reported comparison row passes strict validation.

## Findings

- Medium: the full release gate still fails because the live PR body differs
  from the checked-in draft. This is a sync-state failure, not a benchmark-target
  logic failure. Do not claim release readiness until the PR and issue are
  refreshed.
- Pass: the run-only target blocks comparison and SOTA claims. It passes
  `--strict-run` and fails `--strict`, as intended.
- Pass: the target and report contain hashes, counts, policy text, model names,
  and source commit only. They do not contain raw question ids, question text,
  answer text, memory text, private paths, or secrets.
- Pass: same-data anchoring is reasonable for a run-only target: MemoryBench
  commit, dataset hash, deterministic selector hash, answer-label hash, and
  scoring-code hash are recorded.

## Required Follow-Up

- Sync the live PR and blocker issue after this commit.
- Keep public benchmark comparison claims blocked until a source-locked reported
  target row passes `benchmark:public-target -- --strict`.
