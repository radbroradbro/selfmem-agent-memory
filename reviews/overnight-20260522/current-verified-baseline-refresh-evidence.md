# Current Verified Baseline Refresh Evidence

Date: 2026-05-24

## Scope

This refresh updates the checked-in release state, PR body draft, and blocker
issue draft so the latest verified code/product baseline matches the current PR
head after the live provider benchmark preflight extension to the opt-in
provider-backed benchmark gate.

## Verified Head

- Commit: `95768a6ebc97c13d53eb0e6a63ad4c3c3b1141e9`
- Commit title: `feat: add provider benchmark live preflight`
- GitHub Actions run: `26350184513`
- CI conclusion: `success`
- PR branch: `feat/nucleus-wiki-native-contract`

## Local Verification

The following checks passed on or against the same head before this
evidence-only refresh:

- `npm exec --yes pnpm@10.23.0 -- benchmark:public-provider:preflight`
- `npm exec --yes pnpm@10.23.0 -- release:github-sync`
- `npm exec --yes pnpm@10.23.0 -- release:check`
- `npm exec --yes pnpm@10.23.0 -- goal:audit`
- `git diff --check`
- Changed-file secret and private-path scans

## Reviewer

Gemini previously ran a focused cold review for the source-match
private-path-redaction baseline refresh. A focused Codex reviewer also checked
the MemoryBench source-lock hardening and the public LongMemEval-S slice
manifest and found no blockers. This 2026-05-24T02:57Z refresh was validated
by local release gates and CI, but the external Gemini reviewer route was not
rerun.

- Route: `gemini --skip-trust --approval-mode plan`.
- Verdict: previous `CLEAN`; focused Codex reviewer found no blocker on the
  source-lock checkout verifier or public LongMemEval-S slice manifest.
- Evidence:
  `reviews/overnight-20260522/gemini-current-verified-baseline-refresh-review.md`.
- Current findings: the release-state, PR draft, blocker issue draft, and
  refresh evidence accurately name commit
  `95768a6ebc97c13d53eb0e6a63ad4c3c3b1141e9` and GitHub Actions run
  `26350184513`, preserve `productionReady: false` and public launch verdict
  `FAIL`, keep the human and real-canary blockers, and do not include raw
  memories, transcripts, prompts, answers, credentials, private local paths, or
  key-shaped secrets.

The live provider preflight itself made no provider API calls and sent no
benchmark text. It reports `BLOCKED_PROVIDER_ENV` in the clean controller
environment because provider-call consent flags, public-data consent flags, and
env-only Gemini/Voyage credentials are absent.

## Boundary

This does not approve public launch. It keeps the same blockers:

- human approval
- fresh real one-agent production canary before rollout claims
- owner approval before using any hosted-baseline comparison in public release
  language
