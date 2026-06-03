# Codex Memory Periodic Monitor Automation

- Status: ACTIVE
- Automation id: `recallweave-memory-dogfood-monitor-2`
- Schedule: hourly
- Workspace: selfmem-agent-memory-recover
- Boundary: monitoring only; not public launch approval, benchmark evidence, production default approval, or goal completion.

## What It Watches

- rewired Codex memory dogfood monitor health
- release blocker drift
- goal completion audit guard
- severe memory noise
- quiet prompts retrieving context
- confusing or useless direct lookup
- random benchmark/canary memory injection
- unanchored forced or periodic recall
- explicit write failures
- checked-in or release-artifact secret/private-path leaks

## Explicit Non-Concern

This monitor is not a local-secret scrub. Local memory may contain private operational facts, including credentials the operator intentionally wants agents to recall. The public-safety boundary is checked-in or release-facing artifacts.

## Notify Policy

Notify only when a regression or blocker-state change appears. If the monitor is clean and unchanged, it should stay quiet.
