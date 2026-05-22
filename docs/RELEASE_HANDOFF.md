# Release Handoff

Use this page when the code is green but the repository still needs a human
release decision.

## Current State Labels

Use these labels in PRs, issues, and release notes:

- `code-checks-pass`: local checks and GitHub Actions pass.
- `fixture-ui-proven`: Brain UI evidence uses public fixture data only.
- `not-production-ready`: public launch remains blocked.
- `reviewer-route-blocked`: one requested reviewer could not run.
- `human-approval-required`: the owner must approve visibility, merge, and live
  rollout.

Do not shorten this to "ready" unless the public release checklist is complete.

## Manual GitHub Steps

The GitHub app may be able to read PRs while still lacking permission to update
PR bodies, add top-level comments, or create issues. If that happens, use the
repo files below as the source of truth.

1. Open PR #5.
2. Replace the PR body with
   `reviews/overnight-20260522/pr-body-update-draft.md`.
3. Create a blocker issue from
   `reviews/overnight-20260522/issue-drafts/blocker-fresh-brain-ui-launch-and-release-gate.md`,
   or record that the owner accepts the missing issue.
4. Link the blocker issue in PR #5.
5. Keep the public launch verdict as `FAIL` until the owner approves a different
   verdict.

Do not paste private diagnostics, raw memories, session transcripts, local agent
paths, provider keys, or private container names into GitHub.

## Blocker Doctor

Run this before merge or visibility changes:

```bash
npm exec --yes pnpm@10.23.0 -- release:doctor
```

The doctor is intentionally conservative. It should report
`publicLaunchAllowed: false` until Claude review, GitHub handoff, human
approval, and hosted-baseline blockers are resolved or explicitly accepted.
Use its `manualCommands` list as the next-action checklist for agents.

## Reviewer Route Choices

Before merge, choose one path:

- Log in Claude CLI and rerun the cold Claude review.
- Accept the blocked Claude route in writing and rely on the recorded Gemini
  reviews, local checks, GitHub Actions, and release gate.
- Keep the PR open until the blocked reviewer route is healthy.

If a route is blocked, say so directly. A blocked route is not an approval.

## Alpha Merge Criteria

PR #5 may be merged as an alpha candidate only when all of these are true:

- GitHub Actions passed on the current head commit.
- `npm exec --yes pnpm@10.23.0 -- smoke` passed locally or in CI.
- `npm exec --yes pnpm@10.23.0 -- release:check` passed.
- Secret, forbidden-file, and private-name scans have zero hits.
- The PR body reflects the current evidence packet.
- The owner approved merge with the current blocker list visible.

Alpha merge does not mean production rollout. Agents still need canary rollout
with `selfmem_update`, sanitized runtime counts, and rollback notes.

## Public Visibility Criteria

Do not make the repository public until all alpha merge criteria are true and
the owner explicitly approves public visibility.

Before flipping visibility, confirm:

- `docs/PUBLIC_RELEASE_CHECKLIST.md` is complete.
- `reviews/overnight-20260522/release-state.json` still says
  `publicLaunchVerdict: "FAIL"` unless the owner has approved a new verdict.
- No public docs claim RecallWeave beats hosted Supermemory.
- Benchmark claims are metrics-only and point to reports without memory text.
- The demo uses dummy data only.

## Live Agent Rollout

For each deployed agent:

1. Update from the merged commit.
2. Run `selfmem_update` in dry-run mode.
3. Apply to one agent with `--apply --run-canary`.
4. Collect event counts, redaction count, provider mode, p50 and p95 recall
   latency, and errors.
5. Open a PR or issue if any runtime behavior diverges.

Do not roll the same change to every agent until one-agent canary evidence is
clean.
