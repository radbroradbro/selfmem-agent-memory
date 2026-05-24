# Canary Next-Agent Plan Evidence

Date: 2026-05-23

## Scope

Added `canary:next-agent`, a metrics-only planner that turns a canary batch
audit into a single next-agent update plan. The command is meant for the
controller after multiple agents return redacted diagnostics. It chooses the
closest privacy-clean candidate, names the failed strict checks, and prints a
paste-ready one-agent command sequence for dry-run, adapter apply,
deterministic drill generation, fresh-window collection, strict intake,
diagnosis, and metrics-only packet packaging. The
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
  deterministic drill, strict-real intake, and packet-output paths.

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
`recallweave-openclaw-next-agent-canary-20260524-SEND-THIS-ONE-18d606a.zip`, SHA256
`f5aa0f89f250b695152218b542c9bf498de7e2b3b291ce6081451dfb23565cda`.
It was generated from controller commit
`18d606aff589986b4d8b416a686bedb7ff1506d2` and approves adapter commit
`18d606aff589986b4d8b416a686bedb7ff1506d2`.
It expects returned canary reports to name commit
`18d606aff589986b4d8b416a686bedb7ff1506d2`.
If a newer adapter commit should count, regenerate the packet first.

The packet was regenerated from the postwatch batch report with
`--batch ... --require-ready`. The underlying batch was collected with
`--allow-failed-inputs`, so one failed sibling bundle did not block the selected
privacy-clean OpenClaw candidate.

It contains only:

- `README.md`
- `manifest.json`
- `next-agent-plan.json`
- `next-agent-plan.md`
- `strict-real-canary-drill.md`
- `strict-real-operator-packet.md`

The packet scan found zero key-shaped text and zero private local paths.

## Interpretation

The next real canary should be one OpenClaw runtime with the current adapter
installed through `selfmem_update`, followed by the deterministic drill and a
fresh post-update runtime window. The previous diagnostics show good privacy,
lifecycle, hybrid search, local writes, and recall latency, but they cannot
pass strict intake until the adapter contract and store latency instrumentation
are present in the fresh window.

## Guardrails

- The command never prints raw filenames, paths, memories, prompts, answers, or
  credentials.
- Fixture evidence can generate a practice plan but cannot set
  `oneAgentCanaryAllowed`.
- Public launch and fleet rollout stay false in every output.
- The generated command plan includes rollback-tested strict intake and a
  diagnosis path for failed evidence.
- The generated command plan now requires the deterministic drill and states
  that RecallWeave/selfmem is the native memory lane while hosted Supermemory is
  read-through only.
- The generated fresh-window command includes `--canary-intake-output`,
  `--canary-diagnosis-output`, and `--canary-packet-output` so the selected
  agent can return one metrics-only evidence packet without hand-running
  separate packaging commands.
- Only metrics-only report, intake, diagnosis, and packet files are permitted
  attachments.
