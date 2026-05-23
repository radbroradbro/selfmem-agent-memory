# Release Gate: Final Reviewer, Hosted Baseline, And Real Canary

## Summary

Track the final blockers before PR #5 can be treated as public-launch ready.
The code, fixture UI, and release gates are green, but public launch should
remain conservative until owner, hosted-baseline, and real canary
requirements are resolved.

## Current Evidence

- Latest code/product baseline: `5a5107fa4bdb710ad71db678d7336192845f0d4e`.
- GitHub Actions run `26321087248` passed CI after the strict adapter
  canary contract gate.
- Previous code/product baseline before the strict adapter canary contract:
  `7fc3be269e5e26d0fb0fb58fdcebcabb6b4f1744`.
- GitHub Actions run `26320492619` passed CI after the RecallWeave response
  export gate.
- Previous code/product baseline before the RecallWeave response export:
  `3b1870eb71fe406b77eabd380d9d786886b60236`.
- GitHub Actions run `26320054524` passed CI after the RecallWeave baseline
  collector gate after rerun attempt 2.
- Previous code/product baseline before the RecallWeave baseline collector:
  `8520140bfcb4cb08bed16ee3c34bcb6705fd9310`.
- GitHub Actions run `26319551404` passed CI after the baseline comparison
  gate.
- Previous code/product baseline before the baseline comparison gate:
  `95f7fea7519574427c7f26e94f00a1085f7c6fb2`.
- GitHub Actions run `26319050876` passed CI after the hosted baseline
  collector gate.
- Previous code/product baseline before the hosted baseline collector:
  `adfd4352d63810daecfa72a58ccb2c2641b89580`.
- GitHub Actions run `26318710488` passed CI after the hosted baseline
  operator packet evidence refresh.
- Previous code/product baseline before the hosted baseline operator packet
  evidence refresh: `39feae5f825c045e681aa93f6e71b02ebf4b32c1`.
- GitHub Actions run `26318633036` passed CI after the hosted baseline
  operator packet gate.
- Previous code/product baseline before the hosted baseline operator packet:
  `2b7fc92d43e1aeff1211dba7eb0c5727bce2fd7b`.
- GitHub Actions run `26318177698` passed CI after the fresh canary window
  isolation gate.
- Previous code/product baseline before the fresh canary window isolation gate:
  `9eeed9e8e6665588efba9d2dfdfbb57785d05b17`.
- GitHub Actions run `26317637761` passed CI after the adapter store latency
  trace gate.
- Previous code/product baseline before the adapter store latency trace gate:
  `6b772936f57fbe31e33aaeb18bb4696da90b8185`.
- GitHub Actions run `26317344140` passed CI after the strict-real canary
  operator packet.
- Previous code/product baseline before the strict-real canary operator packet:
  `4b2ec839cddbce73540d3aea02b4b81f2a474e6a`.
- GitHub Actions run `26316961518` passed CI after the strict-real update
  guard.
- Earlier code/product baseline before the strict-real update guard:
  `6a8bbf09ef6e24ed12c30e0fcff1fe185100e907`.
- GitHub Actions run `26316450928` passed CI after the Brain UI lifecycle
  trail evidence refresh.
- Previous code/product baseline before the latest lifecycle trail evidence
  refresh: `8777290169f598ff9172e889e927858b3956f764`.
- GitHub Actions run `26316074705` passed CI after the Brain UI lifecycle
  trail and current-head browser evidence refresh.
- Earlier code/product baseline before the lifecycle trail browser evidence
  refresh: `b5c1e025db072fca750dc6730741c23e1b981eca`.
- GitHub Actions run `26313942262` passed CI after the GitHub live sync
  release gate.
- Previous code/product baseline before the live sync release gate:
  `e765e8ff331475c6f91565f4e68577b011e4781a`.
- GitHub Actions run `26313358962` passed CI after the Hermes and OpenClaw
  bounded read-through latency patch.
- Local release readiness, smoke, goal audit, hosted-baseline preflight, canary
  evidence intake, canary report generation, and canary diagnosis all passed in
  their safe fixture or metrics-only modes.
- Hosted baseline operator packet now gives agents a public-safe collection
  handoff for aggregate-only hosted Supermemory baseline evidence.
- Hosted baseline collector now gives agents a read-only `baseline:collect`
  path that emits metrics and hashes only when live credentials are provided
  through the local environment.
- RecallWeave response exporter now gives agents a `baseline:export:recallweave`
  path that turns a local `memories.jsonl` container into a metrics-only
  response export without raw memory text.
- RecallWeave baseline collector now gives agents a
  `baseline:collect:recallweave` path that converts local metrics-only
  search-response exports into matched result files and rejects raw response
  text by default.
- Baseline comparison now gives agents a `baseline:compare` gate that compares
  only aggregate hosted and RecallWeave result files, requires matched
  source-lock hashes, and blocks fixture inputs from public benchmark claims.
- Fresh canary window isolation now requires post-update `--since` evidence so
  old pre-patch trace history cannot prove or poison a patched one-agent canary.
- Strict-real canary intake now exits nonzero while still printing sanitized
  JSON for fixture or weak real evidence, so agents can run remediation from
  failed metrics without attaching raw logs.
- Strict v1 adapter contract markers and updater adapter digests now make stale
  installed adapters visible before a one-agent canary report can count as real
  rollout evidence.
- Canary evidence packet packaging now gives agents one metrics-only zip for
  report, intake, and optional diagnosis files, while blocking raw logs and
  keeping fixture/failing packets from counting as rollout evidence.
- Adapter smokes now assert bounded read-through policy plus positive total,
  local, and remote recall timings.
- Secret and private-name scans found no actual credential or private memory
  exposure in the changed evidence files.

## Remaining Blockers

- Claude/Opus review completed with `CONCERNS`; it supports alpha PR review
  but does not approve public launch.
- Human approval is required before merge, visibility changes, or public live
  update copy.
- Hosted Supermemory comparison claims require a fresh metrics-only baseline.
  The current hosted-baseline preflight deliberately calls no hosted provider
  and blocks public benchmark claims.
- One real-container production canary remains incomplete. Fixture UI and
  report tooling are not a production rollout.
- Two redacted real diagnostic bundles were evaluated and rejected by strict
  rollout intake on missing store latency and recall p95. The next canary must
  use a fresh patched runtime window and pass strict intake.

## Acceptance Criteria

- The owner accepts the Claude `CONCERNS` review as alpha-PR evidence.
- A real one-agent canary report is collected through the sanitized canary
  report/intake path and passes privacy, lifecycle, hybrid search, latency,
  rollback, and write/read checks.
- Any hosted comparison claim is backed by a fresh metrics-only baseline using
  the same dataset, judge, settings, and scoring code.
- The owner approves merge and public release wording.
- Public evidence contains no raw memories, transcripts, diagnostics,
  credentials, agent logs, private paths, or private container names.
