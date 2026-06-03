# Canary Returned Packet Intake Evidence

Date: 2026-05-23

## Scope

Added `canary:returned-packet`, a public-safe intake command for each returned
evidence packet from one selected agent operator. It wraps the existing
metrics-only packet reviewer and gives maintainers one verdict field:

- `READY_FOR_MAINTAINER_PROMOTION` when the packet can count as one-agent
  production canary evidence.
- `NOT_PRODUCTION_EVIDENCE` when the packet is a fixture, fails strict-real
  review, or needs another fresh window.
- `UNREADABLE_PACKET` when the packet cannot be parsed.

The command never permits public launch or fleet rollout by itself.
This is the returned evidence packet intake gate for the one-agent canary loop.

## Commands

```bash
node --check packages/bench/canary-returned-packet-intake.mjs
npm exec --yes pnpm@10.23.0 -- canary:returned-packet
npm exec --yes pnpm@10.23.0 -- canary:returned-packet -- --packet <returned-canary-evidence-packet.zip> --output <intake.json>
npm exec --yes pnpm@10.23.0 -- canary:returned-packet -- --packet <returned-canary-evidence-packet.zip> --require-production-canary --output <intake.json>
```

## Fixture Result

- Mode: `canary-returned-packet-intake`.
- Metrics only: true.
- Default fixture status: `NOT_PRODUCTION_EVIDENCE`.
- Default fixture counts as production canary evidence: false.
- Public launch allowed: false.
- Fleet rollout allowed: false.
- Packet entries:
  - `README.md`
  - `canary-report.json`
  - `manifest.json`

## Returned Packet Simulation

A locally generated fixture packet was passed through the returned-packet intake
path. Because providing `--packet` implies strict-real review, the fixture packet
remained `NOT_PRODUCTION_EVIDENCE` and did not count as production canary
evidence.

With `--require-production-canary`, the same fixture packet failed closed with a
nonzero exit code. The output remained machine-readable and metrics-only, with
`failedChecks` containing `strict-real-passed`.

## Guardrails

- Only the packet basename and SHA are reported, never the input path.
- The wrapper scans generated output for key-shaped strings and private local
  paths.
- The wrapper keeps public launch and fleet rollout false even if strict-real
  canary evidence passes.
- `--require-production-canary` is the release-blocking mode for returned agent
  packets.
- Release gates now require this command, its evidence, and reviewer approval.
