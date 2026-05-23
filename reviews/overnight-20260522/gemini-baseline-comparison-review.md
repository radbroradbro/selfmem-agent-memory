# Gemini Baseline Comparison Review

Date: 2026-05-23

Route: Gemini CLI focused review with a first blocked pass, then a revised
clean pass.

Verdict: `CLEAN`

Initial finding:

- Gemini first returned `BLOCK` because the first draft did not explicitly let
  `--fixture` block claims, silently defaulted missing metrics to zero, and
  defaulted missing privacy flags to false.

Fixes reviewed:

- `--fixture` now forces `countsAsComparisonEvidence` and
  `publicBenchmarkClaimsAllowed` to false.
- Missing quality, retrieval, latency, context-token, cost, and privacy fields
  now fail the comparison instead of defaulting to a passing value.
- The release gate includes a negative missing-metric check.

Findings:

- The comparison gate reads only metrics-only JSON result files and rejects
  secret-shaped text or private local paths.
- The gate requires the same dataset slice, query-set hash, scoring-code hash,
  judge model, answer model, and harness flags before it can count as
  comparison evidence.
- Fixture inputs deliberately keep `countsAsComparisonEvidence: false` and
  `publicBenchmarkClaimsAllowed: false`, even when the fixture delta favors
  RecallWeave.
- Public claims remain blocked until both result files are non-fixture, privacy
  clean, RecallWeave wins, and two reviewer approvals are present.

Residual risk:

- This is a harness and release-gate review. It does not validate a live hosted
  Supermemory baseline or a real RecallWeave run.

Follow-up review on 2026-05-23:

- Route: Gemini CLI focused review after one transient capacity retry.
- Verdict: `CLEAN`.
- Scope: matched-counterpart-run hardening for
  `packages/bench/baseline-comparison.mjs`,
  `packages/bench/release-readiness-check.mjs`, and the RecallWeave fixture
  result.
- Finding: the comparison gate now requires independent counterpart proof from
  both result files. Hosted results must prove the matching RecallWeave run, and
  RecallWeave results must prove the matching hosted run.
- Finding: strict boolean checks prevent truthy values from bypassing the gate.
- Finding: the release check covers the negative case where reviewer approvals
  exist but the hosted result lacks matched RecallWeave proof.
