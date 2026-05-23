# Current Verified Baseline Refresh Evidence

Date: 2026-05-23

## Scope

This refresh updates the checked-in release state, PR body draft, and blocker
issue draft so the latest verified code/product baseline matches the current PR
head after the mixed-folder next-agent handoff packet extension.

## Verified Head

- Commit: `afcc0f44f28c00ea155cf542a22c7c7ac8530e32`
- Commit title: `feat: allow mixed canary handoff packets`
- GitHub Actions run: `26336780942`
- CI conclusion: `success`
- PR branch: `feat/nucleus-wiki-native-contract`

## Local Verification

The following checks passed on the same head before this evidence-only refresh:

- `npm exec --yes pnpm@10.23.0 -- test`
- `npm exec --yes pnpm@10.23.0 -- smoke`
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
- Findings: the release-state, PR draft, blocker issue draft, and refresh
  evidence accurately name commit
  `afcc0f44f28c00ea155cf542a22c7c7ac8530e32` and GitHub Actions run
  `26336780942`, preserve `productionReady: false` and public launch verdict
  `FAIL`, keep the human, hosted-baseline, and real-canary blockers, and do not
  include raw memories, transcripts, prompts, answers, credentials, private
  local paths, or key-shaped secrets.

## Boundary

This does not approve public launch. It keeps the same blockers:

- human approval
- fresh hosted Supermemory baseline before public comparison claims
- fresh real one-agent production canary before rollout claims
