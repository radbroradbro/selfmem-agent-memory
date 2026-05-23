# Release Gate: Final Reviewer, Hosted Baseline, And Real Canary

## Summary

Track the final blockers before PR #5 can be treated as public-launch ready.
The code, fixture UI, and release gates are green, but public launch should
remain conservative until owner, hosted-baseline, and real canary
requirements are resolved.

## Current Evidence

- Latest code/product baseline: `e7ce4f1c1a05b6e416b16234784f8694b83615bf`.
- GitHub Actions run `26331102535` passed CI after adding the
  `baseline:run` hosted-baseline orchestrator.
- Previous verified code baseline before hosted baseline run orchestration:
  `14030ddd9c88020c114a3e5fd3d32735f31557a6`.
- GitHub Actions run `26330646504` passed CI after one-command canary evidence
  packaging.
- Previous verified code baseline before one-command canary evidence
  packaging: `54f59ee18094d824e3696e13621ac4070e795a7b`.
- GitHub Actions run `26330433491` passed CI after the post-baseline public
  evidence guard.
- Previous verified code baseline before post-baseline public evidence
  enforcement: `c3e948735c1d91c1eacfbc1e7bebba22622bf993`.
- GitHub Actions run `26330234781` passed CI after current canary handoff
  packet identity coverage.
- Previous verified code baseline before current canary handoff identity
  coverage: `cdf4615de1e9e3c7fa161d70f40fe5bf3e4cea76`.
- GitHub Actions run `26329828449` passed CI after matched baseline
  counterpart-run hardening.
- Previous verified code baseline before matched-counterpart hardening:
  `c0036470512950fa77900221f08d0cbafeab6d7b`.
- GitHub Actions run `26329521666` passed CI after hosted baseline query-set
  authoring.
- Previous verified code baseline before hosted baseline query-set authoring:
  `94be156c52904e9379372023037cb7cccff8c7ad`.
- GitHub Actions run `26329113469` passed CI after the hosted baseline
  container selector.
- Previous verified code baseline before hosted baseline container selection:
  `e9a483af3a416c5d5db17ae511d25c40f52d4c12`.
- GitHub Actions run `26328719263` passed CI after hosted baseline next-run
  readiness gating.
- Previous verified code baseline before hosted baseline next-run readiness:
  `c19e4dc7be0f45d9d1b29a6e5381cd48fc82c1eb`.
- GitHub Actions run `26328477985` passed CI after refreshing release-state
  and PR-body evidence for the one-agent handoff hardening baseline.
- Previous verified code baseline before the release-state refresh:
  `07cd61b009e85c071d2a54dc9de1b53db5525e6c`.
- GitHub Actions run `26328348834` passed CI after the one-agent next-agent
  handoff hardening.
- Previous verified code baseline before one-agent next-agent handoff
  hardening: `dd31fcb293fc8d591aa572fe5c77d4012a5fe630`.
- GitHub Actions run `26327680816` passed CI after public-safe live hosted
  discovery evidence for hashed candidates.
- Previous verified code baseline before live hosted discovery evidence:
  `2ac02fcbb9d321dc338e59d856abbcc3cfb6cd0a`.
- GitHub Actions run `26327367386` passed CI after public-safe query-set
  inspection.
- Previous verified code baseline before the query-set inspector:
  `c9c655049c036ca773a62e1c6498bc3438198986`.
- GitHub Actions run `26327102787` passed CI after labeled query-set gating.
- Previous verified code baseline before labeled query-set gating:
  `a5d300ad1986e166d214e5c4dae537ad7f2f1bcb`.
- GitHub Actions run `26326805194` passed CI after adding local-session batch
  compaction audit to the formal goal audit and release gate.
- Previous verified code baseline before the goal-audit batch compaction
  extension: `8d49cf35af0aeeb34b37e913041c723035ff8cca`.
- GitHub Actions run `26326589900` passed CI after the local-session batch
  compaction audit gate.
- Previous verified code baseline before local-session batch compaction:
  `c01513ff37f17562b4fe9f9930332439d5404ec0`.
- GitHub Actions run `26326199048` passed CI after hosted baseline discovery
  and next-run planner extension.
- Previous verified code baseline before hosted baseline discovery and
  next-run planner extension: `00836ec3105c84814aa65885a1d6828aa298f6a6`.
- GitHub Actions run `26325592308` passed CI after hosted baseline returned
  packet intake.
- Previous verified code baseline before hosted baseline returned packet
  intake: `aedb81ab3a61ec7c70e3ac7cd07e8085637d5ea3`.
- GitHub Actions run `26325210942` passed CI after returned canary packet
  intake.
- Previous verified code baseline before returned canary packet intake:
  `7fdac2f287c589ba75731722edaee17cd154451c`.
- GitHub Actions run `26324810035` passed CI after the canary next-agent
  handoff packet.
- Previous verified code baseline before the canary next-agent handoff packet:
  `8f5910d49a6f1fe4d8967e014c5dd8e1df3e7b6e`.
- GitHub Actions run `26324442965` passed CI after the real OpenClaw
  next-agent handoff and CI read-permission fix.
- Previous verified code baseline before the real OpenClaw next-agent handoff:
  `1d8375a8dbcc9027d48d7e6821ff24d99fcdb916`.
- GitHub Actions run `26324201679` passed CI after mixed canary diagnostic
  batch triage.
- Previous verified code baseline before mixed canary diagnostic batch triage:
  `d7e2e13304cd81b9ae3b6013915f13d727f88ebe`.
- GitHub Actions run `26323991060` passed CI after package-script-safe
  evidence output.
- Previous verified code baseline before package-script-safe evidence output:
  `6c44714e5af4bc578f50070c51d40201303ad6c4`.
- GitHub Actions run `26323533153` passed CI after release blocker doctor
  real-canary blocker gate.
- Previous verified code baseline before release blocker doctor real-canary
  blocker gate: `4aa363dcb6e95e3f3a3e94d9b5297bca639211e8`.
- GitHub Actions run `26323255585` passed CI after hosted baseline next-run
  planner gate.
- Previous verified code baseline before hosted baseline next-run planner:
  `0c881257923eb813e904ff11f364648c94823080`.
- GitHub Actions run `26322830311` passed CI after the canary next-agent
  planner gate.
- Previous verified code baseline before the canary next-agent planner gate:
  `b5ad1b8f9e25832cbdc9afcaa6ad6c71685e7e68`.
- GitHub Actions run `26322521697` passed CI after the canary diagnostic batch
  audit gate.
- Previous verified code baseline before the canary diagnostic batch audit gate:
  `4ed6c006ac8e69f55bd91f5541dc127b7f0b272d`.
- GitHub Actions run `26322155069` passed CI after the canary packet review
  gate.
- Previous verified code baseline before the canary packet review gate:
  `c278419cee62520513a66a06e7e0ecaad27096c5`.
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
- Canary diagnostic batch audit now lets the controller process a folder of
  redacted returned diagnostic bundles, rank the closest candidate, and keep
  `--require-real-pass` blocked unless a non-fixture strict-real canary passes.
- Canary next-agent planning now converts the batch result into one OpenClaw or
  Hermes fresh-window update plan with placeholder commands and metrics-only
  attachment rules, while fixture evidence and fleet rollout remain blocked.
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
- The available redacted real diagnostic bundle set was evaluated and rejected
  by strict rollout intake. The closest privacy-clean candidate was under the
  recall p95 threshold, but still lacked current adapter-contract and store
  latency evidence. The next canary must use a fresh patched runtime window and
  pass strict intake.
- Current one-agent handoff packet:
  `recallweave-openclaw-next-agent-canary-20260523-continued.zip`, SHA256
  `5967d1fa0ce84aaf1d7890017c6e32cc6fb2960e2c2d0cbb38ae2522be6ec5bf`.
  It is ready only for one fresh OpenClaw canary window, not fleet rollout.

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
