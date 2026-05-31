# Brain UI Provider Budget Contract Surface

Generated: 2026-05-31

## Scope

- Surfaced the provider budget contract in the Brain UI benchmark dashboard and release readiness console.
- The dashboard now shows that provider-wave history exists, but default promotion remains blocked because 0 of 17 legacy provider-wave reports were run under the new no-spend provider budget contract.
- No raw provider keys, raw memories, raw transcripts, raw questions, or private benchmark text are included here.

## Changes Verified

- Benchmark dashboard fixture carries `providerWaves.budgetContract`.
- Benchmark summary stats include provider budget contract coverage and default-promotion status.
- Release readiness fixture carries `providerBudgetContract`.
- Release readiness summary shows provider budget coverage and keeps default promotion blocked.
- Static evidence report includes provider budget contract state.

## Evidence

- `node --check packages/brain-ui/src/model.js`
  - Passed.
- `node --check packages/brain-ui/src/app.js`
  - Passed.
- `node --check packages/brain-ui/smoke.mjs`
  - Passed.
- `node --check packages/brain-ui/interaction-smoke.mjs`
  - Passed.
- `node --check packages/brain-ui/static-evidence.mjs`
  - Passed.
- `npm exec --yes pnpm@10.23.0 -- brain:smoke:built`
  - Passed.
- `npm exec --yes pnpm@10.23.0 -- brain:evidence:static`
  - Passed with `providerBudgetContract.status = NEEDS_RERUN_UNDER_CONTRACT`, `reportsWithBudgetContract = 0`, `reportsMissingBudgetContract = 17`, and `defaultPromotionBlockedUntilRerun = true`.
- `npm exec --yes pnpm@10.23.0 -- brain:interaction:built`
  - Passed after updating stale release-console assertions to the latest local baseline and provider-budget contract state.
- `npm exec --yes pnpm@10.23.0 -- typecheck`
  - Passed.
- `git diff --check`
  - Passed.
- Evidence-only and changed-line public-safety scans
  - Passed with no raw provider keys, raw memories, raw transcripts, raw questions, or private benchmark text in this slice.
- `detect_gates.sh --since origin/feat/nucleus-wiki-native-contract`
  - Required gates: `security`, `code`, `integration`, `final`.
  - Bounded verification was used for this UI slice because the earlier broad verifier path hung on repo-wide scanning; the bounded checks above cover the changed UI/model/smoke/static-evidence surfaces.

## Claim Boundary

This is UI/product evidence hardening. It does not add answer-quality evidence, full-memory SOTA evidence, or production rollout proof.
