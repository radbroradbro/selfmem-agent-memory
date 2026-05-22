# Release Gate: Final Reviewer, Hosted Baseline, And Real Canary

## Summary

Track the final blockers before PR #5 can be treated as public-launch ready.
The code, fixture UI, and release gates are green, but public launch should
remain conservative until owner, hosted-baseline, and real canary
requirements are resolved.

## Current Evidence

- Latest code/product baseline: `8777290169f598ff9172e889e927858b3956f764`.
- GitHub Actions run `26316074705` passed CI after the Brain UI lifecycle
  trail and current-head browser evidence refresh.
- Previous code/product baseline before the lifecycle trail browser evidence
  refresh: `b5c1e025db072fca750dc6730741c23e1b981eca`.
- GitHub Actions run `26313942262` passed CI after the GitHub live sync
  release gate.
- Previous code/product baseline before the live sync release gate:
  `e765e8ff331475c6f91565f4e68577b011e4781a`.
- GitHub Actions run `26313358962` passed CI after the Hermes and OpenClaw
  bounded read-through latency patch.
- Local release readiness, smoke, goal audit, hosted-baseline preflight, canary
  evidence intake, canary report generation, and canary diagnosis all passed in
  their safe fixture or metrics-only modes.
- Adapter smokes now assert bounded read-through policy plus positive total,
  local, and remote recall timings.
- Secret and private-name scans found no actual credential or private memory
  exposure in the changed evidence files.

## Remaining Blockers

- Claude/Opus review completed with `CONCERNS`; it supports alpha PR review
  but does not approve public launch.
- Human approval is required before merge, visibility changes, or public live
  update copy.
- Hosted Supermemory comparison claims require a fresh metrics-only baseline.
  The current hosted-baseline preflight deliberately calls no hosted provider
  and blocks public benchmark claims.
- One real-container production canary remains incomplete. Fixture UI and
  report tooling are not a production rollout.

## Acceptance Criteria

- The owner accepts the Claude `CONCERNS` review as alpha-PR evidence.
- A real one-agent canary report is collected through the sanitized canary
  report/intake path and passes privacy, lifecycle, hybrid search, latency,
  rollback, and write/read checks.
- Any hosted comparison claim is backed by a fresh metrics-only baseline using
  the same dataset, judge, settings, and scoring code.
- The owner approves merge and public release wording.
- Public evidence contains no raw memories, transcripts, diagnostics,
  credentials, agent logs, private paths, or private container names.
