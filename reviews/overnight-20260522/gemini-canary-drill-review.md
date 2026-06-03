# Gemini Canary Drill Review

Command:

```bash
gemini --skip-trust --approval-mode plan -p "Cold review the RecallWeave canary drill slice. Inspect repository files only. Scope: packages/bench/canary-drill.mjs, packages/bench/canary-operator-packet.mjs, packages/bench/canary-next-agent-plan.mjs, packages/bench/canary-next-agent-packet.mjs, packages/bench/consumer-install-smoke.mjs, packages/bench/release-readiness-check.mjs, docs/AGENT_LIVE_BUILD_GUIDE.md, docs/RELEASE_HANDOFF.md, README.md, docs/USER_MANUAL.md, and reviews/overnight-20260522/canary-drill-evidence.md. Verify: the drill is public-safe and metrics-only; it reduces the real canary blocker by forcing local write, local recall, hosted read-through attempt, lifecycle or LCM compression coverage, rollback, and strict-real packet collection; it does not authorize public launch or fleet rollout; it does not include raw memories, prompts, transcripts, answers, private paths, or secrets; release and consumer checks cover the new command and packet inclusion. Return exactly: Verdict: CLEAN or Verdict: BLOCKED, then concise findings."
```

Verdict: CLEAN

Findings:

- `packages/bench/canary-drill.mjs` defines `publicSafe: true`,
  `metricsOnly: true`, `publicLaunchAllowed: false`, and
  `fleetRolloutAllowed: false`.
- The drill forces local write, local recall, hosted read-through,
  lifecycle/LCM compression, rollback dry-run, and strict-real packet
  collection.
- Acceptance criteria and forbidden artifacts prohibit raw memories,
  transcripts, prompts, answers, provider keys, cookies, private paths, and
  unredacted diagnostics.
- Runtime assertions guard against key-shaped secrets and raw local paths.
- `canary-operator-packet`, `canary-next-agent-plan`, and
  `canary-next-agent-packet` integrate the drill and include
  `strict-real-canary-drill.md` in the one-agent handoff zip.
- `consumer-install-smoke` and `release-readiness-check` require and run the
  new command.
- The docs incorporate `canary:drill` as the deterministic fresh-window path.
