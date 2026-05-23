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
- `strict-real-canary-drill.md`
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
npm exec --yes pnpm@10.23.0 -- canary:next-agent-packet -- --input-root <redacted-diagnostics-folder> --allow-failed-inputs --require-ready --output <packet.zip>
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
  - `strict-real-canary-drill.md`
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
worktree on 2026-05-23, scanned the local incoming folders, wrote a postwatch
batch report, and generated a fresh sendable packet through the
`--batch ... --require-ready` path.
This is the current packet to hand to the selected OpenClaw operator.
It was regenerated after the next-agent plan made deterministic drill execution
explicit in the main handoff path.

- Packet label: `recallweave-openclaw-next-agent-canary-20260523-postwatch.zip`.
- Packet SHA256:
  `f7317807abe297e9c45fe2a6124d17bc10b1c1537a2b667c5100483bc3ced7e0`.
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
- Postwatch batch result: preserved mixed-folder triage without allowing the
  failed sibling bundle to count as rollout evidence.
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

## Fail-Closed Empty or Handoff-Only Folders

The controller then tested the operator mistake case that caused confusion in
practice: a mixed folder with handoff packets, old diagnostic archives, or no
parseable current canary candidate. The packet path now fails closed with
structured metrics-only JSON rather than an assertion stack trace or stale zip.

Commands:

```bash
npm exec --yes pnpm@10.23.0 -- canary:returned-inbox -- --input-root <mixed-agent-zip-folder> --require-production-canary --output /tmp/recallweave-returned-canary-inbox.json
npm exec --yes pnpm@10.23.0 -- canary:next-agent-packet -- --input-root <mixed-agent-zip-folder> --allow-failed-inputs --output /tmp/recallweave-next-agent-handoff-current.zip
```

Results:

- Returned inbox status: `HANDOFF_PACKETS_ONLY`.
- Returned evidence packets: 0.
- Production evidence packets: 0.
- Handoff packets: 6.
- Diagnostic bundles: 4.
- `canary:next-agent-packet` status: `NO_CANDIDATE`.
- Packet created: false.
- Requested output path is removed on blocked packet creation, preventing stale
  handoff zips from being mistaken for current evidence.
- Public launch allowed: false.
- Fleet rollout allowed: false.
- Blocker preserved: true.
- Stack trace: none in the patched path.

The lower-level `canary:batch-audit` path now also emits a metrics-only empty
folder report with `inputCount: 0`, `parsedInputCount: 0`, and
`countsAsRealRolloutEvidence: false` instead of throwing.

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
- `--allow-failed-inputs` is preserved in the planner and packet manifest so
  mixed diagnostic folders can be triaged directly without hiding failed inputs.
- `--require-ready` fails closed for fixture/demo evidence and passes only when
  the planner reports `READY_FOR_ONE_AGENT_FRESH_CANARY`.
- Empty or handoff-only folders fail closed as structured JSON and remove the
  requested output zip path.
- The manifest includes a fresh-window contract and return checklist.
- The release gate now checks the script, packet entries, README, manifest,
  planner output, operator packet, `--require-ready` fail-closed behavior,
  empty-folder fail-closed behavior, evidence text, and reviewer verdict.
- The clean-consumer smoke now verifies the packet builder exists, runs, and is
  included in the public package dry run.
