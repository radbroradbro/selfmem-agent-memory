# Codex Public Benchmark Target Review

Date: 2026-05-23

Verdict: pass after fixes.

## Findings Resolved

- The first review found that public docs and benchmark evidence did not all
  share the same absolute-private-path scan. The release gate now checks public
  docs and overnight evidence for local machine paths, and placeholder examples
  use angle-bracket placeholders instead of local paths.
- The second review found that the validator required judge and answer model
  fields but did not compare them. `benchmark:public-target` now requires the
  reported target and benchmark contract to use the same judge model and the
  same answer model before a target can be ready for a canary.

## Final Reviewer Result

No remaining blocking findings on the public benchmark target gate.

The final review confirmed:

- fixture mode passes structurally but keeps `targetReadyForCanary: false`;
- a non-fixture ready target passes `--strict`;
- mismatched reported judge or answer models fail with `same-judge-model` and
  `same-answer-model`;
- `sameDataReady` depends on those model matches;
- release-readiness coverage includes the positive fixture assertions and the
  negative mismatch target.

## Scope

This review approves only the public benchmark target gate. It does not approve
public launch, broad SOTA language, hosted write-back, or production rollout.
