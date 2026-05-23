# Baseline Output Path Evidence

Date: 2026-05-23

## Scope

Fixed a command-path bug in the hosted-baseline and canary evidence tooling.
When operators ran JSON-producing package scripts through `npm exec` or
`pnpm`, shell redirection could capture package-manager banner lines before
the JSON body. That made otherwise valid preflight or comparison artifacts
fail parsing and could leak private local paths from the wrapper banner.

The fix adds explicit `--output` support to the JSON-producing gates and
updates generated operator packets to use `--output` instead of redirecting
package-script stdout.

## Updated Scripts

- `baseline:preflight` accepts `--output` and
  `RECALLWEAVE_BASELINE_PREFLIGHT_OUTPUT_JSON`.
- `baseline:compare` accepts `--output` and
  `RECALLWEAVE_BASELINE_COMPARISON_OUTPUT_JSON`.
- `canary:intake` accepts `--output` and
  `RECALLWEAVE_CANARY_INTAKE_OUTPUT_JSON`.
- `canary:batch-audit` accepts `--output` and
  `RECALLWEAVE_CANARY_BATCH_AUDIT_OUTPUT_JSON`.
- `canary:next-agent` accepts `--output` and
  `RECALLWEAVE_CANARY_NEXT_AGENT_OUTPUT_JSON`.
- Hosted baseline next-run and operator packets now emit `--output` commands
  for preflight templates, hosted preflight validation, and matched
  comparison outputs.
- Canary next-agent and operator packets now emit `--output` commands for
  strict intake and diagnosis outputs; release-doctor guidance also writes
  batch-audit and next-agent planner files with `--output`.
- `release:check` asserts generated JSON evidence commands use `--output` and
  do not use shell redirection after the evidence-producing script name.

## Live Probe

A tiny read-only hosted Supermemory probe was run before this fix using the
environment-provided hosted credential and one hosted container label. The
credential and container label were not printed.

Observed safe aggregate facts:

- Provider: hosted Supermemory.
- Query count: 1.
- Result count: 3.
- Metrics-only output: true.
- Privacy leak count: 0.
- Redaction failure count: 0.
- Raw memory included: false.
- Latency p50/p95: 805 ms for the one query.
- Quality metrics: 0 because this probe intentionally used an empty expected
  answer/id set.

This probe proves the read-only hosted path was reachable. It is not a
benchmark and does not close the hosted-baseline blocker because there is no
matched RecallWeave run on the same source-locked query set.

## Reproduction And Fix Proof

The old wrapper path reproduced the bug: package-manager stdout contained
banner lines with the checkout path before the JSON body.

The new `--output` path produced parseable JSON files for:

- Hosted baseline preflight.
- Baseline comparison.
- Canary strict-real intake, including the expected nonzero fixture exit.
- Canary diagnostic batch audit.
- Canary next-agent planning.

The clean hosted preflight output was consumed by `baseline:next-run`, which
correctly reported that the next required state is a matched RecallWeave run.
It kept public launch and benchmark claims blocked.

## Verification

Commands run:

```bash
node --check packages/bench/hosted-baseline-preflight.mjs
node --check packages/bench/baseline-comparison.mjs
node --check packages/bench/canary-evidence-intake.mjs
node --check packages/bench/hosted-baseline-next-run.mjs
node --check packages/bench/hosted-baseline-operator-packet.mjs
node --check packages/bench/canary-next-agent-plan.mjs
node --check packages/bench/canary-operator-packet.mjs
node --check packages/bench/release-readiness-check.mjs
node --check packages/bench/canary-diagnostic-batch-audit.mjs
TMPDIR=/tmp/recallweave-release-tmp npm_config_cache=/tmp/recallweave-npm-cache npm exec --yes pnpm@10.23.0 -- release:check
npm exec --yes pnpm@10.23.0 -- smoke
```

`release:check` passed all checks.
