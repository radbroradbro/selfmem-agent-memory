# Release Blocker Doctor Evidence

Date: 2026-05-22

Scope:

- Machine-readable release blocker status for PR #5.
- Conservative launch boundary after GitHub write-route recovery.
- Hosted baseline preflight status folded into the blocker report.
- Real one-agent canary status folded into the blocker report.
- GitHub live sync status folded into the blocker report.

Result:

- Mode: `release-blocker-doctor`
- Writes real files: false
- Public launch allowed: false
- Production ready: false
- Required evidence files present: true
- Remote has no token: true
- Hosted baseline preflight: ok true, calls hosted provider false, benchmark
  claims allowed false
- Hosted baseline live discovery: ok true, calls hosted provider true,
  documents seen 100, hashed container candidates 4, raw labels included false,
  raw memory included false
- Canary diagnostic batch audit: ok true, metrics only true, fixture evidence
  cannot count as real rollout evidence, public launch allowed false, fleet
  rollout allowed false
- Canary next-agent plan: ok true, metrics only true, fixture plan status
  `FIXTURE_PLAN_ONLY`, one-agent canary allowed false, public launch allowed
  false, fleet rollout allowed false
- Reviewed budgeted baseline: comparison evidence true, public benchmark
  claims allowed true for owner review, reviewerApprovalCount 2, returned packet
  status `READY_FOR_PUBLIC_BENCHMARK_REVIEW`, next-run status
  `READY_FOR_OWNER_REVIEW`, public launch allowed false
- GitHub live sync: ok true, PR body matches true, issue title matches true,
  issue body matches true

Current blockers:

- `human-public-launch-approval-required`
- `fresh-real-container-canary-not-current`

Resolved in this extension:

- PR #5 body was updated live.
- GitHub issue #6 was created live.
- `release:github-sync` now verifies the live PR and issue against checked-in
  drafts with hashes and booleans only.
- Live hosted discovery succeeded against the hosted Supermemory key and
  produced only hashed candidate metadata. It narrows the next operator step but
  does not close the hosted-baseline blocker.
- The source-matched budgeted hosted canary now has two independent reviewer
  approvals, a rebuilt reviewed comparison, a strict-real packet review, and a
  returned-packet intake result ready for owner review.
- Claude Opus review completed with `CONCERNS` and is recorded in
  `claude-pr5-review.md`.
- The old GitHub 403 packet remains historical evidence only.

Manual next actions:

- Treat the Claude `CONCERNS` review as alpha-PR evidence only.
- Run `release:github-sync` and verify PR #5 and issue #6 still match the
  checked-in drafts.
- Treat the reviewed canary comparison as owner-review evidence only. It is not
  public launch approval and not a broad benchmark claim.
- Run `canary:batch-audit` against redacted returned diagnostics, then
  `canary:next-agent` to select one privacy-clean Hermes/OpenClaw target for a
  fresh strict-real window.
- Do not treat fixture canary output or old diagnostic history as production
  rollout evidence.

Notes:

- This doctor does not weaken the release gate. It exists so agents stop
  interpreting green checks as public-launch approval.
- It sends no private memories, transcripts, diagnostics, credentials, private
  paths, agent logs, or provider keys.
