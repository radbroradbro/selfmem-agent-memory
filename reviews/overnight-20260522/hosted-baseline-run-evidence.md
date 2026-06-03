# Hosted Baseline Run Evidence

Status: fixture-only orchestrator proven. This does not close the hosted
Supermemory baseline blocker.

## Change

Added `packages/bench/hosted-baseline-run.mjs` and the `baseline:run` package
script.

The runner performs the hosted-baseline chain after the private setup steps are
complete:

- validate reviewed query set with `baseline:queryset -- --strict`
- collect hosted Supermemory aggregate metrics
- export local RecallWeave responses as hashes and counters only
- collect matched RecallWeave aggregate metrics
- run hosted preflight
- compare hosted and RecallWeave results
- run next-run planning
- create the metrics-only baseline packet
- run returned-packet intake

The command defaults to fixture mode. Live mode requires explicit
`--live` or `RECALLWEAVE_BASELINE_LIVE=1`, `SUPERMEMORY_API_KEY`,
`RECALLWEAVE_BASELINE_NO_RAW_TEXT=1`, a hosted container, a local RecallWeave
container or memories file, a local container map, a private hosted container
map, judge and answer model ids, and `--reviewed-queryset` or
`RECALLWEAVE_BASELINE_QUERYSET_REVIEWED=1`.

## Verification

```bash
node --check packages/bench/hosted-baseline-run.mjs
node --check packages/bench/hosted-baseline-operator-packet.mjs
node --check packages/bench/hosted-baseline-next-run.mjs
node --check packages/bench/release-blocker-doctor.mjs
node --check packages/bench/release-readiness-check.mjs
npm exec --yes pnpm@10.23.0 -- baseline:run -- --fixture --output /tmp/recallweave-baseline-run.json
node packages/bench/hosted-baseline-operator-packet.mjs
node packages/bench/hosted-baseline-next-run.mjs
node packages/bench/release-blocker-doctor.mjs
```

Observed fixture runner result:

- mode: `hosted-baseline-run`
- fixtureOnly: `true`
- callsHostedProvider: `false`
- metricsOnly: `true`
- publicLaunchAllowed: `false`
- countsAsProductionBaselineEvidence: `false`
- status: `NOT_BASELINE_EVIDENCE`
- source-match ready: `true`
- source-alignment matched baseline allowed: `true`
- steps: 11
- packet entries: 6
- returned intake counts as production evidence: `false`

The operator packet and next-run planner now include
`run-matched-baseline-chain` with `baseline:run` and
`--reviewed-queryset`, `--local-map`, and `--private-map`. The runner itself now
executes `baseline:source-match` and `baseline:source-align` before any hosted
collection, so a label-matched but content-divergent setup fails closed before
spending hosted calls. The release blocker doctor now recommends the
orchestrated command once the private env file, reviewed private query set,
local container map, private hosted map, and local RecallWeave container are
ready.

## Safety

The runner output includes only basenames, aggregate metrics, hashes, privacy
counters, and pass/fail flags. It forbids provider keys, raw hosted memories,
raw local memories, transcripts, prompts, answers, private local paths, private
container maps, and private query sets.

Fixture output remains fixture-only. It is allowed for smoke testing and docs,
but it does not count as a fresh hosted Supermemory baseline.
