# Canary Returned Workspace Evidence

Date: 2026-05-23

## Scope

Added `canary:returned-workspace`, a metrics-only helper that turns a returned
one-agent canary evidence packet into markdown findings for
`reviews/overnight-20260522/next-agent-workspace/`.

The helper writes:

- `operator-findings-returned.md`
- `returned-packet-intake.md`
- `returned-packet-intake.json`

It does not authorize public launch, fleet rollout, or goal completion. It
preserves the existing release blocker unless the returned packet passes
`canary:returned-packet -- --require-production-canary` and the owner approves
promotion.

## Commands

```bash
node --check packages/bench/canary-returned-workspace.mjs
node packages/bench/canary-returned-workspace.mjs --workspace <temp-workspace> --output <temp-summary.json>
node packages/bench/canary-returned-workspace.mjs --workspace <temp-workspace> --require-production-canary
```

## Fixture Result

- Mode: `canary-returned-workspace`.
- Writes real files: true.
- Metrics only: true.
- Generated fixture packet: true.
- Counts as production canary evidence: false.
- Public launch allowed: false.
- Fleet rollout allowed: false.
- Workspace files:
  - `operator-findings-returned.md`
  - `returned-packet-intake.md`
  - `returned-packet-intake.json`
- Fixture strict-production mode exits nonzero, as expected.

## Guardrails

- The helper scans packet entries, generated markdown, JSON output, and command
  output for key-shaped strings and private local paths.
- The helper writes packet basenames and hashes only, not raw packet paths.
- Raw memories, transcripts, prompts, answers, provider keys, cookies, private
  local paths, private container names, and unredacted diagnostics remain
  forbidden.
- Fixture packets never count as production canary evidence.
