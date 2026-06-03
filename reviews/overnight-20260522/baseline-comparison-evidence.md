# Baseline Comparison Evidence

Date: 2026-05-23

Scope:

- Added `packages/bench/baseline-comparison.mjs`.
- Added `packages/bench/fixtures/recallweave-baseline-result.fixture.json`.
- Added `baseline:compare` as the metrics-only comparison gate for hosted
  Supermemory and RecallWeave result files.

Command:

```bash
npm exec --yes pnpm@10.23.0 -- baseline:compare -- --fixture
```

Result: passed.

The fixture comparison reports:

- provider pair: `hosted-supermemory` and `recallweave`;
- same dataset slice;
- same query-set hash;
- same scoring-code hash;
- same judge model;
- same answer model;
- matched counterpart run proof from both sides;
- labeled query-set proof on both sides;
- metrics-only input and output;
- zero privacy leaks;
- zero redaction failures;
- no raw memory, transcript, prompt, or answer text;
- RecallWeave fixture quality delta above the hosted fixture;
- public claims still blocked because both inputs are fixtures and reviewer
  approvals are absent.

Boundary:

- This gate calls no hosted provider.
- This gate writes no real files.
- This gate does not close the hosted-baseline blocker by itself.
- Public comparison claims still require non-fixture hosted and RecallWeave
  results, labeled query sets, the same harness settings, matched counterpart
  run proof from both result files, a RecallWeave win, zero privacy failures,
  and two independent reviewer approvals.

Follow-up hardening on 2026-05-23:

- `baseline-comparison.mjs` now exposes `comparability.matchedCounterpartRuns`.
- Hosted results must set `matchedRecallWeaveRunPresent: true` or equivalent
  nested proof.
- RecallWeave results must set `matchedHostedRunPresent: true` or equivalent
  nested proof.
- If either side lacks that proof, `countsAsComparisonEvidence` and
  `publicBenchmarkClaimsAllowed` remain false even when both result files are
  non-fixture, RecallWeave wins, and reviewer approval count is sufficient.
- `release:check` includes a forced non-fixture negative test for this failure
  mode.
