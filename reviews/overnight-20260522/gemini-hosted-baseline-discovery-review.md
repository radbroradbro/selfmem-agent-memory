# Gemini Hosted Baseline Discovery Review

Date: 2026-05-23

Reviewer route:

- Gemini CLI 0.44.0-nightly.20260515.g928a311fb
- Command mode: read-only cold security/integration review
- Scope: hosted baseline discovery command, operator packet update, consumer
  smoke wiring, release gate wiring, and supporting docs

Verdict: `CLEAN`

Findings:

- Raw hosted container labels and memory/title text are not emitted in public
  output. Container labels become hashed candidate ids.
- Provider credentials are used only in request headers and are not printed.
- Hosted write-back is absent. Discovery uses read-only document listing with
  content disabled.
- Fixture and live modes are separated. Live discovery requires explicit live
  opt-in and a hosted credential.
- Private raw-label maps require explicit opt-in, must be written outside the
  repository, and are forced to `0600`.
- `baseline:discover` is wired into package scripts, clean consumer smoke, the
  release readiness gate, operator docs, and public-safe handoff docs.

Notes:

- Gemini initially hit hosted model capacity warnings and then completed the
  review successfully.
