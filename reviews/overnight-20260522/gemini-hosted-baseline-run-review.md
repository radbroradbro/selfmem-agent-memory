# Gemini Hosted Baseline Run Review

Route: `gemini --skip-trust --approval-mode plan`

Verdict: CLEAN

Findings:

- Explicit live mode: `packages/bench/hosted-baseline-run.mjs` requires
  `--live` or `RECALLWEAVE_BASELINE_LIVE=1` to run outside fixture mode, so the
  hosted provider cannot be hit accidentally.
- Fixture boundary: fixture mode skips `--strict-real` and
  `--require-production-baseline`, so fixture outputs cannot impersonate
  production hosted-baseline evidence.
- Reviewed query set: live mode requires `--reviewed-queryset` or
  `RECALLWEAVE_BASELINE_QUERYSET_REVIEWED=1` before collection.
- Privacy and secret safety: the runner checks output for key-shaped secrets and
  private paths and requires `RECALLWEAVE_BASELINE_NO_RAW_TEXT=1` for live mode.
- Metrics-only packet path: the runner creates the baseline packet, verifies it
  through returned-packet intake, sets `metricsOnly: true`, and keeps
  `publicLaunchAllowed: false`.
- Fixture coverage: release readiness now covers the orchestrator and keeps
  fixture output from satisfying the real hosted-baseline blocker.
