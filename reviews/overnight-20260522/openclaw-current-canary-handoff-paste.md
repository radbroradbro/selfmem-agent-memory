# Paste-Ready OpenClaw Canary Handoff

Use this with exactly one OpenClaw agent. Attach the zip named below in the
same message. This is a fresh canary window, not a fleet rollout.

Send file:

- `recallweave-openclaw-next-agent-canary-20260601-SEND-THIS-ONE-5ac6c50.zip`

Packet:

- Zip: `recallweave-openclaw-next-agent-canary-20260601-SEND-THIS-ONE-5ac6c50.zip`
- SHA256: `a434cbebec609f3427ba9c42ec467b650d5f414040caef0b3141df182d8b4ff2`
- Packet generated from controller commit: `5ac6c50e845c4c8d8e5d358e604700e4163b7fea`
- Approved adapter commit: `5ac6c50e845c4c8d8e5d358e604700e4163b7fea`
- Expected report commit: `5ac6c50e845c4c8d8e5d358e604700e4163b7fea`

Paste:

```text
Please use the attached RecallWeave OpenClaw canary handoff packet.

Important: this packet is for one fresh canary window only. Do not roll it out to other agents yet.
For this one selected OpenClaw agent, RecallWeave/selfmem should become the native/default memory slot during the canary window. Do not leave it installed as shadow-only or manual-only.
The `selfmem_canary` label is a compatibility/plugin id, not a request to keep it non-default.
Hosted Supermemory remains read-through/history only. New memory writes during this canary should land locally in RecallWeave/selfmem.
The packet was generated from controller commit 5ac6c50e845c4c8d8e5d358e604700e4163b7fea, and the approved adapter/report commit for this canary is also 5ac6c50e845c4c8d8e5d358e604700e4163b7fea.
The returned canary evidence must report commit 5ac6c50e845c4c8d8e5d358e604700e4163b7fea or it will count as diagnostic only.

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

Controller note: the selected prior diagnostic was privacy-clean and had
lifecycle coverage, hybrid search, local writes, hosted read-through, and recall
p95 `1567.346 ms`. It failed only because the old window lacked the current
adapter contract and positive store latency samples.
