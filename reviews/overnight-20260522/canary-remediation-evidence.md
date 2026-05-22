# Canary Remediation Evidence

Date: 2026-05-22

## Purpose

This slice adds a metrics-only diagnosis path for failed one-agent canary
reports. It does not make failed rollout evidence pass. It explains why strict
canary intake failed and what the agent should fix before collecting a fresh
window.

## Files Added Or Updated

- `packages/bench/canary-remediation.mjs`
- `packages/bench/fixtures/canary-runtime-report-failing.fixture.json`
- `package.json`
- `packages/bench/consumer-install-smoke.mjs`
- `packages/bench/release-readiness-check.mjs`
- `docs/RELEASE_HANDOFF.md`
- `docs/AGENT_LIVE_BUILD_GUIDE.md`

## Local Commands

```sh
node packages/bench/canary-remediation.mjs
node packages/bench/canary-remediation.mjs --report packages/bench/fixtures/canary-runtime-report.fixture.json
npm exec --yes pnpm@10.23.0 -- canary:diagnose
```

## Expected Behavior

- A failing fixture report produces `mode: canary-remediation-plan`.
- The output is metrics-only and reports `writesRealFiles: false`.
- The failing fixture reports `canaryPass: false`, `severity: blocked`, and
  failed checks `recall-p95` and `store-p95`.
- The recall action is categorized as latency remediation.
- The missing store p95 action is categorized as instrumentation remediation.
- The output keeps `publicLaunchAllowed: false` and `fleetRolloutAllowed:
  false`.
- A passing fixture report produces `canaryPass: true` but still keeps fleet
  rollout blocked until maintainer review.
- The release gate now runs both failing and passing diagnosis fixtures.

## Review And Verification

- Gemini focused review returned `Verdict: CLEAN`.
- Goal-loop review gate detection required security, architecture, code,
  integration, and final gates for this diff.
- Goal-loop `code` verification passed with typecheck, unit tests, and build.
- Local `release:check` passed with the remediation command included.
- Local full `smoke` passed with `canary:diagnose` and clean consumer smoke.

## Boundary

This command does not read raw traces, raw memories, or raw transcripts. It
accepts the sanitized canary report shape produced by `canary:report` or the
sanitized intake output produced by `canary:intake`. It rejects key-shaped
secrets and local paths before producing output.

## Why This Moves The Goal

The previous diagnostic bundle slice could safely produce failure reports from
real agent exports, but failed reports were not yet actionable. This slice turns
those failures into a public-safe remediation plan so a live Hermes or OpenClaw
agent can patch the right thing, recollect a fresh window, and rerun strict
canary intake without sending private memory contents.
