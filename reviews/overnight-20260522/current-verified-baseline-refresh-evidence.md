# Current Verified Baseline Refresh Evidence

Date: 2026-05-23

## Scope

This refresh updates the checked-in release state, PR body draft, and blocker
issue draft so the latest verified code/product baseline matches the current PR
head after the MemoryBench source-lock lane, optional checkout hash
verification, and source-lock evidence refresh.

## Verified Head

- Commit: `9de4ebd1b792092b30d0d6cd8100fc8a791d1bba`
- Commit title: `docs: refresh benchmark source-lock sync evidence`
- GitHub Actions run: `26346310930`
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

Gemini previously ran a focused cold review for the source-match
private-path-redaction baseline refresh. A focused Codex reviewer also checked
the MemoryBench source-lock hardening and found no blockers. This
2026-05-23T23:26Z refresh was validated by local release gates and CI, but the
external Gemini reviewer route was not rerun.

- Route: `gemini --skip-trust --approval-mode plan`.
- Verdict: previous `CLEAN`; focused Codex reviewer found no blocker on the
  source-lock checkout verifier.
- Evidence:
  `reviews/overnight-20260522/gemini-current-verified-baseline-refresh-review.md`.
- Current findings: the release-state, PR draft, blocker issue draft, and
  refresh evidence accurately name commit
  `9de4ebd1b792092b30d0d6cd8100fc8a791d1bba` and GitHub Actions run
  `26346310930`, preserve `productionReady: false` and public launch verdict
  `FAIL`, keep the human and real-canary blockers, and do not include raw
  memories, transcripts, prompts, answers, credentials, private local paths, or
  key-shaped secrets.

## Boundary

This does not approve public launch. It keeps the same blockers:

- human approval
- fresh real one-agent production canary before rollout claims
- owner approval before using any hosted-baseline comparison in public release
  language
