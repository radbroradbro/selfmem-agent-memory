# Canary Operator Packet Evidence

Date: 2026-05-22

Scope:

- Added `packages/bench/canary-operator-packet.mjs`.
- Added `canary:operator-packet` as a package script.
- The packet gives agents a single public-safe strict-real canary operator packet
  for Hermes or OpenClaw.
- It prints placeholders, metrics-only report paths, acceptance criteria, and
  forbidden attachments.

Commands:

```bash
npm exec --yes pnpm@10.23.0 -- canary:operator-packet
npm exec --yes pnpm@10.23.0 -- canary:operator-packet -- --host openclaw --format markdown
```

Expected behavior:

- JSON mode reports `mode: strict-real-canary-operator-packet`.
- Markdown mode prints a paste-ready operator packet.
- `writesRealFiles` is false.
- The packet requires a live mapped container or explicit redacted diagnostic
  directory/zip.
- It requires operators to record a fresh-window timestamp when the patched
  adapter is applied, run the agent for at least 15 minutes, and collect with
  `--canary-since` so old trace history cannot prove or poison the run.
- It tells operators to attach only:
  - `/tmp/recallweave-canary-report.json`
  - `/tmp/recallweave-canary-intake.json`
  - `/tmp/recallweave-canary-diagnosis.json` when strict intake fails
- It forbids raw memories, transcripts, prompts, answers, provider keys,
  cookies, private local paths, and unredacted diagnostic archives.
- It names the pass criteria that matter for the current blocker:
  `canaryPass: true`, `fixtureOnly: false`,
  `countsAsRealRolloutEvidence: true`, a post-update `windowFilter.since`,
  strict v1 adapter contract markers, fresh duration of at least 15 minutes,
  store latency samples present, no missing store latency, recall/store p95 at
  or below 2500 ms, lifecycle coverage, hybrid search coverage, local writes,
  hosted read-through, and rollback coverage.

Boundary:

- This packet does not complete the real-container rollout.
- It is an operator collection aid so the next live canary can produce the
  right metrics-only evidence without sending private logs.
