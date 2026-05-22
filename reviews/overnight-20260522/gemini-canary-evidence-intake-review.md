# Gemini Canary Evidence Intake Review

Date: 2026-05-22

Command:

```sh
gemini --skip-trust --approval-mode plan -p 'Cold review the RecallWeave canary evidence intake slice. Inspect packages/bench/canary-evidence-intake.mjs, packages/bench/fixtures/canary-runtime-report.fixture.json, package.json, packages/bench/consumer-install-smoke.mjs, packages/bench/release-readiness-check.mjs, packages/bench/goal-completion-audit.mjs, reviews/overnight-20260522/release-state.json, reviews/overnight-20260522/canary-evidence-intake-evidence.md, and the release docs. Check no secrets, raw memory, raw transcript, prompt, answer, or path exposure. Check fixture reports do not count as real rollout evidence. Check live report contract is specific enough. Check fleet rollout and public launch remain blocked. Check release gate enforces evidence and reviewer packet. Return either Verdict: CLEAN or Verdict: BLOCKED with concise findings.'
```

Verdict: `CLEAN`

Findings:

- No exposure: `packages/bench/canary-evidence-intake.mjs` enforces zero
  key-shaped secrets, forbids raw local paths, and recursively rejects raw
  memory, transcript, prompt, answer, and auth-like report keys. The allowed
  raw-presence fields are boolean flags, and the review confirmed those must be
  false.
- Fixture exception: the script tracks `fixtureOnly` and sets
  `countsAsRealRolloutEvidence` only when the report is not the bundled
  fixture and all checks pass. `--strict-real` rejects fixture reports.
- Specific contract: the intake checks identity hashes, runtime window,
  session-start and agent-end counts, search and store counts, latency bounds,
  context-hit rate, zero-result rate, write-success rate, lifecycle coverage,
  hybrid-search coverage, local writes, LCM/pre-compression evidence, privacy
  counters, and rollback readiness.
- Rollout blocked: output keeps `fleetRolloutAllowed: false` and
  `publicLaunchAllowed: false`; `release-state.json` keeps
  `publicLaunchVerdict: "FAIL"`.
- Release gate enforcement: `packages/bench/release-readiness-check.mjs`
  requires the intake file, fixture, evidence packet, this reviewer packet, and
  a fresh intake pass.
