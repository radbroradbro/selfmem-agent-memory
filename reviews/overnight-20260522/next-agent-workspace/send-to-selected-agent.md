# Send To Selected Agent

Use this message for exactly one OpenClaw agent operator. It is designed to
collect the missing strict-real canary evidence without exposing memory
contents.

```text
Please run the RecallWeave one-agent strict-real canary from the current PR
branch.

Purpose:
- Make RecallWeave/selfmem the native/default memory path for this one agent
  during the test window.
- Keep hosted Supermemory as read-through only.
- Prove local write, local recall, hosted read-through attempt, lifecycle or
  compression coverage, rollback availability, and latency instrumentation.
- Return only metrics-only evidence.

Use the current handoff packet:
- recallweave-openclaw-next-agent-canary-20260524-e3a49a9.zip
- SHA-256: 18eef266c90e5346183082a8bd3794d88081f8b1e7fa03e40ae756031f89baa0
- Expected report commit: e3a49a940ddc313232c21e267cb680ec50206738

Important naming note:
- "Canary" means this is a bounded validation window.
- It is not the memory provider name for user-facing explanations.
- The provider should behave as RecallWeave/selfmem native memory for this
  one-agent test.

Run flow:

1. Inspect the packet README and manifest.
2. Dry-run the updater.

   bin/selfmem_update --host openclaw --repo <openclaw-checkout>

3. If the dry-run is sane, record the fresh window timestamp and apply.

   FRESH_WINDOW_START=$(date -u +"%Y-%m-%dT%H:%M:%SZ") && bin/selfmem_update --host openclaw --repo <openclaw-checkout> --apply && printf "fresh canary window starts at %s\n" "$FRESH_WINDOW_START"

4. Run the patched agent normally for at least 15 minutes after that timestamp.
   Use the drill prompts in strict-real-canary-drill.md to exercise memory.

5. Collect strict-real evidence from the fresh window.

   bin/selfmem_update --host openclaw --repo <openclaw-checkout> --run-canary --rollback-tested --strict-real --canary-since "$FRESH_WINDOW_START" --canary-output /tmp/recallweave-canary-report.json --canary-intake-output /tmp/recallweave-canary-intake.json --canary-diagnosis-output /tmp/recallweave-canary-diagnosis.json --canary-packet-output /tmp/recallweave-canary-evidence-packet.zip

6. Return only:

   /tmp/recallweave-canary-report.json
   /tmp/recallweave-canary-intake.json
   /tmp/recallweave-canary-diagnosis.json, if strict intake failed
   /tmp/recallweave-canary-evidence-packet.zip

Do not return raw memories, raw transcripts, prompts, answers, provider keys,
cookies, private local paths, private container names, or unredacted diagnostic
archives.

Pass criteria:
- Fresh window is at least 15 minutes after adapter apply.
- Strict-real intake passes from non-fixture evidence.
- Store latency sample count is greater than zero.
- Recall p95 and store p95 are each at or below 2500 ms.
- Lifecycle, hybrid search, local writes, hosted read-through, and rollback are
  covered.
- Privacy leak count and secret-pattern hits are zero.
```

After the agent returns the evidence packet, run:

```bash
npm exec --yes pnpm@10.23.0 -- canary:returned-workspace -- --packet <returned-canary-evidence-packet.zip> --workspace reviews/overnight-20260522/next-agent-workspace --require-production-canary --output /tmp/recallweave-returned-workspace.json
```

If the packet lands in the standard local inboxes, run:

```bash
npm exec --yes pnpm@10.23.0 -- canary:returned-downloads -- --require-found --output /tmp/recallweave-returned-downloads.json
```
