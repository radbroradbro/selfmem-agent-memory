# Current Verified Baseline Refresh Evidence

Date: 2026-05-24

## Scope

This refresh updates the checked-in release state, PR body draft, and blocker
issue draft so the latest verified code/product baseline matches the current PR
head after the expanded 30-query LongMemEval-S hybrid stress gate and the
fail-closed live provider benchmark preflight.

## Verified Head

- Commit: `67d0c9fc8cc3faef2150efa8368d619a1b4c9f11`
- Commit title: `feat: add expanded LongMemEval hybrid gate`
- GitHub Actions run: `26350709133`
- CI conclusion: `success`
- PR branch: `feat/nucleus-wiki-native-contract`

## Local Verification

The following checks passed on or against the same head before this
evidence-only refresh:

- `npm exec --yes pnpm@10.23.0 -- benchmark:public-hybrid -- --live --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json --max-memory-bytes 80000000 --output reviews/overnight-20260522/public-longmemeval-expanded-hybrid-gate.json --markdown-output reviews/overnight-20260522/public-longmemeval-expanded-hybrid-gate-evidence.md`
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
manifest and found no blockers. This 2026-05-24T03:25Z refresh was validated
by local release gates, goal-loop-review code verification, and CI, but the
external Gemini reviewer route was not rerun.

- Route: `gemini --skip-trust --approval-mode plan`.
- Verdict: previous `CLEAN`; focused Codex reviewer found no blocker on the
  source-lock checkout verifier or public LongMemEval-S slice manifest.
- Evidence:
  `reviews/overnight-20260522/gemini-current-verified-baseline-refresh-review.md`.
- Current findings: the release-state, PR draft, blocker issue draft, and
  refresh evidence accurately name commit
  `67d0c9fc8cc3faef2150efa8368d619a1b4c9f11` and GitHub Actions run
  `26350709133`, preserve `productionReady: false` and public launch verdict
  `FAIL`, keep the human and real-canary blockers, and do not include raw
  memories, transcripts, prompts, answers, credentials, private local paths, or
  key-shaped secrets.

The expanded hybrid gate uses source-locked public LongMemEval-S data and
metrics-only outputs. It keeps BM25 as the current control winner, blocks
deterministic hybrid promotion, and points the next benchmark step at real
provider-backed embedding and reranker arms. The live provider preflight itself
made no provider API calls and sent no benchmark text. It reports
`BLOCKED_PROVIDER_ENV` in the clean controller environment because
provider-call consent flags, public-data consent flags, and env-only
Gemini/Voyage credentials are absent.

## Boundary

This does not approve public launch. It keeps the same blockers:

- human approval
- fresh real one-agent production canary before rollout claims
- owner approval before using any hosted-baseline comparison in public release
  language
