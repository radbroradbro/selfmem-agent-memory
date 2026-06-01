# Current Verified Baseline Refresh Evidence

Date: 2026-06-01

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
The latest verified branch-head refresh adds shard-scoped answer-quality
materialization, shard-local response/preflight/scoring paths, and parent
coordinate preservation for public evidence. This reduces full-corpus runtime
pressure without changing launch/SOTA blockers.
The current verified branch-head refresh adds the current OpenClaw next-agent
canary handoff packet for the latest pushed branch head and moves superseded
handoff zips out of the active Downloads root. This keeps the active handoff
public-safe and current, but it does not change the approved runtime canary
adapter/report commit and does not close launch, production, or SOTA blockers.
The latest refresh promotes `5ac6c50` as the approved runtime canary baseline
because it fixes the source-locked provider shard repair path and regenerates
the current OpenClaw handoff packet around that runtime commit. The current
repository head is `5613051`, which promotes that provider-shard-fixed canary
baseline into release-state and corrects the release gate without changing the
approved runtime adapter/report commit.

## Latest Observed PR Branch Head

- Commit: `5613051455f056f8161da8f9d4aac7c7aefe77cc`
- Commit title: `release: promote provider shard canary baseline`
- GitHub Actions run: `26779783551`
- CI conclusion: `success`
- PR branch: `feat/nucleus-wiki-native-contract`

This does not change the approved runtime canary adapter/report commit. It
updates the current PR-head evidence, records the provider-shard-fixed canary
baseline promotion, and keeps the result as release/readiness evidence only
until live same-data provider runs are scored and a real production canary is
returned.

## Latest Verified PR Branch Head

- Commit: `5613051455f056f8161da8f9d4aac7c7aefe77cc`
- Commit title: `release: promote provider shard canary baseline`
- GitHub Actions run: `26779783551`
- CI conclusion: `success`
- PR branch: `feat/nucleus-wiki-native-contract`

## Approved Runtime Canary Baseline

- Commit: `5ac6c50e845c4c8d8e5d358e604700e4163b7fea`
- Commit title: `bench: fix provider shard repair path`
- GitHub Actions run: `26778156742`
- CI conclusion: `success`
- PR branch: `feat/nucleus-wiki-native-contract`

## Local Verification

The following checks passed on or against the latest verified PR branch head
before this baseline refresh:

- `npm exec --yes pnpm@10.23.0 -- release:check`
- `npm exec --yes pnpm@10.23.0 -- goal:audit`
- `npm exec --yes pnpm@10.23.0 -- benchmark:sota-doctor`
- `npm exec --yes pnpm@10.23.0 -- release:github-sync`
- Targeted public docs/evidence secret and private-path scan
- Stale local model server check
- GitHub Actions run `26779783551`

## Canary Handoff Artifact

The current sendable OpenClaw one-agent canary handoff packet is:

- Packet: `recallweave-openclaw-next-agent-canary-20260601-SEND-THIS-ONE-5ac6c50.zip`
- SHA256: `a434cbebec609f3427ba9c42ec467b650d5f414040caef0b3141df182d8b4ff2`
- Packet generated from controller commit:
  `5ac6c50e845c4c8d8e5d358e604700e4163b7fea`
- Approved adapter commit:
  `5ac6c50e845c4c8d8e5d358e604700e4163b7fea`
- Expected returned report commit:
  `5ac6c50e845c4c8d8e5d358e604700e4163b7fea`
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
