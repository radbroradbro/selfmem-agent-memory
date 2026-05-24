# Current Verified Baseline Refresh Evidence

Date: 2026-05-24

## Scope

This refresh updates the checked-in release state and canary handoff evidence so
the latest verified code/product baseline matches the current PR head after the
provider-backed benchmark gate added NVIDIA and local Apple Silicon arms.

## Verified Head

- Commit: `6c3cb1e97978999bc3606eed67f19ba7f208d9e7`
- Commit title: `test: expose nvidia and apple provider benchmark arms`
- GitHub Actions run: `26353508492`
- CI conclusion: `success`
- PR branch: `feat/nucleus-wiki-native-contract`

## Local Verification

The following checks passed on or against the same head before this baseline
refresh:

- `npm exec --yes pnpm@10.23.0 -- release:check`
- `GITHUB_ACTIONS=true CI=true npm exec --yes pnpm@10.23.0 -- release:check`
- `npm exec --yes pnpm@10.23.0 -- release:github-sync`
- `npm exec --yes pnpm@10.23.0 -- goal:audit`
- `git diff --check`
- `npm exec --yes pnpm@10.23.0 -- release:doctor`
- GitHub Actions run `26353508492`

## Canary Handoff Artifact

The current sendable OpenClaw one-agent canary handoff packet is:

- Packet: `recallweave-openclaw-next-agent-canary-20260524-6c3cb1e.zip`
- SHA256: `d11607f6175f2c2c35757c90918f0bddd578c478c0660c80b25e9cf85278b2ef`
- Expected returned report commit:
  `6c3cb1e97978999bc3606eed67f19ba7f208d9e7`
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
  Voyage, Gemini, NVIDIA, and local Apple Silicon arms, but live provider runs
  remain opt-in and blocked by preflight until consent flags and env-only
  provider readiness are present.
- Hosted Supermemory comparisons remain product-parity sanity checks, not the
  main public scoreboard.

## Boundary

This does not approve public launch. It keeps the same blockers:

- human approval
- fresh real one-agent production canary before rollout claims
- owner approval before using any hosted-baseline comparison in public release
  language
