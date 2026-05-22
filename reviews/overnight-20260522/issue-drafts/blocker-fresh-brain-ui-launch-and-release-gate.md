# Release Gate: Final Reviewer, Hosted Baseline, And Real Canary

## Summary

Track the final blockers before PR #5 can be treated as public-launch ready.
The code, fixture UI, and release gates are green, but public launch should
remain conservative until reviewer, owner, hosted-baseline, and real canary
requirements are resolved.

## Current Evidence

- Latest code/product baseline: `4f5a0790f1c403c8c8405910935f7a3eea1072a1`.
- GitHub Actions run `26312283137` passed Test, Full smoke, and Release
  readiness check.
- Previous docs/evidence head before the GitHub write-route extension:
  `3ad7b5ddcc4c3213ba22ca666e71d01433c05d30`.
- GitHub Actions run `26312385019` passed Verify.
- Local release readiness, smoke, goal audit, hosted-baseline preflight, canary
  evidence intake, canary report generation, and canary diagnosis all passed in
  their safe fixture or metrics-only modes.
- Secret and private-name scans found no actual credential or private memory
  exposure in the changed evidence files.

## Remaining Blockers

- Claude/Opus council review route is blocked by login or must be explicitly
  accepted as blocked evidence.
- Human approval is required before merge, visibility changes, or public live
  update copy.
- Hosted Supermemory comparison claims require a fresh metrics-only baseline.
  The current hosted-baseline preflight deliberately calls no hosted provider
  and blocks public benchmark claims.
- One real-container production canary remains incomplete. Fixture UI and
  report tooling are not a production rollout.

## Acceptance Criteria

- Final reviewer route is completed or the owner accepts the blocked reviewer
  packet.
- A real one-agent canary report is collected through the sanitized canary
  report/intake path and passes privacy, lifecycle, hybrid search, latency,
  rollback, and write/read checks.
- Any hosted comparison claim is backed by a fresh metrics-only baseline using
  the same dataset, judge, settings, and scoring code.
- The owner approves merge and public release wording.
- Public evidence contains no raw memories, transcripts, diagnostics,
  credentials, agent logs, private paths, or private container names.
