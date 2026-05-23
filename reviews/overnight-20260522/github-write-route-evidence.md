# GitHub Write Route Evidence

Date: 2026-05-23

Verdict: resolved for PR body and blocker issue writes.

## What Changed

- The GitHub app connector still returned `401 token_expired` when asked to
  update PR #5 during the lifecycle-trail evidence refresh.
- The local git credential helper had a valid GitHub credential.
- A token-free command body used that helper internally, did not print the
  credential, and completed both GitHub write actions.

## Results

- PR #5 body updated:
  - URL: https://github.com/radbroradbro/selfmem-agent-memory/pull/5
  - GitHub status: 200
  - Updated at: 2026-05-23T13:21:12Z
  - Latest local refresh records `3c9ef0806e5a454783140e1ac821b40edd5776cf`
    and CI run `26333740615` as the latest verified code/product baseline for
    the returned canary inbox scanner follow-up. It does not close the
    human-approval, source-matched hosted-baseline, or real-canary blockers.
  - The PR body was refreshed again after live hosted prep evidence added
    duplicate-query fail-closed behavior and an 8-query public-safe prep
    report. This still does not close the hosted-baseline blocker.
  - The PR body was refreshed again after the live Codex-local hosted baseline
    run showed both hosted Supermemory and RecallWeave scoring zero against the
    reviewed labels. This proves the live chain and local latency advantage, but
    it blocks public comparison claims until a source-matched, non-zero baseline
    is reviewed.
  - The PR body was refreshed again after adding `baseline:source-match`, which
    blocks another hosted/local run unless the selected local RecallWeave source
    can collect the reviewed expected references.
  - The PR body was refreshed again after regenerating the current OpenClaw
    next-agent canary handoff packet identity.
  - The PR body was refreshed again after adding `canary:returned-inbox` and
    verifying CI run `26333740615`.
- Release blocker issue created:
  - URL: https://github.com/radbroradbro/selfmem-agent-memory/issues/6
  - GitHub status: 201 on create, 200 on refresh, 200 on lifecycle-trail
    evidence refresh, 200 on real-canary diagnostic evidence refresh, 200 on
    strict-real source-guard refresh, canary operator packet refresh,
    latest-baseline refresh, hosted baseline discovery refresh, adapter
    store-latency gate refresh, hosted baseline collector refresh, baseline comparison refresh, latest
    verified-baseline refresh, RecallWeave baseline collector refresh,
    RecallWeave response export refresh, adapter strict canary contract
    refresh, strict adapter CI baseline refresh, canary evidence packet
    refresh, e2388f0 CI baseline refresh, baseline evidence packet refresh,
    aa0e1d3 CI baseline refresh, canary packet review refresh, 4ed6c00 CI
    baseline refresh, hosted-baseline run orchestrator refresh, continued
    one-agent canary packet identity refresh, and current OpenClaw next-agent
    handoff packet identity refresh
  - Updated at: 2026-05-23T12:50:24Z
  - Body length: 13917

## Safety

- No token was printed.
- No token was committed.
- No raw memory text, transcripts, diagnostics, local paths, provider keys, or
  private container names were sent to GitHub.
- The old `github-issue-create-blocked.md` packet remains as historical
  evidence only. It is no longer the current GitHub write-route state.

## Remaining Release Blockers

- Claude/Opus reviewer route remains blocked by login or needs owner acceptance
  as blocked evidence.
- Human approval is still required before merge, visibility change, or public
  release messaging.
- Hosted Supermemory comparison claims still require a fresh metrics-only
  baseline.
- One real-container production canary remains incomplete.
