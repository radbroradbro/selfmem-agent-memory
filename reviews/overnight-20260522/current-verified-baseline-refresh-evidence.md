# Current Verified Baseline Refresh Evidence

Date: 2026-05-24

## Scope

This refresh updates the checked-in release state and canary handoff evidence so
the latest verified PR branch head is tracked separately from the approved
runtime canary adapter/report commit. That split lets benchmark and tooling
guards move forward without silently changing what the one-agent runtime canary
must prove. The latest branch-head refresh requires explicit native/default
memory proof in canary reports and packet review; it does not change the
approved runtime adapter commit that returned agents must report.

## Latest Verified PR Branch Head

- Commit: `6ac6dd830db5ed1ad67840fc457a13b27729c07b`
- Commit title: `docs: refresh native memory canary packet`
- GitHub Actions run: `26365847461`
- CI conclusion: `success`
- PR branch: `feat/nucleus-wiki-native-contract`

## Approved Runtime Canary Baseline

- Commit: `18d606aff589986b4d8b416a686bedb7ff1506d2`
- Commit title: `fix: require native memory evidence`
- GitHub Actions run: `26365847461`
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
- GitHub Actions run `26365847461`

## Canary Handoff Artifact

The current sendable OpenClaw one-agent canary handoff packet is:

- Packet: `recallweave-openclaw-next-agent-canary-20260524-18d606a.zip`
- SHA256: `6e2dd7fb2c4530e5e688a5110f9d77913d52eda79b17da92fe0df4b0da66b6b3`
- Packet generated from controller commit:
  `18d606aff589986b4d8b416a686bedb7ff1506d2`
- Approved adapter commit:
  `18d606aff589986b4d8b416a686bedb7ff1506d2`
- Expected returned report commit:
  `18d606aff589986b4d8b416a686bedb7ff1506d2`
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
- The benchmark runner now enforces the comparison contract directly: provider
  gates require `bm25-lite`, `full-hybrid-rerank`, and at least one
  provider-backed arm, while hybrid gates require `bm25-lite` and at least one
  hybrid-family candidate.
- Hosted Supermemory comparisons remain product-parity sanity checks, not the
  main public scoreboard.

## Boundary

This does not approve public launch. It keeps the same blockers:

- human approval
- fresh real one-agent production canary before rollout claims
- owner approval before using any hosted-baseline comparison in public release
  language
