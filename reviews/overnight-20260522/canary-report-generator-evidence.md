# Canary Report Generator Evidence

Date: 2026-05-22

## Purpose

This slice adds the missing producer side for real one-agent canary evidence.
The intake gate already checks a sanitized report; the generator converts
Hermes or OpenClaw `trace.jsonl` plus companion metadata into that report
format without emitting raw memory text, transcripts, prompts, answers, local
paths, or credentials.

## Files Added Or Updated

- `packages/bench/canary-report-from-trace.mjs`
- `packages/bench/fixtures/canary-runtime-container-map.fixture.json`
- `packages/bench/fixtures/canary-runtime-trace.fixture.jsonl`
- `packages/bench/fixtures/canary-runtime-raw.fixture.jsonl`
- `packages/bench/fixtures/canary-runtime-memories.fixture.jsonl`
- `packages/bench/fixtures/canary-diagnostic-export.fixture/`
- `packages/adapters/hermes/selfmem_canary/__init__.py`
- `packages/adapters/openclaw/selfmem_canary/index.mjs`
- `package.json`
- `packages/bench/consumer-install-smoke.mjs`
- `packages/bench/release-readiness-check.mjs`
- `packages/bench/goal-completion-audit.mjs`

## Local Commands

```sh
node packages/bench/canary-report-from-trace.mjs --fixture
node packages/bench/canary-report-from-trace.mjs --fixture --output /tmp/report.json
node packages/bench/canary-report-from-trace.mjs --diagnostic-dir packages/bench/fixtures/canary-diagnostic-export.fixture
node packages/bench/canary-evidence-intake.mjs --report /tmp/report.json
node packages/bench/canary-evidence-intake.mjs --report /tmp/report.json --strict-real
```

Expected behavior:

- The fixture generator emits `mode: one-agent-canary-runtime-report`.
- It emits hashes, counts, quality rates, latency, privacy counters, event
  fingerprints, and rollback readiness.
- It emits `fixtureOnly: true` and `evidenceType:
  fixture-trace-derived-canary-report`.
- Normal intake accepts the fixture-derived report but keeps
  `countsAsRealRolloutEvidence: false`.
- Strict-real intake rejects the fixture-derived report.
- The diagnostic fixture exercises metadata-only exports with
  `trace_metadata_only.jsonl`, `container-map.json`, and reliability summary
  input. It remains fixture-only and cannot count as real rollout proof.
- The release gate zips a relocated copy of the diagnostic fixture and confirms
  it still reports `fixtureOnly: true` and still fails strict-real intake.

## Controller Spot Checks

- A redacted Hermes diagnostic ZIP generated a metrics-only report with
  lifecycle, hybrid-search, local-write, read-through, and privacy coverage.
  It failed strict canary pass on recall p95 and missing store p95, so it did
  not count as real rollout evidence.
- A redacted Hermes diagnostic directory generated a metrics-only report
  with Hermes lifecycle, hybrid-search, local-write, read-through, and privacy
  coverage. It also failed strict canary pass on recall p95 and missing store
  p95, so it did not count as real rollout evidence.
- No raw memory text, prompts, answers, credentials, private local paths, or
  diagnostic archive contents were committed from those spot checks.

## Runtime Contract

For a real agent, run the generator against the selected local container:

```sh
node packages/bench/canary-report-from-trace.mjs \
  --host hermes \
  --container <agent-selfmem-container-dir> \
  --rollback-tested \
  --output sanitized-report.json
```

Then run:

```sh
npm exec --yes pnpm@10.23.0 -- canary:intake -- --report sanitized-report.json --strict-real
```

For a redacted diagnostic bundle from an agent, run:

```sh
node packages/bench/canary-report-from-trace.mjs \
  --diagnostic-dir <unzipped-agent-diagnostics-dir> \
  --rollback-tested \
  --output sanitized-report.json

node packages/bench/canary-report-from-trace.mjs \
  --zip <agent-diagnostics.zip> \
  --rollback-tested \
  --output sanitized-report.json
```

The generated report is metrics-only. It hashes the agent identity, local
container, source container, and event fingerprints. It reports lifecycle
counts, hybrid-search coverage, local-write observation, hosted read-through
mode, p50/p95 recall and store latency, privacy counters, and rollback
readiness.

The generator accepts metadata-only diagnostic exports. It still requires the
strict intake to prove latency, lifecycle, hybrid search, local writes,
read-through, and zero privacy leaks. It does not fabricate missing store
latency, so older bundles can generate a useful failure report without becoming
rollout evidence.

The generator now also accepts summary-only sanitized trace exports such as
`trace_summary_sanitized.json`. Those exports can prove event counts and error
classes, but they produce zero latency samples and therefore fail strict canary
intake until the agent recollects a fresh patched runtime window.

## Adapter Change

Hermes and OpenClaw store events now include `elapsed_ms`. The generator does
not fabricate missing store latency. Older canary logs without store latency
will fail the strict intake until the agent is updated and a new window is
captured.

## Boundary

This does not complete real-container rollout. It gives deployed agents the
safe report path needed to prove or fail a one-agent canary.
