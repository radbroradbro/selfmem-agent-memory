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
node packages/bench/canary-returned-workspace.mjs
node packages/bench/canary-returned-workspace.mjs --workspace <temp-workspace> --output <temp-summary.json>
node packages/bench/canary-returned-workspace.mjs --workspace <temp-workspace> --require-production-canary
```

When no returned packet is supplied, the helper generates a fixture packet and
writes fixture workspace files to a temporary directory by default. This keeps
routine fixture verification from creating review-workspace files that could be
mistaken for returned operator evidence. When `--packet` is supplied, the
default workspace remains `reviews/overnight-20260522/next-agent-workspace/`.

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

## Recheck 2026-05-23T20:17Z

- `node --check packages/bench/canary-returned-workspace.mjs`: passed.
- `node packages/bench/canary-returned-workspace.mjs --output
  /tmp/recallweave-returned-workspace-default-smoke.json`: passed, used a
  temporary default workspace for the generated fixture packet, and did not
  leave files in `reviews/overnight-20260522/next-agent-workspace/`.
- `node packages/bench/canary-returned-workspace.mjs --workspace
  /tmp/recallweave-returned-workspace-check --output
  /tmp/recallweave-returned-workspace-check.json`: passed and reported
  `countsAsProductionCanaryEvidence: false`.
- `node packages/bench/canary-returned-workspace.mjs --workspace
  /tmp/recallweave-returned-workspace-required
  --require-production-canary`: exited nonzero, as expected, because the
  generated fixture packet is not production canary evidence.
- `npm exec --yes pnpm@10.23.0 -- release:check`: passed, including the fresh
  returned canary workspace generator subcheck.
- `npm exec --yes pnpm@10.23.0 -- release:github-sync`: passed after the PR
  branch was fast-forwarded to include the returned-workspace helper.
