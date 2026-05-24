# Paste-Ready OpenClaw Canary Handoff

Use this with exactly one OpenClaw agent. Attach the zip named below in the same message. This is a fresh canary window, not a fleet rollout.

Packet:

- `recallweave-openclaw-next-agent-canary-20260524-3d61677.zip`
- SHA256: `15cd332af510b104bd9040ac78e8fff4c1b7ffb3d7628b62bfb897730514f2fe`
- Expected report commit: `3d61677bc3d316e040ac5a634467d0204c272493`

Paste:

```text
Please use the attached RecallWeave OpenClaw canary handoff packet.

Important: this packet is for one fresh canary window only. Do not roll it out to other agents yet.
The returned canary evidence must report commit 3d61677bc3d316e040ac5a634467d0204c272493 or it will count as diagnostic only.

Do this in order:

1. Unzip and read README.md, next-agent-plan.md, strict-real-operator-packet.md, and strict-real-canary-drill.md.
2. Run the dry-run command first and confirm it targets your OpenClaw checkout.
3. Record FRESH_WINDOW_START immediately before applying the adapter.
4. Apply the current adapter only if the dry-run is sane.
5. Use the agent normally for at least 15 minutes after FRESH_WINDOW_START.
6. Run the strict-real collection command from next-agent-plan.md.
7. Return only the metrics-only canary evidence packet and the short JSON/intake status.

Do not return raw memories, raw transcripts, prompts, answers, keys, cookies, private local paths, or unredacted diagnostics.

The run only counts if strict-real intake passes from a non-fixture post-update window. It must prove:

- adapter strict canary contract v1
- search and store latency instrumentation
- store latency sample count greater than zero
- recall p95 and store p95 at or below 2500 ms
- lifecycle, hybrid search, local writes, hosted read-through, and rollback covered
- privacy leak count and secret-pattern hits equal zero

If strict intake fails, run the diagnosis command and return the metrics-only diagnosis plus the evidence packet. A failed canary is still useful, but it is not production rollout evidence.
```

Controller note: the selected prior diagnostic was privacy-clean and had lifecycle coverage, hybrid search, local writes, hosted read-through, and recall p95 `1567.346 ms`. It failed only because the old window lacked the current adapter contract and positive store latency samples.
