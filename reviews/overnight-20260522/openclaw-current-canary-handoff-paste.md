# Paste-Ready OpenClaw Canary Handoff

Use this with exactly one OpenClaw agent. Attach the zip named below in the same message, plus the send instructions and checksum note. This is a fresh canary window, not a fleet rollout.

Send files:

- `recallweave-openclaw-next-agent-canary-20260525-SEND-THIS-ONE-18d606a.zip`
- `recallweave-SEND-THIS-ONE-openclaw-canary-instructions.md`
- `recallweave-SEND-THIS-ONE-checksum.txt`

Packet:

- Zip: `recallweave-openclaw-next-agent-canary-20260525-SEND-THIS-ONE-18d606a.zip`
- SHA256: `cb03a1bf25772e2ee397b64f76fa7c485989dd1b3652a37ad8622f6d6ed0289a`
- Packet generated from controller commit: `f21a7e751ddcd0b9e64a96d682a3fa0940c17c11`
- Approved adapter commit: `18d606aff589986b4d8b416a686bedb7ff1506d2`
- Expected report commit: `18d606aff589986b4d8b416a686bedb7ff1506d2`

Paste:

```text
Please use the attached RecallWeave OpenClaw canary handoff packet.

Important: this packet is for one fresh canary window only. Do not roll it out to other agents yet.
For this one selected OpenClaw agent, RecallWeave/selfmem should become the native/default memory slot during the canary window. Do not leave it installed as shadow-only or manual-only.
The `selfmem_canary` label is a compatibility/plugin id, not a request to keep it non-default.
Hosted Supermemory remains read-through/history only. New memory writes during this canary should land locally in RecallWeave/selfmem.
Commit note: this packet was generated from controller commit f21a7e751ddcd0b9e64a96d682a3fa0940c17c11, but the approved adapter/report commit for this canary is 18d606aff589986b4d8b416a686bedb7ff1506d2. If a newer adapter commit should count, regenerate the packet first.
The returned canary evidence must report commit 18d606aff589986b4d8b416a686bedb7ff1506d2 or it will count as diagnostic only.

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

- native/default memory slot status for RecallWeave/selfmem
- hosted Supermemory write-back disabled and read-through/history mode only
- adapter strict canary contract v1
- search and store latency instrumentation
- store latency sample count greater than zero
- recall p95 and store p95 at or below 2500 ms
- lifecycle, hybrid search, local writes, hosted read-through, and rollback covered
- privacy leak count and secret-pattern hits equal zero

If strict intake fails, run the diagnosis command and return the metrics-only diagnosis plus the evidence packet. A failed canary is still useful, but it is not production rollout evidence.
```

Controller note: the selected prior diagnostic was privacy-clean and had lifecycle coverage, hybrid search, local writes, hosted read-through, and recall p95 `1567.346 ms`. It failed only because the old window lacked the current adapter contract and positive store latency samples.
