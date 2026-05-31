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
The current branch-head refresh adds the same-data Voyage latency comparison
gate and keeps it as retrieval-proxy evidence, not a MemoryBench/SOTA claim.
The latest observed PR-head refresh also adds public benchmark caveat updates
and a local Apple preflight packet. It keeps the local Apple lane explicit:
scaffolded and fixture-covered, but not live-tested until a local embedding
endpoint is configured. The current verified product evidence now includes live
local Apple provider runs for Qwen3 Embedding 0.6B and Qwen3 Embedding 4B on
the same public LongMemEval-S retrieval-proxy target.
The latest verified branch-head refresh adds provider key-scoped pacing for
rotated benchmark credentials, keeps provider challenger lanes as
BM25/full-hybrid context arms, records accepted full-shard arm coverage, and
preserves the launch/SOTA blockers.

## Latest Observed PR Branch Head

- Commit: `03dcf629dd17fe18a64e10b1cd76a68636d8aa0d`
- Commit title: `Harden provider key pacing and accepted arms`
- GitHub Actions run: `26713721189`
- CI conclusion: `success`
- PR branch: `feat/nucleus-wiki-native-contract`

This does not change the approved runtime canary adapter/report commit. It
updates the current PR-head evidence, records provider key-scoped pacing and
accepted full-shard arm coverage, and keeps the result as harness/readiness
evidence only until live same-data provider runs are scored.

## Latest Verified PR Branch Head

- Commit: `03dcf629dd17fe18a64e10b1cd76a68636d8aa0d`
- Commit title: `Harden provider key pacing and accepted arms`
- GitHub Actions run: `26713721189`
- CI conclusion: `success`
- PR branch: `feat/nucleus-wiki-native-contract`

## Approved Runtime Canary Baseline

- Commit: `18d606aff589986b4d8b416a686bedb7ff1506d2`
- Commit title: `fix: require native memory evidence`
- GitHub Actions run: `26353888297`
- CI conclusion: `success`
- PR branch: `feat/nucleus-wiki-native-contract`

## Local Verification

The following checks passed on or against the latest verified PR branch head
before this baseline refresh:

- `npm exec --yes pnpm@10.23.0 -- release:check`
- `npm exec --yes pnpm@10.23.0 -- goal:audit`
- `npm exec --yes pnpm@10.23.0 -- benchmark:sota-doctor`
- `npm exec --yes pnpm@10.23.0 -- benchmark:public-provider` on the 30-query
  LongMemEval-S target with BM25, full-hybrid, and Voyage provider arms
- `npm exec --yes pnpm@10.23.0 -- benchmark:public-provider` on the same
  30-query LongMemEval-S target with BM25, full-hybrid, and Qwen3 Embedding
  0.6B local Apple arms
- `npm exec --yes pnpm@10.23.0 -- benchmark:public-provider` on the same
  30-query LongMemEval-S target with BM25, full-hybrid, and Qwen3 Embedding 4B
  local Apple arms
- Targeted public docs/evidence secret and private-path scan
- Stale local model server check
- GitHub Actions run `26713721189`

## Canary Handoff Artifact

The current sendable OpenClaw one-agent canary handoff packet is:

- Packet: `recallweave-openclaw-next-agent-canary-20260524-SEND-THIS-ONE-18d606a.zip`
- SHA256: `f5aa0f89f250b695152218b542c9bf498de7e2b3b291ce6081451dfb23565cda`
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
- The full 500-query SOTA shard plan now includes
  `cloud-gemini2-embed-rerank-proxy` in the accepted strategy set and exposes a
  standalone Gemini minimum challenger lane. This is runnable only when a
  private Gemini key file or equivalent env-only Gemini credential is present.
- The benchmark runner now enforces the comparison contract directly: provider
  gates require `bm25-lite`, `full-hybrid-rerank`, and at least one
  provider-backed arm, while hybrid gates require `bm25-lite` and at least one
  hybrid-family candidate.
- Hosted Supermemory comparisons remain product-parity sanity checks, not the
  main public scoreboard.
- The local Apple lane currently has a useful negative result: both the Qwen3
  0.6B and 4B embedding arms tied BM25 quality on this 30-query slice, but the
  4B arm added latency and did not earn promotion. The next local benchmark
  should test method changes around query expansion, reranking, topic routing,
  or chunk/context construction before scaling model size again.

## Boundary

This does not approve public launch. It keeps the same blockers:

- human approval
- fresh real one-agent production canary before rollout claims
- owner approval before using any hosted-baseline comparison in public release
  language
