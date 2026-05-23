# Baseline Source-Gap Plan Evidence

Date: 2026-05-23

Added `baseline:source-gap`, a metrics-only planner that reads public-safe
`baseline:source-match` and `baseline:source-align` reports and emits one
ready-or-repair path before another hosted Supermemory baseline run.

## Commands

```bash
node --check packages/bench/baseline-source-gap-plan.mjs
npm exec --yes pnpm@10.23.0 -- baseline:source-gap
node packages/bench/baseline-source-gap-plan.mjs \
  --source-match <fixture-source-match-report> \
  --source-alignment <fixture-source-alignment-report> \
  --output <fixture-source-gap-report>
node packages/bench/baseline-source-gap-plan.mjs \
  --source-match <blocked-source-match-report> \
  --source-alignment <blocked-source-alignment-report> \
  --output <blocked-source-gap-report>
```

## Fixture Pass Result

- Mode: `baseline-source-gap-plan`.
- Metrics only: true.
- Public safe: true.
- Raw labels included: false.
- Raw memory included: false.
- Repair status: `READY_FOR_MATCHED_BASELINE`.
- Recommended path: `run-matched-baseline`.
- Baseline run blocked: false.
- Private leak count: 0.

## Blocked Fixture Result

- Mode: `baseline-source-gap-plan`.
- Repair status: `BLOCKED_CONTENT_DIVERGENT`.
- Recommended path: `mirror-hosted-source-or-rebuild-queryset`.
- Baseline run blocked: true.
- Query count: 1.
- Source-matched query count: 0.
- Collectable query count: 0.
- Failed checks:
  - `local-source-missing-expected-refs`
  - `local-export-cannot-score-every-query`
- Private leak count: 0.

## Integrated Surfaces

- `package.json` exposes `baseline:source-gap` and includes it in `smoke`.
- `consumer:smoke` copies, runs, and package-checks
  `packages/bench/baseline-source-gap-plan.mjs`.
- `release:doctor` lists the source-gap command between source-alignment and
  `baseline:run`.
- `goal:audit` records `baseline-source-gap-plan` as proven but keeps the native
  goal incomplete.
- `release:check` verifies the source-gap report, operator packet, next-run
  planner, one-command baseline runner, evidence docs, and public-safe output.
- `baseline:operator-packet` and `baseline:next-run` now include a
  `plan-source-gap` step and attach-only path.
- `baseline:run` writes `baseline-source-gap.json` after source alignment and
  before hosted collection.

## Safety Boundary

The source-gap planner does not read raw memories, raw transcripts, raw prompts,
raw answers, provider keys, private env files, private query sets, private
container maps, or private local paths. It rejects key-shaped strings, private
paths, raw container labels, raw query text, raw memory text, and raw expected
result refs in its inputs and output.
