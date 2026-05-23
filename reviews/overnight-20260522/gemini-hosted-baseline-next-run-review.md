# Gemini Hosted Baseline Next-Run Review

Date: 2026-05-23

Reviewer route:

- Gemini CLI 0.44.0-nightly.20260515.g928a311fb
- Command mode: read-only slice review after consumer-smoke portability fix and
  hosted-discovery planner extension
- Scope: hosted baseline next-run planner, docs, evidence, release wiring, and
  release-state surface
- Refresh scope: `--require-ready` fail-closed readiness extension for hosted
  baseline owner-review readiness
- Refresh command mode: embedded public-safe diff with explicit no-tool
  instruction, after a first workspace-inspection attempt hit unavailable
  Gemini shell tools

Verdict: `CLEAN`

Findings:

- Credential and memory exposure: safe. The planner scans for key-shaped
  secrets and private local paths, keeps output metrics-only, and forbids raw
  hosted memories, raw local memories, transcripts, prompts, answers, cookies,
  bearer tokens, private paths, and unredacted diagnostics.
- Fixture handling: safe. Fixture hosted and RecallWeave results produce
  `FIXTURE_PLAN_ONLY` and cannot close the hosted-baseline blocker or authorize
  public claims.
- Benchmark claims: safe. The planner itself never authorizes public claims or
  launch. Public comparison language remains gated on non-fixture matched
  results, a RecallWeave win, and two independent reviewer approvals.
- Release wiring and packaged-checkout portability: coherent. Package scripts,
  clean-consumer smoke, release readiness, goal audit, docs, evidence, and
  release-state surface are aligned, and the planner no longer depends on
  `.git` metadata for fixture planning.
- Hosted calls: safe. The planner calls no hosted provider. Live collection
  still requires explicit operator commands and environment opt-in.
- Discovery extension: safe. The planner now surfaces
  `discover-hosted-containers` and `write-private-container-map` commands
  without executing hosted calls itself. Discovery remains read-only and
  metrics-only, while the raw-label map requires explicit opt-in and stays
  outside the repository with `0600` permissions.
- Fail-closed readiness: safe. `--require-ready` rejects fixture/partial
  evidence with public-safe JSON, preserves the hosted-baseline blocker, and
  can pass only after non-fixture hosted, RecallWeave, preflight, comparison,
  source-lock, privacy-clean, RecallWeave-win, and two-reviewer evidence all
  pass. Even then, the planner marks only owner-review readiness, not public
  launch.
- Verification coverage: safe. The release readiness check verifies the
  fixture failure path, the new `readyForOwnerReview` and
  `strictRealEvidenceRequired` fields, doctor guidance, and absence of secrets
  or private local paths in the fail-closed output.
- Positive-path shape: safe. A synthetic non-fixture hosted plus RecallWeave
  result, preflight, comparison, and two-reviewer contract passed
  `--require-ready` as `READY_FOR_OWNER_REVIEW` while keeping
  `publicLaunchAllowed: false`.

Notes:

- Terminal warnings reported limited color support and missing ripgrep inside
  Gemini. They did not affect the verdict.
- Gemini reported no actionable improvements in the refreshed review.
