# Canary Next-Agent Plan Evidence

Date: 2026-05-23

## Scope

Added `canary:next-agent`, a metrics-only planner that turns a canary batch
audit into a single next-agent update plan. The command is meant for the
controller after multiple agents return redacted diagnostics. It chooses the
closest privacy-clean candidate, names the failed strict checks, and prints a
paste-ready one-agent command sequence for dry-run, adapter apply, fresh-window
collection, strict intake, diagnosis, and metrics-only packet packaging. The
fresh-window collection step now uses `selfmem_update` to write the report,
intake, optional diagnosis, and evidence packet in one run, which reduces the
chance that an agent returns only partial canary evidence.

This does not approve fleet rollout or public launch. It reduces operator
confusion by producing one bounded plan from the batch evidence.

## Commands

```bash
node --check packages/bench/canary-next-agent-plan.mjs
node packages/bench/canary-next-agent-plan.mjs
node packages/bench/canary-next-agent-plan.mjs --format markdown
node packages/bench/canary-next-agent-plan.mjs --input-root <redacted-diagnostics-folder>
```

## Fixture Result

- Mode: `canary-next-agent-plan`.
- Writes real files: false.
- Metrics only: true.
- Public launch allowed: false.
- Fleet rollout allowed: false.
- Operator packet available: true.
- One-agent canary allowed: false, because the selected candidate is
  fixture-only.
- Status: `FIXTURE_PLAN_ONLY`.
- Selected candidate privacy leak count: 0.
- Selected candidate store latency samples: positive.
- The generated Markdown includes the fresh-window timestamp step and the
  strict-real intake and packet-output paths.

## Real Redacted Batch Result

The command was also run against the available redacted diagnostic return set.
No raw diagnostic, memory, transcript, prompt, answer, credential, or local path
content was written to the repo.

- Input count: 9.
- Parsed input count: 8.
- Failed input count: 1.
- Strict-real pass count: 0.
- Selected host: OpenClaw.
- Selected candidate fixture-only: false.
- Selected candidate privacy leak count: 0.
- Selected candidate secret-pattern hits: 0.
- Selected candidate lifecycle covered: true.
- Selected candidate hybrid search covered: true.
- Selected candidate local writes observed: true.
- Selected candidate hosted read-through observed: true.
- Selected candidate recall p95: 1567.346 ms.
- Selected candidate store p95: 0 ms.
- Selected candidate store latency samples: 0.
- Failed checks:
  - `adapter-contract`
  - `store-latency-instrumented`
  - `store-p95`

## Current Handoff Packet

The current next-agent handoff packet is
`recallweave-openclaw-next-agent-canary-20260523-continued.zip`, SHA256
`5967d1fa0ce84aaf1d7890017c6e32cc6fb2960e2c2d0cbb38ae2522be6ec5bf`.

It contains only:

- `README.md`
- `manifest.json`
- `next-agent-plan.json`
- `next-agent-plan.md`
- `strict-real-operator-packet.md`

The packet scan found zero key-shaped text and zero private local paths.

## Interpretation

The next real canary should be one OpenClaw runtime with the current adapter
installed through `selfmem_update`, followed by a fresh post-update runtime
window. The previous diagnostics show good privacy, lifecycle, hybrid search,
local writes, and recall latency, but they cannot pass strict intake until the
adapter contract and store latency instrumentation are present in the fresh
window.

## Guardrails

- The command never prints raw filenames, paths, memories, prompts, answers, or
  credentials.
- Fixture evidence can generate a practice plan but cannot set
  `oneAgentCanaryAllowed`.
- Public launch and fleet rollout stay false in every output.
- The generated command plan includes rollback-tested strict intake and a
  diagnosis path for failed evidence.
- The generated fresh-window command includes `--canary-intake-output`,
  `--canary-diagnosis-output`, and `--canary-packet-output` so the selected
  agent can return one metrics-only evidence packet without hand-running
  separate packaging commands.
- Only metrics-only report, intake, diagnosis, and packet files are permitted
  attachments.
