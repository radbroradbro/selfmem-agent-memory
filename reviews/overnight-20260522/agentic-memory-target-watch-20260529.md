# Agentic Memory Target Watch

- OK: true
- Primary candidate: LongMemEval-V2
- Source-lock ready: false
- Counts as benchmark score: false
- Public benchmark claims allowed: false
- Failed checks: none

## Candidates

- LongMemEval-V2: NEXT_SOURCE_LOCK_CANDIDATE; fit=agent-work-memory; blockers=6
- AMA-Bench: WATCH_TARGET; fit=long-horizon-agent-trajectories; blockers=4
- Agent Memory Benchmark: WATCH_TARGET; fit=provider-memory-product-parity; blockers=4

## Next Actions

- Source-lock LongMemEval-V2 repo commit, dataset revision, tier, scorer, labels, and leaderboard row before materialization.
- Add a LongMemEval-V2 materializer only after the source-lock report proves no raw data or private paths are committed.
- Keep AMA-Bench and Agent Memory Benchmark as second-wave targets until their scorer/model/split parity is pinned.
