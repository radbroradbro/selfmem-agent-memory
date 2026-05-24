# Current Verified Baseline Refresh Evidence

Date: 2026-05-24

## Scope

This refresh updates the checked-in release state and canary handoff evidence so
the latest verified PR branch head is tracked separately from the approved
runtime canary adapter/report commit. That split lets benchmark and tooling
guards move forward without silently changing what the one-agent runtime canary
must prove. The latest branch-head refresh only hardens returned-packet intake
triage and Linux CI sanitization; it does not promote a new runtime adapter.

## Latest Verified PR Branch Head

- Commit: `8b6f9bd8aa4a5e8764fce63021edc059af903c5c`
- Commit title: `docs: promote returned canary triage head`
- GitHub Actions run: `26355118094`
- CI conclusion: `success`
- PR branch: `feat/nucleus-wiki-native-contract`

## Approved Runtime Canary Baseline

- Commit: `3d61677bc3d316e040ac5a634467d0204c272493`
- Commit title: `test: add single-provider live preflight gates`
- GitHub Actions run: `26353888297`
- CI conclusion: `success`
- PR branch: `feat/nucleus-wiki-native-contract`

## Local Verification

The following checks passed on or against the latest verified PR branch head
before this baseline refresh:

- `npm exec --yes pnpm@10.23.0 -- release:check`
- `GITHUB_ACTIONS=true CI=true npm exec --yes pnpm@10.23.0 -- release:check`
- `npm exec --yes pnpm@10.23.0 -- release:github-sync`
- `npm exec --yes pnpm@10.23.0 -- goal:audit`
- `git diff --check`
- `npm exec --yes pnpm@10.23.0 -- release:doctor`
- GitHub Actions run `26355118094`

## Canary Handoff Artifact

The current sendable OpenClaw one-agent canary handoff packet is:

- Packet: `recallweave-openclaw-next-agent-canary-20260524-3d61677.zip`
- SHA256: `12172f1a526f2a877d5098b234a6eff0b8aa5976730bdd4f67de8e87b647be39`
- Packet generated from controller commit:
  `67c09445a1c5e2205d8c2ea82709b1e0459236f3`
- Approved adapter commit:
  `3d61677bc3d316e040ac5a634467d0204c272493`
- Expected returned report commit:
  `3d61677bc3d316e040ac5a634467d0204c272493`
- Zip integrity: passed.
- Manifest confirms `READY_FOR_ONE_AGENT_FRESH_CANARY`,
  `oneAgentCanaryAllowed: true`, `publicLaunchAllowed: false`, and
  `fleetRolloutAllowed: false`.

The returned packet must be metrics-only, strict-real, non-fixture, privacy
clean, rollback-tested, at least 15 minutes after the update, and tied to the
expected report commit above. Any older or mismatched adapter commit is
diagnostic only.

## Benchmark Boundary

The benchmark lane remains conservative:

- Solo RecallWeave runs are smoke tests only.
- `bm25-lite` is a control/fallback, not the target product system.
- Public benchmark claims require same-data comparison against BM25, hybrid
  arms, provider-backed hybrid arms when explicitly consented, and public
  benchmark or leaderboard targets where possible.
- The current provider-backed fixture gate includes BM25, full local hybrid,
  Voyage, Gemini, NVIDIA, and local Apple Silicon arms. The expanded target also
  has Voyage-only and NVIDIA-only preflight reports, so the next live run can
  test one provider family without requiring every provider's credentials.
  Live provider runs remain opt-in and blocked by preflight until consent flags
  and env-only provider readiness are present.
- Hosted Supermemory comparisons remain product-parity sanity checks, not the
  main public scoreboard.

## Boundary

This does not approve public launch. It keeps the same blockers:

- human approval
- fresh real one-agent production canary before rollout claims
- owner approval before using any hosted-baseline comparison in public release
  language
