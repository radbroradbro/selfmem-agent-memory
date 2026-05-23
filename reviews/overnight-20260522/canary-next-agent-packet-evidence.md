# Canary Next-Agent Handoff Packet Evidence

Date: 2026-05-23

## Scope

Added `canary:next-agent-packet`, a public-safe packet builder that turns the
metrics-only next-agent plan into a single public-safe zip for one selected
agent operator.

The packet includes only:

- `README.md`
- `manifest.json`
- `next-agent-plan.json`
- `next-agent-plan.md`
- `strict-real-operator-packet.md`

It does not include raw diagnostic bundles, raw memories, transcripts, prompts,
answers, provider keys, cookies, private local paths, or hosted/local memory
contents.

## Commands

```bash
node --check packages/bench/canary-next-agent-packet.mjs
npm exec --yes pnpm@10.23.0 -- canary:next-agent-packet -- --output <packet.zip>
npm exec --yes pnpm@10.23.0 -- canary:next-agent-packet -- --batch <metrics-only-batch.json> --output <packet.zip>
```

## Fixture Packet Result

- Mode: `canary-next-agent-handoff-packet`.
- Writes real files: true.
- Public safe: true.
- Metrics only: true.
- Public launch allowed: false.
- Fleet rollout allowed: false.
- Host: Hermes.
- Status: `FIXTURE_PLAN_ONLY`.
- One-agent canary allowed: false.
- Entries:
  - `README.md`
  - `manifest.json`
  - `next-agent-plan.json`
  - `next-agent-plan.md`
  - `strict-real-operator-packet.md`

## Real Redacted Batch Packet Result

The command was also run against the latest redacted diagnostic batch output.
No raw diagnostic, memory, transcript, prompt, answer, credential, container
name, or private local path content was written to the repo.

- Packet label: `recallweave-real-openclaw-next-agent-handoff.zip`.
- Packet SHA256:
  `950e68ea59bcea0ade8b2dfd81ea8820afebf47f451b922670cd92f79335d161`.
- Mode: `canary-next-agent-handoff-packet`.
- Public safe: true.
- Metrics only: true.
- Public launch allowed: false.
- Fleet rollout allowed: false.
- Host: OpenClaw.
- Status: `READY_FOR_ONE_AGENT_FRESH_CANARY`.
- One-agent canary allowed: true.
- Selected candidate label: `bundle_8e90781bb060a889`.
- Failed checks:
  - `adapter-contract`
  - `store-latency-instrumented`
  - `store-p95`
- Recall p95: 1567.346 ms.
- Store p95: 0 ms.
- Store latency samples: 0.
- Privacy leak count: 0.
- Batch inputs: 9.
- Batch parsed inputs: 8.
- Batch failed inputs: 1.
- Strict-real pass count: 0.

## Interpretation

This packet does not close the real-container rollout blocker by itself. It
reduces the next operator error rate by bundling the fresh-window instructions,
strict-real collection commands, and attach-back policy into one metrics-only
artifact. The selected OpenClaw agent still must install the current adapter,
run a fresh window for at least 15 minutes, and return a passing strict-real
canary evidence packet before the rollout blocker can close.

## Guardrails

- The packet builder scans all generated text for key-shaped strings and private
  local paths before writing the zip.
- The packet contains no raw diagnostic input.
- The packet keeps public launch and fleet rollout false.
- The release gate now checks the script, packet entries, README, manifest,
  planner output, operator packet, evidence text, and reviewer verdict.
- The clean-consumer smoke now verifies the packet builder exists, runs, and is
  included in the public package dry run.
