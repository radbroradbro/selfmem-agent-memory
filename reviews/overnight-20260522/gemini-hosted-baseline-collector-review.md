# Gemini Hosted Baseline Collector Review

Date: 2026-05-23

Reviewer route:

- Gemini CLI 0.44.0-nightly.20260515.g928a311fb
- Command mode: read-only plan review
- Scope: hosted baseline collector, operator packet update, release gates, and
  supporting docs

Verdict: `CLEAN`

Findings:

- Credential and data leaks: safe. Release gates assert metrics-only output,
  no raw memory, prompt, answer, or transcript flags, zero privacy leaks, and
  no secret-shaped output. Operator instructions keep `SUPERMEMORY_API_KEY` in
  the local environment.
- Explicit live opt-in: safe. Hosted provider calls require `--live` or
  `RECALLWEAVE_BASELINE_LIVE=1`, `RECALLWEAVE_BASELINE_NO_RAW_TEXT=1`, and the
  required container, query set, run id, judge model, answer model, and API key
  environment.
- Fixture mode safety: safe. Fixture collector output proves shape but remains
  `fixtureOnly: true`; preflight rejects it with `failedResultChecks:
  ["not-fixture"]`.
- Operator packet: safe. It now directs agents to `baseline:collect` instead
  of an ad hoc external collector and keeps attachments limited to aggregate
  JSON outputs.
- Release gates: covered. The collector is wired into package scripts, smoke,
  release blocker doctor, and release readiness checks.

Notes:

- Terminal warnings reported limited color support and missing ripgrep inside
  Gemini. They did not affect the verdict.
