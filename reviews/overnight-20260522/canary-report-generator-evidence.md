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

The generated report is metrics-only. It hashes the agent identity, local
container, source container, and event fingerprints. It reports lifecycle
counts, hybrid-search coverage, local-write observation, hosted read-through
mode, p50/p95 recall and store latency, privacy counters, and rollback
readiness.

## Adapter Change

Hermes and OpenClaw store events now include `elapsed_ms`. The generator does
not fabricate missing store latency. Older canary logs without store latency
will fail the strict intake until the agent is updated and a new window is
captured.

## Boundary

This does not complete real-container rollout. It gives deployed agents the
safe report path needed to prove or fail a one-agent canary.
