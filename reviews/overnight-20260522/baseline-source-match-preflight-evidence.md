# Baseline Source-Match Preflight Evidence

Date: 2026-05-23

Purpose: add a metrics-only preflight that proves a reviewed query set can be scored against the selected local RecallWeave source before any hosted Supermemory calls are spent on a matched run.

Command:

```bash
npm exec --yes pnpm@10.23.0 -- baseline:source-match -- --fixture --strict
```

Result:

- mode: `baseline-source-match-preflight`
- sourceMatchReady: `true`
- publicSafe: `true`
- metricsOnly: `true`
- rawQueryIncluded: `false`
- rawExpectedIdsIncluded: `false`
- rawExpectedHashesIncluded: `false`
- rawMemoryIncluded: `false`
- privateLeakCount: `0`
- hasSecretPattern: `false`
- query count: `3`
- source-matched queries: `3`
- collectable queries: `3`
- missing queries: `0`
- skipped fully private local entries: `1`

Negative control:

```bash
node packages/bench/baseline-source-match-preflight.mjs --fixture --queryset <missing-source-match-queryset> --memories packages/bench/fixtures/recallweave-local-container.fixture/local-memories.fixture.jsonl --strict
```

Result:

- exit status: `1`
- sourceMatchReady: `false`
- failed checks include `local-source-missing-expected-refs`
- failed checks include `local-export-cannot-score-every-query`
- rawQueryIncluded: `false`
- rawMemoryIncluded: `false`
- privateLeakCount: `0`
- hasSecretPattern: `false`

Safety scan:

- Checked successful and failing public reports for key-shaped tokens, private local paths, raw query fields, expected-result fields, and raw memory/text fields.
- Scan result: clean.

Release-gate effect:

- `baseline:next-run` now includes `preflight-local-source-match` after `validate-query-set` and before `run-matched-baseline-chain`.
- Attach-only list now includes `/tmp/recallweave-baseline-source-match.json`.
- Pass criteria now require the source-match preflight to prove every reviewed query has at least one collectable expected ref in the local RecallWeave source.
