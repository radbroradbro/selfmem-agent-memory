# Next-Agent Canary Workspace

Status: waiting for one fresh strict-real OpenClaw canary.

Use this folder when a selected agent returns new evidence. The folder is for
native CLI markdown findings and public-safe review notes only. It should make
the remaining production-canary gate easy to audit without exposing memory
contents.

## Current Handoff

- Packet: `recallweave-openclaw-next-agent-canary-20260601-SEND-THIS-ONE-5ac6c50.zip`.
- SHA-256: `a434cbebec609f3427ba9c42ec467b650d5f414040caef0b3141df182d8b4ff2`.
- Packet generated from controller commit: `5ac6c50e845c4c8d8e5d358e604700e4163b7fea`.
- Approved adapter commit: `5ac6c50e845c4c8d8e5d358e604700e4163b7fea`.
- Expected report commit: `5ac6c50e845c4c8d8e5d358e604700e4163b7fea`.
- Host: OpenClaw.
- Scope: one selected agent only.
- Public launch allowed: no.
- Fleet rollout allowed: no.

## What Goes Here

- `send-to-selected-agent.md`: paste-ready instructions for exactly one
  selected OpenClaw operator.
- `operator-findings-returned.md`: filled from `operator-findings-template.md`
  after the selected agent runs the fresh window.
- `returned-packet-intake.md`: filled from
  `returned-packet-intake-template.md` after the maintainer runs returned packet
  intake.
- Optional native CLI markdown outputs that contain metrics, hashes, and
  pass/fail flags only.

## Do Not Store

- raw memories
- raw transcripts
- raw prompts or answers
- provider keys
- cookies
- private local paths
- unredacted diagnostics
- private container names

## Controller Verification

After a packet comes back, run the returned-packet intake command from the
handoff packet. The packet must pass with production-canary evidence before this
workspace can support closing the real rollout blocker.

The safer path is to let the workspace generator fill the markdown:

```bash
npm exec --yes pnpm@10.23.0 -- canary:returned-workspace -- --packet <returned-canary-evidence-packet.zip> --workspace reviews/overnight-20260522/next-agent-workspace --output /tmp/recallweave-returned-workspace.json
```

Use `--require-production-canary` when this should fail unless the returned
packet proves production canary evidence.

The goal stays active until the returned packet passes and the owner approves
promotion.
