# RecallWeave Next Agent Canary Plan

Status: READY_FOR_ONE_AGENT_FRESH_CANARY
Scope: one-agent-fresh-canary
Host: openclaw

## Selected Candidate

- Label: `bundle_8e90781bb060a889`
- Failed checks: `adapter-contract`, `store-latency-instrumented`, `store-p95`
- Recall p95: 1567.346 ms
- Store p95: 0 ms
- Store latency samples: 0
- Privacy leak count: 0

## Focus

- installed-version: Install the current adapter with `bin/selfmem_update --apply` before collecting evidence.
- store-instrumentation: Collect a fresh post-update window with store `elapsed_ms` samples; old bundles with zero store samples cannot pass.

## Commands

### dry-run

Show exactly what will change without copying files.

```bash
bin/selfmem_update --host openclaw --repo <openclaw-checkout>
```

### apply-current-adapter

Apply the current adapter and record the fresh evidence window timestamp.

```bash
FRESH_WINDOW_START=$(date -u +"%Y-%m-%dT%H:%M:%SZ") && bin/selfmem_update --host openclaw --repo <openclaw-checkout> --apply && printf "fresh canary window starts at %s\n" "$FRESH_WINDOW_START"
```

### run-deterministic-drill

Generate and follow the public-safe drill during the fresh window so local write, local recall, hosted read-through, lifecycle/LCM coverage, rollback, and strict intake are deliberate rather than accidental.

```bash
npm exec --yes pnpm@10.23.0 -- canary:drill -- --host openclaw --format markdown --output /tmp/recallweave-canary-drill.md
```

### collect-live-window

After at least 15 minutes of real use following the deterministic drill, collect strict-real metrics and package the returned evidence from the mapped live container.

```bash
bin/selfmem_update --host openclaw --repo <openclaw-checkout> --run-canary --rollback-tested --strict-real --expected-commit 6c3cb1e97978999bc3606eed67f19ba7f208d9e7 --canary-since "$FRESH_WINDOW_START" --canary-output /tmp/recallweave-canary-report.json --canary-intake-output /tmp/recallweave-canary-intake.json --canary-diagnosis-output /tmp/recallweave-canary-diagnosis.json --canary-packet-output /tmp/recallweave-canary-evidence-packet.zip
```

### collect-from-redacted-export

Use only if the agent cannot collect from its live container but can provide a redacted diagnostic export.

```bash
bin/selfmem_update --host openclaw --repo <openclaw-checkout> --run-canary --rollback-tested --strict-real --expected-commit 6c3cb1e97978999bc3606eed67f19ba7f208d9e7 --canary-since "$FRESH_WINDOW_START" --canary-diagnostic-zip <redacted-diagnostic.zip> --canary-output /tmp/recallweave-canary-report.json --canary-intake-output /tmp/recallweave-canary-intake.json --canary-diagnosis-output /tmp/recallweave-canary-diagnosis.json --canary-packet-output /tmp/recallweave-canary-evidence-packet.zip
```

### diagnose-if-failed

If strict intake fails, generate metrics-only remediation.

```bash
npm exec --yes pnpm@10.23.0 -- canary:diagnose -- --report /tmp/recallweave-canary-report.json --output /tmp/recallweave-canary-diagnosis.json
```

### package-passing-evidence

Package a passing strict-real canary. This remains one-agent evidence only.

```bash
npm exec --yes pnpm@10.23.0 -- canary:packet -- --report /tmp/recallweave-canary-report.json --intake /tmp/recallweave-canary-intake.json --strict-real --expected-commit 6c3cb1e97978999bc3606eed67f19ba7f208d9e7 --output /tmp/recallweave-canary-evidence-packet.zip
```

### package-failing-diagnostic

Package diagnosis when strict intake fails. This does not count as rollout evidence.

```bash
npm exec --yes pnpm@10.23.0 -- canary:packet -- --report /tmp/recallweave-canary-report.json --intake /tmp/recallweave-canary-intake.json --diagnosis /tmp/recallweave-canary-diagnosis.json --expected-commit 6c3cb1e97978999bc3606eed67f19ba7f208d9e7 --output /tmp/recallweave-canary-evidence-packet.zip
```

## Pass Criteria

- one agent only until a maintainer reviews the evidence
- fresh post-update window is at least 15 minutes
- RecallWeave/selfmem is the native memory lane for this one agent while hosted Supermemory remains read-through only
- deterministic drill was generated and followed during the fresh window
- strict-real intake passes from non-fixture evidence
- adapter strict canary contract is v1
- search and store latency instrumentation are present
- store latency sample count is greater than zero
- recall p95 and store p95 are each at or below 2500 ms
- lifecycle, hybrid search, local writes, hosted read-through, and rollback are covered
- privacy leak count and secret-pattern hits are zero

Attach only metrics-only report, intake, diagnosis if needed, and packet zip. Do not attach raw logs, memories, prompts, answers, keys, cookies, private local paths, or unredacted diagnostics.
