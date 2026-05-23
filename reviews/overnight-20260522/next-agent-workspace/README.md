# Next-Agent Canary Workspace

Status: waiting for one fresh strict-real OpenClaw canary.

Use this folder when a selected agent returns new evidence. The folder is for
native CLI markdown findings and public-safe review notes only. It should make
the remaining production-canary gate easy to audit without exposing memory
contents.

## Current Handoff

- Packet: `recallweave-openclaw-next-agent-canary-20260523-postwatch.zip`.
- SHA-256: `2f2cec8a515eed467861204b3bf2bca249bee13ef6470c79ffc44b37321c7208`.
- Host: OpenClaw.
- Scope: one selected agent only.
- Public launch allowed: no.
- Fleet rollout allowed: no.

## What Goes Here

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

The goal stays active until the returned packet passes and the owner approves
promotion.
