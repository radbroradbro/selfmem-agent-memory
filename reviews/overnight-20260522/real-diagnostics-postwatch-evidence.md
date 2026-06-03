# Real Diagnostics Post-Watch Evidence

Date: 2026-05-23
Latest returned-watch refresh: 2026-06-01
Latest returned-supervisor refresh: 2026-06-03

## Scope

This note records the post-watch triage pass over the returned diagnostic
bundles currently available to the controller. It is metrics-only and public
safe. It does not include raw memories, raw transcripts, raw prompts, raw
answers, credentials, private labels, or local filesystem paths.

## Commands

```bash
npm exec --yes pnpm@10.23.0 -- canary:returned-watch -- --input-root <downloads-folder> --input-root <telegram-download-folder> --include-all-zips --iterations 1 --output reviews/overnight-20260522/real-diagnostics-postwatch-returned-watch.json
npm exec --yes pnpm@10.23.0 -- canary:batch-audit -- --input-root <telegram-download-folder> --allow-failed-inputs --output reviews/overnight-20260522/real-diagnostics-postwatch-batch-audit.json
npm exec --yes pnpm@10.23.0 -- canary:next-agent -- --batch reviews/overnight-20260522/real-diagnostics-postwatch-batch-audit.json --format json --expected-commit 5ac6c50e845c4c8d8e5d358e604700e4163b7fea --output reviews/overnight-20260522/real-diagnostics-postwatch-next-agent-plan.json
npm exec --yes pnpm@10.23.0 -- canary:next-agent -- --batch reviews/overnight-20260522/real-diagnostics-postwatch-batch-audit.json --format markdown --expected-commit 5ac6c50e845c4c8d8e5d358e604700e4163b7fea --output reviews/overnight-20260522/real-diagnostics-postwatch-next-agent-plan.md
npm exec --yes pnpm@10.23.0 -- canary:next-agent-packet -- --batch reviews/overnight-20260522/real-diagnostics-postwatch-batch-audit.json --host openclaw --allow-failed-inputs --require-ready --expected-commit 5ac6c50e845c4c8d8e5d358e604700e4163b7fea --output <downloads-folder>/recallweave-openclaw-next-agent-canary-20260601-SEND-THIS-ONE-5ac6c50.zip
npm exec --yes pnpm@10.23.0 -- canary:returned-downloads:strict -- --expected-commit 5ac6c50e845c4c8d8e5d358e604700e4163b7fea --output reviews/overnight-20260522/returned-downloads-current-scan.json --findings-output reviews/overnight-20260522/returned-downloads-current-scan.md
npm exec --yes pnpm@10.23.0 -- canary:returned-supervisor -- --include-all-zips --expected-commit 5ac6c50e845c4c8d8e5d358e604700e4163b7fea --output reviews/overnight-20260522/returned-canary-supervisor-current.json --findings-output reviews/overnight-20260522/returned-canary-supervisor-current.md
```

## Returned Watch Result

- Status: `AWAITING_RETURNED_PRODUCTION_CANARY`
- Production canary packets: `0`
- Returned evidence packets: `0`
- Handoff packets: `1`
- Diagnostic bundles: `11`
- Candidate labels: hash-redacted
- Expected report commit: `5ac6c50e845c4c8d8e5d358e604700e4163b7fea`

This confirms the incoming folders contain useful diagnostics and handoff
packets, but no strict returned production canary evidence yet.

## Current Returned Supervisor Refresh

- Status: `AWAITING_RETURNED_PRODUCTION_CANARY`
- Scanned zips: `37`
- Production canary packets: `0`
- Returned evidence packets: `0`
- Handoff packets: `1`
- Diagnostic bundles: `11`
- Unknown packets: `25`
- Expected report commit: `5ac6c50e845c4c8d8e5d358e604700e4163b7fea`

This confirms the current inbox still has the request packet and diagnostic
material, but no strict-real returned production canary packet. The blocker is
therefore external to this repo until the selected OpenClaw agent runs the
fresh 15-minute canary window and returns the metrics-only evidence packet.

## Diagnostic Batch Result

- Inputs: `9`
- Parsed inputs: `8`
- Failed inputs: `1`
- Strict-real passes: `0`
- Privacy leak count on selected candidate: `0`
- Selected host: `openclaw`
- Selected candidate label: `bundle_8e90781bb060a889`
- Selected candidate status: `READY_FOR_ONE_AGENT_FRESH_CANARY`

The selected candidate already shows lifecycle coverage, hybrid search, local
writes, hosted read-through, and clean privacy counters. It is still blocked as
production evidence because the diagnostic came from an older adapter contract
and lacked store latency instrumentation.

## Fresh Canary Packet

- Packet label: `recallweave-openclaw-next-agent-canary-20260601-SEND-THIS-ONE-5ac6c50.zip`
- SHA-256: `a434cbebec609f3427ba9c42ec467b650d5f414040caef0b3141df182d8b4ff2`
- Packet generated from controller commit:
  `5ac6c50e845c4c8d8e5d358e604700e4163b7fea`
- Approved adapter commit:
  `5ac6c50e845c4c8d8e5d358e604700e4163b7fea`
- Expected report commit:
  `5ac6c50e845c4c8d8e5d358e604700e4163b7fea`
- Entries:
  - `README.md`
  - `manifest.json`
  - `next-agent-plan.json`
  - `next-agent-plan.md`
  - `strict-real-canary-drill.md`
  - `strict-real-operator-packet.md`

## Release Meaning

The next action is a one-agent fresh OpenClaw canary using the current adapter.
The current packet requires the deterministic drill before evidence collection,
so the fresh window should deliberately exercise local write, local recall,
hosted read-through, lifecycle or LCM coverage, and rollback.
This evidence does not permit public launch, fleet rollout, or goal completion.
It narrows the real-container blocker to one fresh post-update runtime window
with strict returned-packet verification.
