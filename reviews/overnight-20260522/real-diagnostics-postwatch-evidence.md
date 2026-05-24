# Real Diagnostics Post-Watch Evidence

Date: 2026-05-23
Latest returned-watch refresh: 2026-05-24

## Scope

This note records the post-watch triage pass over the returned diagnostic
bundles currently available to the controller. It is metrics-only and public
safe. It does not include raw memories, raw transcripts, raw prompts, raw
answers, credentials, private labels, or local filesystem paths.

## Commands

```bash
npm exec --yes pnpm@10.23.0 -- canary:returned-watch -- --input-root <downloads-folder> --input-root <telegram-download-folder> --include-all-zips --iterations 1 --output reviews/overnight-20260522/real-diagnostics-postwatch-returned-watch.json
npm exec --yes pnpm@10.23.0 -- canary:batch-audit -- --input-root <telegram-download-folder> --allow-failed-inputs --output reviews/overnight-20260522/real-diagnostics-postwatch-batch-audit.json
npm exec --yes pnpm@10.23.0 -- canary:next-agent -- --batch reviews/overnight-20260522/real-diagnostics-postwatch-batch-audit.json --format json --output reviews/overnight-20260522/real-diagnostics-postwatch-next-agent-plan.json
npm exec --yes pnpm@10.23.0 -- canary:next-agent -- --batch reviews/overnight-20260522/real-diagnostics-postwatch-batch-audit.json --format markdown --output reviews/overnight-20260522/real-diagnostics-postwatch-next-agent-plan.md
npm exec --yes pnpm@10.23.0 -- canary:next-agent-packet -- --batch reviews/overnight-20260522/real-diagnostics-postwatch-batch-audit.json --require-ready --expected-commit 3d61677bc3d316e040ac5a634467d0204c272493 --output <downloads-folder>/recallweave-openclaw-next-agent-canary-20260524-3d61677.zip
```

## Returned Watch Result

- Status: `AWAITING_RETURNED_PRODUCTION_CANARY`
- Production canary packets: `0`
- Returned evidence packets: `0`
- Handoff packets: `10`
- Diagnostic bundles: `8`
- Candidate labels: hash-redacted

This confirms the incoming folders contain useful diagnostics and handoff
packets, but no strict returned production canary evidence yet.

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

- Packet label: `recallweave-openclaw-next-agent-canary-20260524-3d61677.zip`
- SHA-256: `994d941bf69e83b8149f2ec23e24eb9fdb1e68240450cb7bcf64ffd012f17174`
- Packet generated from controller commit:
  `72a21eee898ee1681892254608593bbda5fc02aa`
- Approved adapter commit:
  `3d61677bc3d316e040ac5a634467d0204c272493`
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
