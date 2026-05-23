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

## Private Path Redaction Follow-up

Purpose: let operators smoke a real local RecallWeave or selfmem export that
contains path-bearing provenance without leaking local paths or raw memory
content into stdout, reports, CI errors, or public review files.

Behavior:

- Query sets still fail closed if they contain key-shaped secrets or private
  paths.
- Local memory exports fail closed on key-shaped secrets.
- Local memory text and path-bearing provenance are redacted before hashing,
  matching, stdout, and report output.
- Unsafe memory ids are replaced with short hash ids instead of being printed.
- A source-mismatched real export still blocks public benchmark claims.

Verification commands:

```bash
node --check packages/bench/baseline-source-match-preflight.mjs
node --check packages/bench/release-readiness-check.mjs
npm exec --yes pnpm@10.23.0 -- baseline:source-match
RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 node packages/bench/baseline-source-match-preflight.mjs --live --queryset packages/bench/fixtures/hosted-baseline-queryset.fixture.json --memories <local-codex-selfmem-memories> --output <tmp-source-match-report>
npm exec --yes pnpm@10.23.0 -- release:check
```

Real local export smoke, metrics only:

- lines read: `1081`
- parsed memories: `1081`
- candidate count: `1081`
- unique content hashes: `1007`
- private path redactions: `709`
- unsafe id redactions: `0`
- sourceMatchReady: `false`
- failed checks include `local-source-missing-expected-refs`
- failed checks include `local-export-cannot-score-every-query`
- privateLeakCount: `0`
- hasSecretPattern: `false`

Interpretation:

- The redaction fix worked: the real local export produced a metrics-only
  report without raw memory text, private paths, private tags, expected refs, or
  key-shaped secrets.
- The fixture hosted query set did not match that local source, so this remains
  source-match research evidence, not a public hosted-vs-local benchmark claim.
- `release:check` now includes a regression fixture that injects a private path
  into local memory text and provenance, then asserts the generated report and
  stdout contain no private path fragments.
