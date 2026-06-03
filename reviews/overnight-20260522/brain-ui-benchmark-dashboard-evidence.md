# Brain UI Benchmark Dashboard Evidence

Date: 2026-05-22

Scope:

- Fixture local-only compaction benchmark dashboard in the self-hosted Brain UI.
- Metrics-only public-safe benchmark summary.
- Browser evidence and screenshot for the dashboard.

Result:

- Mode: `fixture-local-compaction-benchmark-dashboard`
- Verdict shown: `PASS`
- Scenarios passed: 5 of 5
- Failed scenarios: 0
- Privacy leak count: 0
- Exact identifier accuracy: 1
- Average noise reduction ratio: 0.307
- Caveats shown: 3
- `writesRealFiles`: `false`
- `metricsOnly`: `true`
- Console errors: 0

Evidence files:

- `reviews/overnight-20260522/ui-evidence/brain-ui-benchmark-dashboard-evidence.json`
- `reviews/overnight-20260522/ui-evidence/brain-ui-benchmark-dashboard.png`

Notes:

- The dashboard intentionally shows fixture benchmark results only. It does not
  claim superiority over hosted Supermemory.
- It displays the hosted-baseline caveat and the no-raw-text caveat inside the
  UI so a public reviewer can see the benchmark boundary without opening docs.
- It includes no raw session text, candidate memory text, transcripts,
  diagnostics, credentials, or local paths.
