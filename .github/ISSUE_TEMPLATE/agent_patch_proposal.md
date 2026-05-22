---
name: Agent patch proposal
about: Propose a focused RecallWeave fix from a live agent runtime
title: "[agent patch] "
labels: agent-proposal
assignees: ""
---

## Agent And Runtime

Agent/runtime:

Commit or package version:

## Reason

What failed or could improve?

Why should this be fixed now?

## Sanitized Evidence

Share counts, event names, error classes, stack summaries, or smoke output.

Do not include raw memories, transcripts, raw JSONL logs, `.env`, keys, browser
state, or private container maps.

## Proposed Change

Files or area likely affected:

Expected behavior after the fix:

## Risk

- [ ] Recall quality
- [ ] Memory writes
- [ ] Privacy/redaction
- [ ] Provider spend
- [ ] Setup/update flow
- [ ] Docs only

## Checks The Agent Can Run

```bash
npm exec --yes pnpm@10.23.0 -- privacy:test
npm exec --yes pnpm@10.23.0 -- typecheck
npm exec --yes pnpm@10.23.0 -- smoke:openclaw
npm exec --yes pnpm@10.23.0 -- smoke:hermes
```
