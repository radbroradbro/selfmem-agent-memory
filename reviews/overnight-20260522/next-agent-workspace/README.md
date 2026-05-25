# Next-Agent Canary Workspace

Status: waiting for one fresh strict-real OpenClaw canary.

Use this folder when a selected agent returns new evidence. The folder is for
native CLI markdown findings and public-safe review notes only. It should make
the remaining production-canary gate easy to audit without exposing memory
contents.

## Current Handoff

- Packet: `recallweave-openclaw-next-agent-canary-20260525-SEND-THIS-ONE-18d606a.zip`.
- SHA-256: `cb03a1bf25772e2ee397b64f76fa7c485989dd1b3652a37ad8622f6d6ed0289a`.
- Packet generated from controller commit: `f21a7e751ddcd0b9e64a96d682a3fa0940c17c11`.
- Approved adapter commit: `18d606aff589986b4d8b416a686bedb7ff1506d2`.
- Expected report commit: `18d606aff589986b4d8b416a686bedb7ff1506d2`.
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
