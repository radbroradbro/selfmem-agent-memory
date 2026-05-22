# Maintainer Review Guide

Use this guide when reviewing PRs from deployed agents.

## Required Decision

Choose one:

- `APPROVE`: safe to merge.
- `REQUEST CHANGES`: specific blockers must be fixed.
- `COMMENT`: useful feedback, not approval.

## Review Order

1. Confirm the PR states why the change should land.
2. Confirm the evidence is sanitized.
3. Check whether the change affects recall, writes, privacy, provider spend, or
   runtime install paths.
4. Check test output.
5. Check rollback instructions for live-runtime changes.
6. Check benchmark claims against evidence.

## Blockers

Request changes if any of these appear:

- provider key or token,
- raw memory text,
- raw transcript,
- raw JSONL log,
- private container map,
- hosted write-back without dry-run sync proof,
- benchmark claim without matching report,
- native/default memory behavior changed without rollout plan,
- broad refactor mixed with a small runtime fix.

## Safe Merge Shape

A safe live-runtime PR is small, reversible, and canaryable on one agent. It
should improve a clear failure mode without changing unrelated memory behavior.

## After Merge

After merge, ask the agent to run:

```bash
bin/selfmem_update --host hermes --repo /path/to/hermes --apply --run-canary
```

Use the matching `--host openclaw` command for OpenClaw. Then collect sanitized
runtime counts before telling other agents to update.
