# Canary Diagnostic Batch Audit Evidence

Date: 2026-05-23

## Scope

Added `canary:batch-audit`, a controller-side metrics-only auditor for a folder
of redacted Hermes/OpenClaw diagnostic bundles. The command turns each bundle
through the existing canary report, strict intake, and remediation pipeline,
then ranks the closest candidate without printing raw memories, transcripts,
prompts, answers, credentials, local paths, or private container names.

This does not complete the real-container rollout blocker. It makes the next
canary decision safer by showing which returned diagnostic is closest to
passing and which failed checks still block rollout.

## Commands

```bash
node --check packages/bench/canary-diagnostic-batch-audit.mjs
node packages/bench/canary-diagnostic-batch-audit.mjs
node packages/bench/canary-diagnostic-batch-audit.mjs --require-real-pass
node packages/bench/canary-diagnostic-batch-audit.mjs --input-root <redacted-diagnostics-folder>
node packages/bench/canary-diagnostic-batch-audit.mjs --input-root <redacted-diagnostics-folder> --allow-failed-inputs
```

## Fixture Result

- Mode: `canary-diagnostic-batch-audit`.
- Default fixture audit: `ok: true`.
- Writes real files: false.
- Metrics only: true.
- Input count: 1.
- Parsed input count: 1.
- Failed input count: 0.
- Strict-real pass count: 0.
- Counts as real rollout evidence: false.
- Best fixture candidate canary pass: true.
- Best fixture privacy leak count: 0.
- Best fixture secret-pattern hits: 0.
- Best fixture lifecycle covered: true.
- Best fixture hybrid search covered: true.
- Best fixture store latency samples: positive.
- `--require-real-pass` fails closed for the fixture with
  `countsAsRealRolloutEvidence: false`.
- Mixed-bundle triage without `--allow-failed-inputs` exits nonzero when one
  sibling input cannot be parsed.
- Mixed-bundle triage with `--allow-failed-inputs` exits successfully when at
  least one bundle parses, but still reports `countsAsRealRolloutEvidence:
  false`.

## Real Redacted Batch Result

The controller also ran the command against the available local redacted
diagnostic return set. No raw diagnostic, memory, transcript, prompt, answer,
credential, or local path content was written to the repo.

- Input count: 9.
- Parsed input count: 8.
- Failed input count: 1.
- Strict-real pass count: 0.
- Counts as real rollout evidence: false.
- Best candidate privacy leak count: 0.
- Best candidate recall p95: 1567.346 ms.
- Best candidate store latency samples: 0.
- Best candidate failed checks:
  - `adapter-contract`
  - `store-latency-instrumented`
  - `store-p95`

## Interpretation

The strongest current real diagnostic is below the recall latency threshold and
privacy-clean, but it still cannot count as rollout evidence because the live
adapter evidence lacks the strict v1 contract marker and store latency samples.
That confirms the right next canary step: update one agent to the current
adapter, collect a fresh post-update window, then package and review that
metrics-only result.

## Guardrails

- `--require-real-pass` fails unless at least one audited bundle counts as
  strict-real rollout evidence.
- Fixture inputs never count as real rollout evidence.
- Failed inputs are listed by hashed label and failed stage only.
- `--allow-failed-inputs` lets a mixed returned-diagnostics folder rank parsed
  bundles without promoting the batch.
- Bundle labels are hashes, not filenames or local paths.
- Results include hashed agent/container labels, lifecycle counts, latency,
  instrumentation, quality, privacy counters, failed checks, and remediation
  categories only.
- The command never allows public launch or fleet rollout by itself.
