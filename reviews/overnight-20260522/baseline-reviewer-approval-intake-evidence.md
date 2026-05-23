# Baseline Reviewer Approval Intake Evidence

Date: 2026-05-23

## Scope

Added a metrics-only reviewer approval intake gate for hosted baseline claims.
The gate accepts sanitized JSON approval artifacts from Claude, Codex, Gemini,
DeepSeek, or another reviewer, then counts only independent approvals that bind
to the exact packet SHA, run hash, or comparison hash.

## Commands Run

```bash
node packages/bench/baseline-reviewer-approval-intake.mjs
node packages/bench/baseline-reviewer-approval-intake.mjs --template --packet reviews/overnight-20260522/hosted-baseline-live-mirror-packet.json --run reviews/overnight-20260522/hosted-baseline-live-mirror-run.json --output /tmp/recallweave-reviewer-approval-template.json
node packages/bench/baseline-reviewer-approval-intake.mjs --packet reviews/overnight-20260522/hosted-baseline-live-mirror-packet.json --run reviews/overnight-20260522/hosted-baseline-live-mirror-run.json --strict-target --output /tmp/recallweave-reviewer-approval-report.json
node packages/bench/release-readiness-check.mjs
node packages/bench/consumer-install-smoke.mjs
```

## Result

- Fixture/no-review intake remains blocked with `reviewerApprovalCount: 0`.
- A loose `RECALLWEAVE_REVIEWER_APPROVAL_COUNT=2` value no longer counts as
  public benchmark approval unless a `baseline:reviewer-intake` report is
  supplied.
- The live mirror packet template binds to packet SHA
  `7b1d7b2587e21454333ec764fb8ceb0a2248365a4ab1ad8add02d7559fad6051`.
- The live mirror no-review strict-target intake reports
  `publicBenchmarkApprovalReady: false`.
- `release-readiness-check` passed.
- `consumer-install-smoke` passed.

## Claim Boundary

This adds the approval intake mechanism. It does not add two actual independent
approvals and does not authorize public benchmark claims or public launch.
