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
npm exec --yes pnpm@10.23.0 -- canary:next-agent-packet -- --require-ready --output <packet.zip>
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
- Ready for live handoff: false.
- `--require-ready` result: rejected fixture evidence with
  `READY_FOR_ONE_AGENT_FRESH_CANARY` required.
- Entries:
  - `README.md`
  - `manifest.json`
  - `next-agent-plan.json`
  - `next-agent-plan.md`
  - `strict-real-operator-packet.md`

## Earlier Real Redacted Batch Packet Result

The command was also run against an earlier broader redacted diagnostic batch
output. The current returned-diagnostics packet is recorded in the next section.
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
- Ready for live handoff: true.
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

## Current Returned Diagnostics Packet Result

The controller reran the current returned diagnostic set from the active
worktree on 2026-05-23 and generated a fresh sendable packet. This is the
current packet to hand to the selected OpenClaw operator.

- Packet label: `recallweave-openclaw-next-agent-canary-20260523-current.zip`.
- Packet SHA256:
  `98a3e2263fd4803b35e00ee672587e89c05887bed8726d40539531f40f3c9a4c`.
- Mode: `canary-next-agent-handoff-packet`.
- Public safe: true.
- Metrics only: true.
- Public launch allowed: false.
- Fleet rollout allowed: false.
- Host: OpenClaw.
- Status: `READY_FOR_ONE_AGENT_FRESH_CANARY`.
- One-agent canary allowed: true.
- Ready for live handoff: true.
- `--require-ready` result: passed for the non-fixture OpenClaw handoff packet.
- Selected candidate label: `bundle_8e90781bb060a889`.
- Failed checks:
  - `adapter-contract`
  - `store-latency-instrumented`
  - `store-p95`
- Recall p95: 1567.346 ms.
- Store p95: 0 ms.
- Store latency samples: 0.
- Privacy leak count: 0.
- Batch inputs: 5.
- Batch parsed inputs: 4.
- Batch failed inputs: 1.
- Strict-real pass count: 0.

## Interpretation

This packet does not close the real-container rollout blocker by itself. It
reduces the next operator error rate by bundling the fresh-window instructions,
strict-real collection commands, return checklist, fresh-window contract, and
attach-back policy into one metrics-only artifact. The selected OpenClaw agent
still must install the current adapter, run a fresh window for at least 15
minutes, and return a passing strict-real canary evidence packet before the
rollout blocker can close.

## Guardrails

- The packet builder scans all generated text for key-shaped strings and private
  local paths before writing the zip.
- The packet contains no raw diagnostic input.
- The packet keeps public launch and fleet rollout false.
- The packet records `readyForLiveHandoff` separately from
  `oneAgentCanaryAllowed`.
- `--require-ready` fails closed for fixture/demo evidence and passes only when
  the planner reports `READY_FOR_ONE_AGENT_FRESH_CANARY`.
- The manifest includes a fresh-window contract and return checklist.
- The release gate now checks the script, packet entries, README, manifest,
  planner output, operator packet, `--require-ready` fail-closed behavior,
  evidence text, and reviewer verdict.
- The clean-consumer smoke now verifies the packet builder exists, runs, and is
  included in the public package dry run.
