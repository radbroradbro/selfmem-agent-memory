# Current Verified Baseline Refresh Evidence

Date: 2026-05-23

## Scope

This refresh updates the checked-in release state, PR body draft, and blocker
issue draft so the latest verified code/product baseline matches the current PR
head after the baseline source-match private-path redaction hardening.

## Verified Head

- Commit: `a56449db786a334db3554f7fd66721ae44261073`
- Commit title: `fix: redact source-match local paths`
- GitHub Actions run: `26338015421`
- CI conclusion: `success`
- PR branch: `feat/nucleus-wiki-native-contract`

## Local Verification

The following checks passed on or against the same head before this
evidence-only refresh:

- `npm exec --yes pnpm@10.23.0 -- release:check`
- `npm exec --yes pnpm@10.23.0 -- release:doctor`
- `npm exec --yes pnpm@10.23.0 -- release:github-sync`
- `npm exec --yes pnpm@10.23.0 -- goal:audit`
- `git diff --check`
- Changed-file secret and private-path scans

## Reviewer

Gemini reran a focused cold review of this evidence-only refresh.

- Route: `gemini --skip-trust --approval-mode plan`.
- Verdict: `CLEAN`.
- Evidence:
  `reviews/overnight-20260522/gemini-current-verified-baseline-refresh-review.md`.
- Findings: the release-state, PR draft, blocker issue draft, and refresh
  evidence accurately name commit
  `a56449db786a334db3554f7fd66721ae44261073` and GitHub Actions run
  `26338015421`, preserve `productionReady: false` and public launch verdict
  `FAIL`, keep the human, hosted-baseline, and real-canary blockers, and do not
  include raw memories, transcripts, prompts, answers, credentials, private
  local paths, or key-shaped secrets.

## Boundary

This does not approve public launch. It keeps the same blockers:

- human approval
- fresh hosted Supermemory baseline before public comparison claims
- fresh real one-agent production canary before rollout claims
