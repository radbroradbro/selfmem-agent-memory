# Current Verified Baseline Refresh Evidence

Date: 2026-05-24

## Scope

This refresh updates the checked-in release state and canary handoff evidence so
the latest verified code/product baseline matches the current PR head after the
benchmark comparator guard and commit-bound canary evidence gate.

## Verified Head

- Commit: `8aa98265e84db5a1e2dda2b66d16065c7be30902`
- Commit title: `docs: refresh current OpenClaw canary handoff`
- GitHub Actions run: `26351957568`
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
- GitHub Actions run `26351957568`

## Canary Handoff Artifact

The current sendable OpenClaw one-agent canary handoff packet is:

- Packet: `recallweave-openclaw-next-agent-canary-20260524-8aa9826.zip`
- SHA256: `b9b3fbe1c3c29ff6c6754291603a745a087cf40abe496a259abafc191dedabc5`
- Expected returned report commit:
  `8aa98265e84db5a1e2dda2b66d16065c7be30902`
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
- Hosted Supermemory comparisons remain product-parity sanity checks, not the
  main public scoreboard.

## Boundary

This does not approve public launch. It keeps the same blockers:

- human approval
- fresh real one-agent production canary before rollout claims
- owner approval before using any hosted-baseline comparison in public release
  language
