# Claude PR #5 Review

Date: 2026-05-22

Reviewer route: Claude CLI with `claude --print --model opus`.

Route note: the old `--bare` route still fails because bare mode ignores
OAuth/keychain auth, but the authenticated noninteractive Claude CLI route works
when run with `--setting-sources local`, which avoids the user-level Stop hook.

Command class used:

```bash
claude --print --model opus --permission-mode plan \
  --max-budget-usd 3 \
  --no-session-persistence \
  --disable-slash-commands \
  --setting-sources local \
  --output-format json \
  --allowedTools "Read,Grep,Glob,Bash(git status *),Bash(git diff *),Bash(git show *),Bash(node packages/bench/release-readiness-check.mjs),Bash(node packages/bench/goal-completion-audit.mjs),Bash(node packages/bench/release-blocker-doctor.mjs),Bash(node packages/bench/github-live-sync-check.mjs),Bash(npm exec --yes pnpm@10.23.0 -- test)"
```

Run metadata:

- Result: success.
- Cost: 2.0719125 USD.
- Session id: `d23552bc-31c8-482b-89ac-2e2f902e6612`.
- Repository files changed by reviewer: none.
- Verdict: `CONCERNS`.

Controller reconciliation note: Claude's review text below records the
goal-audit count from the moment the review ran. After this review completed,
the controller reclassified `claude-council-review` from blocked to proven with
concerns. The current checked gate is therefore 20 proven, 2 blocked, and 1
incomplete, while the goal still cannot be marked complete.

## Review Text

Verdict: CONCERNS

This is a review-only deliverable. No code changes are proposed. The PR is safe
to proceed as a private / public-alpha candidate, but public launch and native
goal completion both remain correctly blocked.

## Findings

- Public launch is correctly blocked, verified independently rather than only
  claimed. `reviews/overnight-20260522/release-state.json` holds
  `publicLaunchVerdict: "FAIL"`, `productionReady: false`, `goalStatus:
  "active"`, and live blockers. `release-readiness-check.mjs` hard-asserts the
  conservative verdict, so a green gate cannot silently flip the launch state.
- The native goal cannot be marked complete. Claude ran
  `node packages/bench/goal-completion-audit.mjs`: `goalComplete: false`,
  `mayCallUpdateGoalComplete: false`, 19 proven, 3 blocked, 1 incomplete,
  `writesRealFiles: false`.
- Claude found no exposure of raw memories, transcripts, diagnostics,
  credentials, provider keys, local paths, or private container names. Its
  independent regex scan for key shapes returned zero hits. Its absolute-path
  scan found only synthetic dirty-input fixtures whose tests assert redaction.
- Benchmark claims stay blocked. `hosted-baseline-preflight.mjs` requires a
  fresh hosted baseline, matched RecallWeave run, at least two reviewer
  approvals, and a RecallWeave win before any comparison claim.
- The one-agent real canary remains incomplete. The goal audit marks
  `real-container-production-rollout` as incomplete; fixture reports do not
  count as real rollout evidence.
- Hosted read-through is bounded and read-only. The OpenClaw adapter uses a
  1200 ms Supermemory timeout and a 2200 ms recall budget, defaults read-only
  when identity is unresolved, and writes under the runtime home rather than the
  repo. Write-back remains off by default across code, release state, docs, and
  PR checklist.
- PR/issue evidence is coherent for an alpha PR. PR #5 is open/mergeable, issue
  #6 exists, and the evidence trail under `reviews/overnight-20260522/` is
  internally consistent with the gate scripts.

## Evidence Checked

- Read: `release-state.json`, `production-readiness.md`,
  `completion-audit.md`, `pr-body-update-draft.md`.
- Read gate sources: `goal-completion-audit.mjs`,
  `release-readiness-check.mjs`, `hosted-baseline-preflight.mjs`,
  `packages/adapters/openclaw/selfmem_canary/index.mjs`.
- Ran: `node packages/bench/goal-completion-audit.mjs`.
- Independent scans: key-shaped secret regex, absolute-path leak grep,
  forbidden runtime-file inventory, write-back and read-through greps.

## Limitations

- Claude could not run every requested command from inside its plan-mode review
  sandbox. Local controller and GitHub Actions evidence remain the
  load-bearing proof for `release:check`, `release:doctor`,
  `github-live-sync`, and full smoke.
- Claude did not fetch live GitHub state. The controller-run
  `github-live-sync-check.mjs` separately verifies live PR #5 and issue #6
  against checked-in drafts.
- Claude treated narrative Gemini reviews as corroborating evidence, not as
  load-bearing proof.

## Required Before Public Launch

- Human owner approval for merge, repository visibility change, and public
  messaging.
- A fresh metrics-only hosted Supermemory baseline accepted by
  `baseline:preflight --result`, a matched RecallWeave run, a RecallWeave win,
  and two reviewer approvals before any comparison claim.
- One real one-agent container canary ingested through `canary:report` and
  `canary:intake`, not fixtures.
- Re-run `release:check`, `brain:smoke`, and `github-live-sync` in an
  environment with localhost and GitHub network before launch.

## Goal Completion Decision

Can mark native goal complete: no.

Reason: `goal-completion-audit.mjs` returns `goalComplete: false` and
`mayCallUpdateGoalComplete: false`. Core preview work is strongly evidenced and
safe for an alpha PR, but the supervised native goal stays active until human
approval, hosted baseline, and real one-agent rollout evidence are complete.
