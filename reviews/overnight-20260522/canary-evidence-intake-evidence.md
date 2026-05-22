# Canary Evidence Intake Evidence

Date: 2026-05-22

## Purpose

This slice adds the intake side for one-agent runtime canaries. The existing
Brain UI Canary Rollout panel describes what to collect; this gate verifies that
a returned canary report is metrics-only, sanitized, lifecycle-aware, and safe
to attach to a PR or issue.

## Files Added Or Updated

- `packages/bench/canary-evidence-intake.mjs`
- `packages/bench/fixtures/canary-runtime-report.fixture.json`
- `package.json`
- `packages/bench/consumer-install-smoke.mjs`
- `packages/bench/release-readiness-check.mjs`
- release docs and review evidence

## Local Command

```sh
node packages/bench/canary-evidence-intake.mjs
```

Result:

- `ok: true`
- `mode: canary-evidence-intake`
- `writesRealFiles: false`
- `metricsOnly: true`
- `fixtureOnly: true`
- `countsAsRealRolloutEvidence: false`
- `canaryPass: true`
- `fleetRolloutAllowed: false`
- `publicLaunchAllowed: false`
- `failedChecks: []`

## Safety Contract

The intake rejects:

- provider keys or bearer-token-shaped strings,
- raw local paths,
- raw memory, transcript, prompt, or answer fields,
- unknown identity writes,
- privacy leaks,
- secret-pattern hits,
- raw memory or transcript inclusion flags,
- failed lifecycle, recall, store, latency, or rollback checks.

The accepted report may contain only hashes, counts, booleans, aggregate
latency, aggregate quality rates, redaction counts, and rollback readiness.

## Required Runtime Signals

- one runtime host,
- hashed agent identity,
- hashed local container,
- hashed source container,
- session-start events,
- before-prompt-build events,
- agent-end events,
- search and store counts,
- LCM/pre-compression evidence,
- p50 and p95 recall/store latency,
- context-hit rate,
- zero-result rate,
- write-success rate,
- privacy leak count,
- redaction count,
- rollback readiness.

## Boundary

The bundled fixture proves the intake path. It does not count as real rollout
evidence. A real one-agent canary must run:

```sh
npm exec --yes pnpm@10.23.0 -- canary:intake -- --report <sanitized-report.json> --strict-real
```

Fleet rollout and public launch remain blocked until a maintainer reviews a
real metrics-only report.
