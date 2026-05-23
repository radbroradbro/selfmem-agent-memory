# Real Next-Agent OpenClaw Canary Plan

Date: 2026-05-23

## Scope

This is the paste-ready, metrics-only next-agent plan produced from the latest
redacted diagnostics batch. It selects one OpenClaw agent for a fresh
post-update canary window. It does not expose raw memories, transcripts,
prompts, answers, credentials, filenames, private local paths, or container
names.

This does not complete the real rollout blocker. It tells the next operator
exactly how to collect the evidence that could close that blocker later.

## Controller Result

- Status: `READY_FOR_ONE_AGENT_FRESH_CANARY`.
- Scope: `one-agent-fresh-canary`.
- Host: `openclaw`.
- Candidate label: `bundle_8e90781bb060a889`.
- Failed checks:
  - `adapter-contract`
  - `store-latency-instrumented`
  - `store-p95`
- Recall p95: 1567.346 ms.
- Store p95: 0 ms.
- Store latency samples: 0.
- Privacy leak count: 0.
- Batch parsed inputs: 8.
- Batch failed inputs: 1.
- Strict-real pass count: 0.

## Paste-Ready Plan

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

### collect-live-window

After at least 15 minutes of real use, collect strict-real metrics from the
mapped live container.

```bash
bin/selfmem_update --host openclaw --repo <openclaw-checkout> --run-canary --rollback-tested --strict-real --canary-since "$FRESH_WINDOW_START" --canary-output /tmp/recallweave-canary-report.json && npm exec --yes pnpm@10.23.0 -- canary:intake -- --report /tmp/recallweave-canary-report.json --strict-real --output /tmp/recallweave-canary-intake.json
```

### collect-from-redacted-export

Use only if the agent cannot collect from its live container but can provide a
redacted diagnostic export.

```bash
bin/selfmem_update --host openclaw --repo <openclaw-checkout> --run-canary --rollback-tested --strict-real --canary-since "$FRESH_WINDOW_START" --canary-diagnostic-zip <redacted-diagnostic.zip> --canary-output /tmp/recallweave-canary-report.json && npm exec --yes pnpm@10.23.0 -- canary:intake -- --report /tmp/recallweave-canary-report.json --strict-real --output /tmp/recallweave-canary-intake.json
```

### diagnose-if-failed

If strict intake fails, generate metrics-only remediation.

```bash
npm exec --yes pnpm@10.23.0 -- canary:diagnose -- --report /tmp/recallweave-canary-report.json --output /tmp/recallweave-canary-diagnosis.json
```

### package-passing-evidence

Package a passing strict-real canary. This remains one-agent evidence only.

```bash
npm exec --yes pnpm@10.23.0 -- canary:packet -- --report /tmp/recallweave-canary-report.json --intake /tmp/recallweave-canary-intake.json --strict-real --output /tmp/recallweave-canary-evidence-packet.zip
```

### package-failing-diagnostic

Package diagnosis when strict intake fails. This does not count as rollout
evidence.

```bash
npm exec --yes pnpm@10.23.0 -- canary:packet -- --report /tmp/recallweave-canary-report.json --intake /tmp/recallweave-canary-intake.json --diagnosis /tmp/recallweave-canary-diagnosis.json --output /tmp/recallweave-canary-evidence-packet.zip
```

## Pass Criteria

- One agent only until a maintainer reviews the evidence.
- Fresh post-update window is at least 15 minutes.
- Strict-real intake passes from non-fixture evidence.
- Adapter strict canary contract is v1.
- Search and store latency instrumentation are present.
- Store latency sample count is greater than zero.
- Recall p95 and store p95 are each at or below 2500 ms.
- Lifecycle, hybrid search, local writes, hosted read-through, and rollback are
  covered.
- Privacy leak count and secret-pattern hits are zero.

Attach only metrics-only report, intake, diagnosis if needed, and packet zip.
Do not attach raw logs, memories, prompts, answers, keys, cookies, private local
paths, or unredacted diagnostics.
