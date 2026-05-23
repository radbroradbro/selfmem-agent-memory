# Budgeted Baseline Reviewer Intake Evidence

Date: 2026-05-23

## Scope

This records the strict intake for two independent reviewer approvals against
the source-matched, budgeted hosted-baseline canary.

## Command Run

```bash
node packages/bench/baseline-reviewer-approval-intake.mjs \
  --run reviews/overnight-20260522/hosted-baseline-live-budgeted-run.json \
  --strict-target \
  --review reviews/overnight-20260522/reviewer-work/codex-5-5-budgeted-baseline-approval.json \
  --review reviews/overnight-20260522/reviewer-work/gemini-3-1-pro-budgeted-baseline-approval.json \
  --output reviews/overnight-20260522/reviewer-work/budgeted-baseline-reviewer-intake-two-of-two.json
```

## Result

- `ok: true`
- `publicBenchmarkApprovalReady: true`
- `reviewerApprovalCount: 2`
- `independentReviewerCount: 2`
- `failedChecks: []`

## Claim Boundary

This clears the reviewer-approval intake gate for the source-matched canary
target only. Public launch remains blocked. The next benchmark step is to rerun
the matched comparison with the reviewer approval report attached and then
rebuild the metrics-only packet if the comparison remains clean.

