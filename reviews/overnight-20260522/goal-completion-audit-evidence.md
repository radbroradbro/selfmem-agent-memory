# Goal Completion Audit Evidence

Date: 2026-05-22

## Scope

The active thread goal is broad: native Codex supervision, council review,
browser/computer-use UI evidence, safe PR-based implementation, Nucleus Index,
wiki/vault sync, self-hosted Brain UI, update flow, and local-only memory
compaction benchmarking.

This slice adds a machine-readable completion audit so the goal cannot be
quietly marked complete while the evidence still shows blocked reviewer,
human approval, hosted-baseline, and real-rollout requirements.

## Implementation

- Added `packages/bench/goal-completion-audit.mjs`.
- Added `goal:audit` to `package.json`.
- Added `goal-completion-audit` to `release-state.json` proven surfaces.
- Added `hosted-baseline-preflight` as a proven surface while preserving the
  hosted Supermemory baseline as a blocker.
- Added `canary-evidence-intake` as a proven surface while preserving the real
  production rollout as incomplete until a live sanitized report is reviewed.
- Added `canary-report-generator` as a proven surface so deployed agents can
  produce the sanitized report consumed by strict canary intake.
- Added `canary-diagnostic-bundle-report` as a proven surface so redacted
  diagnostic directories and ZIP bundles can produce the same sanitized report
  shape while copied fixtures still fail strict real-rollout intake.
- Added `github-live-sync-current` as a proven requirement so the audit now
  checks that PR #5 and issue #6 match the checked-in public-safe drafts.
- Updated `packages/bench/release-readiness-check.mjs` so release readiness now
  requires the audit script, evidence file, Gemini review, package script, and
  a fresh audit run.

## Current Audit Result

`node packages/bench/goal-completion-audit.mjs` returns:

- `ok: true`
- `mode: "goal-completion-audit"`
- `writesRealFiles: false`
- `goalComplete: false`
- `mayCallUpdateGoalComplete: false`
- 19 proven requirements
- 3 blocked requirements
- 1 incomplete requirement
- `privateLeakCount: 0`
- `hasSecretPattern: false`

## Blockers Preserved

- Claude/Opus council review is blocked by missing login.
- PR body and external blocker issue creation are now proven live through
  `github-write-route-evidence.md`.
- GitHub live sync is now proven through `github-live-sync-evidence.md` and the
  `release:github-sync` command.
- Human approval is still required for merge, public visibility, and live
  update.
- Hosted Supermemory benchmark claims need a fresh metrics-only baseline that
  passes `baseline:preflight` and is reviewed against a matched RecallWeave
  run.
- Canary evidence intake can verify a metrics-only one-agent report, but the
  bundled fixture reports `countsAsRealRolloutEvidence: false`.
- Canary report generation can produce that report from Hermes/OpenClaw traces,
  but fixture-derived reports still fail `--strict-real`.
- Canary diagnostic bundle generation can produce that report from metadata-only
  redacted diagnostic exports, but relocated fixture ZIPs still fail
  `--strict-real`.
- Canary remediation can turn failed canary reports into metrics-only next
  actions, but it does not make failed evidence pass or authorize broader
  rollout.
- Real-container production rollout is still a canary step, not complete.

## Verification

- `node packages/bench/goal-completion-audit.mjs`: passed.
- `node packages/bench/release-readiness-check.mjs`: passed with the audit
  required.
- `npm exec --yes pnpm@10.23.0 -- test`: passed, 6 files and 22 tests.
- `npm exec --yes pnpm@10.23.0 -- smoke`: passed.
- `git diff --check`: passed.
- GitHub Actions CI run `26308994908` passed on `13efb18`, including Test,
  Full smoke, and Release readiness check.
- GitHub Actions CI run `26309563159` passed on `02b3a13`, including Test,
  Full smoke, and Release readiness check after the hosted baseline preflight
  gate was added.
- GitHub Actions CI run `26310168571` passed on `d26eb78`, including Test,
  Full smoke, and Release readiness check after the canary evidence intake gate
  was added.
- GitHub Actions CI run `26310773948` passed on `6ae4ce7`, including Test,
  Full smoke, and Release readiness check after the canary report generator gate
  was added.
- GitHub Actions CI run `26311728246` passed on `77b3cee`, including Test,
  Full smoke, and Release readiness check after the diagnostic bundle canary
  report gate was added.
- GitHub Actions CI run `26312283137` passed on `4f5a079`, including Test,
  Full smoke, and Release readiness check after the canary remediation
  diagnosis gate was added.

The audit is intentionally conservative. It is a proof that the current branch
is a public-readiness candidate, not proof that the active goal is complete.
