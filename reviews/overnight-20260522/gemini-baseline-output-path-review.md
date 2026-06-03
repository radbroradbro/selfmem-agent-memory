# Gemini Baseline Output Path Review

Date: 2026-05-23

Reviewer: Gemini CLI

Verdict: CLEAN

## Scope

Cold review of the output-file-safe hosted baseline and canary evidence patch.

Reviewed files:

- `packages/bench/hosted-baseline-preflight.mjs`
- `packages/bench/baseline-comparison.mjs`
- `packages/bench/canary-evidence-intake.mjs`
- `packages/bench/hosted-baseline-next-run.mjs`
- `packages/bench/hosted-baseline-operator-packet.mjs`
- `packages/bench/canary-next-agent-plan.mjs`
- `packages/bench/canary-operator-packet.mjs`
- `packages/bench/release-readiness-check.mjs`
- `reviews/overnight-20260522/baseline-output-path-evidence.md`

## Findings

- JSON artifact integrity is fixed by explicit `--output` flags and
  `writeFileSync` logic in baseline preflight, baseline comparison, and canary
  intake.
- Strict canary intake writes machine-readable JSON before setting nonzero
  exit status on strict-real failures.
- Hosted baseline and canary command generators no longer instruct operators
  to shell-redirect JSON-producing package-script output.
- Release readiness checks now assert `--output` and reject shell redirection
  after evidence-producing command names.
- Secret and private-path scanning remains in place for generated outputs.
- Public benchmark and launch claims remain blocked by reviewer-approval and
  release-state gates.

## Follow-Up Review

Gemini also reviewed the release-doctor guidance after it was updated to use
`--output` for hosted preflight and comparison commands. It returned `CLEAN`
and noted that `canary:batch-audit` and `canary:next-agent` should also gain
first-class `--output` support if their planner JSON may be attached.

That note was addressed in this patch:

- `canary:batch-audit` now supports `--output`.
- `canary:next-agent` now supports `--output`.
- `release:doctor` now suggests output-file paths for batch-audit and
  next-agent artifacts.
- `release:check` verifies those output-file paths parse as JSON.
