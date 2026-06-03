# Real Canary Diagnostic Evidence

Date: 2026-05-22

## Scope

Two redacted external Hermes diagnostic bundles were evaluated with the
RecallWeave canary report and intake path. Both bundles were treated as real
external inputs, not fixtures. Neither generated report contained raw memories,
transcripts, prompts, answers, provider keys, or local paths.

This evidence does not complete the real-container rollout requirement. It
proves the current gate can process real diagnostics and reject a rollout when
latency or instrumentation evidence is not good enough.

After the strict-real operator packet landed, the controller also ran the
metrics-only path against eight available redacted local diagnostic packages.
The expanded check did not write any report into the repository and did not
print memory text. It confirmed the same blocker pattern: all privacy-clean
real inputs still failed strict rollout intake, and the closest OpenClaw
diagnostic was under the recall latency threshold but lacked store latency
samples.

After the canary batch auditor landed, the controller reran the available
redacted return set through `canary:batch-audit`. The batch run processed nine
diagnostic inputs, parsed eight, rejected one at report generation, found zero
strict-real passes, and ranked the closest privacy-clean candidate. That best
candidate had recall p95 1567.346 ms but still failed `adapter-contract`,
`store-latency-instrumented`, and `store-p95`, so it remains diagnostic only.

On 2026-05-23, the controller reran the same available returned diagnostics
with the explicit mixed-folder triage flag. The batch still parsed eight of
nine inputs, still had zero strict-real passes, and still selected the same
OpenClaw candidate for the next one-agent fresh window. The flag only prevents
one malformed sibling bundle from aborting triage; it does not change the
promotion result.

On 2026-05-23, the controller refreshed that same batch audit from the current
worktree and generated a current OpenClaw next-agent handoff packet. The audit
again parsed eight of nine inputs, found zero strict-real passes, and selected
the same privacy-clean OpenClaw candidate. The current handoff packet is
metrics-only, public-safe, and intended only for one fresh OpenClaw canary.

On 2026-05-23, the controller extended the same path once more from a clean
worktree. The mixed-folder batch audit still parsed eight of nine inputs,
ranked the same OpenClaw candidate, and produced a fresh one-agent handoff
packet. The selected candidate still has zero privacy leaks, lifecycle
coverage, hybrid search, local writes, hosted read-through, and recall p95
1567.346 ms, but it still fails strict production intake until a post-update
window proves the v1 adapter contract and positive store latency samples.

On 2026-05-23, the controller reran the available Telegram returned-diagnostic
folder from the current worktree. The batch again inspected nine inputs, parsed
eight, rejected one at report generation, found zero strict-real passes, and
selected the same privacy-clean OpenClaw candidate. A new current one-agent
handoff packet was generated for that candidate. The packet is metrics-only,
has no key-shaped text or private local paths, and is ready only for one fresh
OpenClaw canary window.

On 2026-05-23, after the hosted-baseline run orchestrator landed, the
controller reran the returned Telegram diagnostic set again from commit
`690e413`. The audit still inspected nine inputs, parsed eight, rejected one at
report generation, found zero strict-real passes, and selected the same
privacy-clean OpenClaw candidate. The selected candidate still proves
lifecycle coverage, hybrid search, local writes, hosted read-through, zero
privacy leaks, and recall p95 1567.346 ms. It still fails strict production
intake because the returned window lacks the current v1 adapter contract marker
and has zero store latency samples.

## Commands

The controller generated temporary metrics-only reports outside the repository:

```bash
node packages/bench/canary-report-from-trace.mjs \
  --diagnostic-dir <redacted-external-hermes-bundle> \
  --rollback-tested \
  --output <temporary-metrics-only-report.json>

node packages/bench/canary-evidence-intake.mjs \
  --report <temporary-metrics-only-report.json>

node packages/bench/canary-remediation.mjs \
  --report <temporary-metrics-only-report.json>
```

The strict-real command failed by design for both reports:

```bash
node packages/bench/canary-evidence-intake.mjs \
  --report <temporary-metrics-only-report.json> \
  --strict-real
```

## Bundle A Result

- Fixture-only: false.
- Canary pass: false.
- Counts as real rollout evidence: false.
- Lifecycle coverage: session start 29, before prompt build 32, pre-compress 8,
  agent end 17, search 48, store 50, errors 0.
- Hybrid search covered: true.
- Hosted read-through observed: true.
- Local writes observed: true.
- Before-prompt context rate: 1.
- Zero-result rate: 0.0375.
- Write success rate: 1.
- Recall p50: 817.122 ms.
- Recall p95: 3894.354 ms.
- Store p50: 0 ms.
- Store p95: 0 ms.
- Search latency samples: 48.
- Store latency samples: 0.
- Missing store latency samples: 50.
- Privacy leak count: 0.
- Secret-pattern hits: 0.
- Failed strict checks:
  - `store-latency-instrumented`
  - `recall-p95`
  - `store-p95`

## Bundle B Result

- Fixture-only: false.
- Canary pass: false.
- Counts as real rollout evidence: false.
- Lifecycle coverage: session start 22, before prompt build 42, pre-compress 7,
  agent end 11, search 55, store 54, errors 0.
- Hybrid search covered: true.
- Hosted read-through observed: true.
- Local writes observed: true.
- Before-prompt context rate: 1.
- Zero-result rate: 0.061855670103092786.
- Write success rate: 1.
- Recall p50: 1892.409 ms.
- Recall p95: 7281.754 ms.
- Store p50: 0 ms.
- Store p95: 0 ms.
- Search latency samples: 11.
- Missing search latency samples: 44.
- Store latency samples: 0.
- Missing store latency samples: 54.
- Privacy leak count: 0.
- Secret-pattern hits: 0.
- Failed strict checks:
  - `store-latency-instrumented`
  - `recall-p95`
  - `store-p95`

## Remediation

The failure is actionable and matches the adapter hardening work:

- Fresh adapters must record positive `elapsed_ms` on every store event.
- Adapter standalone smokes must assert store latency instrumentation so this
  blocker cannot regress silently before the next one-agent canary.
- Fresh adapters must keep recall p95 under the strict canary threshold.
- The next canary must collect a fresh runtime window after the bounded
  read-through and store-latency patches are installed.
- The next canary must pass `--since` or `--canary-since` with the timestamp
  recorded at adapter apply time. Older diagnostic history should stay useful
  for diagnosis, but it must not count for or against strict rollout evidence.
- The next operator should run `canary:diagnose` on any failing report and
  attach only the metrics-only output.
- The current sendable handoff packet is
  `recallweave-openclaw-next-agent-canary-20260525-SEND-THIS-ONE-18d606a.zip`, SHA256
  `cb03a1bf25772e2ee397b64f76fa7c485989dd1b3652a37ad8622f6d6ed0289a`.
  Packet generated from controller commit
  `f21a7e751ddcd0b9e64a96d682a3fa0940c17c11`; approved adapter/report
  commit `18d606aff589986b4d8b416a686bedb7ff1506d2`.
  It expects returned canary reports to name commit
  `18d606aff589986b4d8b416a686bedb7ff1506d2`.
  If a newer adapter commit should count, regenerate the packet first.
  It was regenerated from the postwatch batch report with
  `--batch ... --require-ready`. The underlying batch used
  `--allow-failed-inputs`, so one bad sibling archive did not block the selected
  privacy-clean OpenClaw handoff.

## Boundary

This is real external diagnostic evidence, but it is failing evidence. It
should keep the real-container production rollout item incomplete until a fresh
patched one-agent report passes strict intake.
