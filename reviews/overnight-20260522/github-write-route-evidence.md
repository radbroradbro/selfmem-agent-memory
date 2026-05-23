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
  - The PR body was refreshed again after the controller reran the current
    five-packet returned-diagnostics batch and regenerated the OpenClaw
    next-agent handoff packet. Updated at: 2026-05-23T13:28:07Z.
  - The PR body was refreshed again after the source-matched budgeted hosted
    canary collected two independent reviewer approvals, rebuilt the reviewed
    comparison packet, and reached owner-review state. Updated at:
    2026-05-23T19:18:20Z.
  - The PR body was refreshed again after the postwatch real-diagnostics pass
    selected the current OpenClaw one-agent handoff packet. Updated at:
    2026-05-23T19:53:03Z.
  - The PR body was refreshed again after adding the returned canary workspace
    helper, which converts one returned agent packet into public-safe markdown
    and JSON findings for review. Updated at: 2026-05-23T20:10:40Z.
  - The PR body was refreshed again after `daac851` passed CI as the latest
    verified code/product baseline and PR #5 was fast-forwarded to that head.
    Updated at: 2026-05-23T20:24:06Z.
  - The PR body was refreshed again after adding `canary:returned-downloads`,
    which scans the standard Downloads and Telegram Desktop inboxes and writes
    metrics-only markdown findings for the next-agent workspace. Updated at:
    2026-05-23T20:37:57Z.
  - The PR body was refreshed again after GitHub Actions run `26343015277`
    passed on `13cac9a` and the release-state baseline was promoted. Updated
    at: 2026-05-23T20:42:54Z.
  - The PR body was refreshed again after GitHub Actions run `26343998064`
    passed on `4310e0e` and the release-state baseline was promoted. Updated
    at: 2026-05-23T21:31:52Z.
  - The PR body was refreshed again after regenerating the current OpenClaw
    next-agent handoff packet with the deterministic drill step in the main
    plan. Updated at: 2026-05-23T21:44:12Z.
  - The PR body was refreshed again after GitHub Actions run `26344382488`
    passed on `67993f1` and the release-state baseline was promoted. Updated
    at: 2026-05-23T21:52:36Z.
  - The PR body was refreshed again after adding the public benchmark target
    lane for quota-locked Supermemory accounts. Updated at:
    2026-05-23T21:59:51Z.
  - The PR body was refreshed again after clarifying that public memory claims
    must use the same benchmark data, revision, split, labels, judge model,
    answer model, judge rule, and scoring setup as the target row, while
    embedding and reranker leaderboards are component evidence only. Updated
    at: 2026-05-23T22:06:40Z.
  - The PR body was refreshed again after adding `benchmark:public-target`,
    the metrics-only source-locked public benchmark target validator. Updated
    at: 2026-05-23T22:16:58Z.
  - The PR body was refreshed again after `benchmark:public-target` began
    enforcing same judge model and same answer model. Updated at:
    2026-05-23T22:31:55Z.
  - The PR body was refreshed again after GitHub Actions run `26345383489`
    passed on `90b6bc9` and the release-state baseline was promoted. Updated
    at: 2026-05-23T22:40:18Z.
  - The PR body was refreshed again after regenerating the current OpenClaw
    next-agent handoff packet in the standard Downloads location. Updated at:
    2026-05-23T22:47:01Z.
  - The PR body was refreshed again after adding the current MemoryBench source
    lock, optional checkout hash verification, and machine-readable source-lock
    evidence. Updated at: 2026-05-23T23:23:44Z.
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
    one-agent canary packet identity refresh, current OpenClaw next-agent
    handoff packet identity refresh, five-packet returned-diagnostics packet
    identity refresh, postwatch OpenClaw one-agent packet refresh, returned
    canary workspace refresh, latest verified baseline refresh, returned
    downloads findings baseline refresh, current deterministic-drill packet
    refresh, latest canary-drill handoff baseline refresh, public benchmark
    target lane refresh, component-vs-memory benchmark clarification refresh,
    public benchmark target validator refresh, same judge and answer model
    validator refresh, latest public benchmark target CI baseline refresh,
    current OpenClaw Downloads handoff packet refresh, public benchmark target
    author/source-lock attestation refresh, and MemoryBench source-lock
    checkout verification refresh
  - Updated at: 2026-05-23T23:23:43Z
  - Body length: 24153

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
- The hosted Supermemory canary comparison is now ready for owner review, but
  does not authorize launch or broad superiority language.
- One real-container production canary remains incomplete.
