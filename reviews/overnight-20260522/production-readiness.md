# Production Readiness

Date: 2026-05-22

Verdict: FAIL

RecallWeave should not receive a public live update yet. PR #5 is substantial
and directionally aligned with the LLM-wiki/Nucleus/Brain UI target, but the
gate still lacks enough human-approval, hosted-baseline, and real-canary
evidence to mark it production ready.

## Current PR Trail

- PR: <https://github.com/radbroradbro/selfmem-agent-memory/pull/5>
- State checked through the GitHub connector: open, not draft, mergeable.
- Inline review threads checked through the GitHub connector: none unresolved.
- Branch: `feat/nucleus-wiki-native-contract`
- Base: `main`

## What Actually Shipped Or Was Proposed

Evidence in PR #5 and `reviews/overnight-20260522/` shows proposed work for:

- Nucleus Index contracts for memory nodes, lifecycle events, retrieval traces,
  wiki pages, and research lineage.
- LLM-wiki compiler and disk-sync flow with lint and reviewed-page conflict
  handling, plus optional content-free pre-write audit logging.
- Fixture-first Brain UI for search, graph/index inspection, provenance,
  lifecycle/retrieval trace inspection, derived doc editing, draft export,
  vault preview, sync report, Nucleus snapshot preview, local audit preflight,
  selected local-container audit preview, browser-local selected audit history,
  selected local-container browse preview, selected local memory edit overlay,
  local edit overlay browse visibility, selected local memory materialize,
  selected vault sync dry-run,
  selected vault sync apply, lifecycle policy preview, selected lifecycle
  policy apply, memory review queue preview, and selected review queue apply.
- Deterministic Brain UI dynamic graph layout that derives visible node
  positions from the current Nucleus graph, grows vertically, scrolls when
  needed, and replaces the older fixed fixture coordinates.
- Brain UI graph navigation controls for all-vs-neighborhood scope,
  jump-to-node selection, and selected-node centering.
- Brain UI Compaction Audit panel that renders local-session audit metrics and
  candidate fingerprints without raw session or candidate text.
- Brain UI Benchmark Dashboard panel that renders fixture local-only
  compaction benchmark pass/fail metrics, exact-identifier accuracy, noise
  reduction, scenario status, and benchmark caveats without raw session or
  candidate text.
- Brain UI Canary Rollout panel that renders one-agent canary prerequisites,
  dry-run/apply/observe/rollback steps, metrics to collect, blockers, and
  caveats without touching a real agent or local path.
- Brain UI Research Source Lock panel that renders current public sources,
  implementation rules, topic-path and stale-memory supersession decisions,
  dashboard-to-cluster zoom direction, benchmark targets, collapsed technical
  export, and source caveats without touching private research notes or local
  memory.
- Brain UI Context Preview panel that renders the fixture prompt recall packet,
  selected memories, omitted candidates, token budget, read-only hosted mode,
  local-only write mode, and safety counters.
- Brain UI Release Readiness panel that renders the current fixture public
  launch verdict, production-ready flag, verified CI status, proven surfaces,
  blockers, manual actions, hosted write-back status, and safety counters.
- May 2026 model/autoresearch matrix gate that keeps Apple Silicon local model
  support, Voyage/Gemini/NVIDIA cloud challengers, and query expansion behind
  matched canary evidence instead of public benchmark claims.
- Hosted baseline preflight that makes the Supermemory comparison path
  explicit while calling no hosted provider by default and keeping public
  benchmark claims blocked.
- Hosted baseline collector that can run read-only hosted search only after
  explicit live opt-in and emits aggregate metrics and hashes only.
- RecallWeave response exporter that turns a local `memories.jsonl` container
  into a metrics-only response export without raw memory text.
- RecallWeave baseline collector that converts a local metrics-only
  search-response export into the matched RecallWeave result file, using the
  same source-locked query set and scoring contract as hosted.
- Baseline comparison gate that compares only aggregate hosted and RecallWeave
  result files, requires source-matched harness fields, and blocks fixture
  inputs from public benchmark claims.
- Hosted baseline operator packet that gives agents a public-safe,
  aggregate-only hosted Supermemory baseline handoff without calling a hosted
  provider.
- Hosted baseline container selector that keeps raw hosted labels in a
  local-only 0600 env file and keeps public reports hash-and-metrics only.
- Baseline evidence packet that turns hosted result, RecallWeave result,
  matched comparison, and preflight output into one metrics-only reviewer zip
  and fails closed for fixtures under `--strict-real`.
- GitHub live sync check that compares live PR #5 and blocker issue #6 against
  checked-in release drafts without printing body text or credentials.
- Canary evidence intake that accepts sanitized one-agent runtime reports with
  lifecycle, hybrid-search, local-write, read-through, latency, privacy, and
  rollback metrics, while refusing raw memories, transcripts, prompts,
  answers, secrets, and local paths.
- Canary evidence packet packaging that turns metrics-only report/intake and
  optional diagnosis files into one attachable zip, while keeping fixture or
  failed diagnostic packets from authorizing rollout.
- Canary report generator that turns Hermes/OpenClaw trace files into the
  sanitized runtime report needed by `canary:intake --strict-real`, without
  printing raw memories, transcripts, prompts, answers, local paths, or
  credentials.
- Brain UI Model Matrix panel that renders the guarded cloud/local model
  matrix, Apple Silicon local lane, query-expansion status, credential mode,
  reviewer gates, and hosted-baseline blockers without touching private memory
  or credentials.
- Session compaction fixture benchmark.
- Dry-run-first updater wrapper and updater smoke.
- Clean consumer smoke that builds a temporary public-style checkout and runs
  updater, Brain UI, local audit, compaction audit, and package dry-run checks
  from that copy.
- Release-readiness gate.

These are proposed on PR #5. They are not yet merged to `main`.

## Verification Run

Passed in this run:

- `npm run build`
- `npm run test`: 6 files, 22 tests
- `npm run typecheck`
- `npm run privacy:test`
- `npm run smoke:openclaw`: `privacyLeakCount: 0`
- `npm run smoke:hermes`: `privacyLeakCount: 0`
- `npm run compaction:smoke:built`
- `npm run compaction:benchmark:built`: 5 of 5 scenarios passed,
  `privacyLeakCount: 0`, exact identifier accuracy 1
- `npm run wiki:smoke:built`
- `npm run wiki:sync:smoke:built`
- `npm run update:smoke`
- `npm run release:check`
- `npm run release:github-sync`
- `git diff --check`
- Core package `npm pack --dry-run` when npm used a writable temporary cache

Initial cron-environment blockers:

- `pnpm install --frozen-lockfile`: blocked because the sandbox could not resolve
  the npm registry.
- `npm run brain:smoke:built`: failed because localhost binding was denied in
  this sandbox.
- `npm run release:check`: failed on the fresh Brain UI smoke for the same
  localhost binding reason. With a writable npm cache, package dry-run passed.
- Claude CLI reviewer: initially blocked because bare mode ignored OAuth, then
  completed with `CONCERNS` using `--setting-sources local`.
- Gemini CLI production-readiness reviewer: blocked because the CLI requested
  browser authentication and did not return a review.

Controller follow-up after that sandbox run:

- `pnpm brain:smoke`: passed with the fresh Brain UI.
- `pnpm release:check`: passed.
- GitHub Actions CI run `26288370812` on inspected baseline `2888f91` passed,
  including Test, Full smoke, and Release readiness check.
- GitHub Actions CI run `26289073223` on release-state guard commit `dd17f44`
  passed after the Gemini guard review became required.
- GitHub Actions CI run `26290534116` on guarded selected vault sync apply
  commit `103e7c6` passed Test, Full smoke, and Release readiness check.
- GitHub Actions CI run `26291352800` on guarded selected local-container
  browse commit `04f1096` passed Test, Full smoke, and Release readiness check.
- GitHub Actions CI run `26292137539` on guarded selected lifecycle policy
  apply commit `3b5e140` passed Test, Full smoke, and Release readiness check.
- GitHub Actions CI run `26292772262` on guarded selected review queue apply
  commit `19f2577` passed Test, Full smoke, and Release readiness check.
- GitHub Actions CI run `26293533847` on guarded selected local memory edit
  overlay commit `72ab902` passed Test, Full smoke, and Release readiness
  check.
- GitHub Actions CI run `26294323086` on guarded local edit overlay browse
  commit `b5352a0` passed Test, Full smoke, and Release readiness check.
- GitHub Actions CI run `26295772356` on guarded local memory materialize
  commit `21fd4d6` passed Test, Full smoke, and Release readiness check.
- Focused Gemini reviews for the Nucleus snapshot and Research Lineage slices
  returned final `CLEAN` verdicts.
- Focused Gemini reviews for Brain UI local-audit preview and selected
  local-audit preview returned `CLEAN` verdicts.
- Focused Gemini review for selected local-container browse returned `CLEAN`.
- Focused Gemini review for selected local memory edit returned `CLEAN`.
- Focused Gemini review for local edit overlay browse returned `CLEAN`.
- Focused Gemini review for local memory materialize returned `CLEAN`.
- Focused Gemini review for selected audit-history returned `CLEAN`.
- Focused Gemini reviews for selected vault sync dry-run and lifecycle policy
  preview returned `CLEAN`.
- Focused Gemini review for memory review queue returned `CLEAN`.
- Focused Gemini review for selected review queue apply returned `CLEAN`.
- GitHub Actions CI run `26288370812` on inspected baseline `2888f91` passed.
- GitHub Actions CI run `26289073223` on release-state guard commit `dd17f44`
  passed.
- GitHub Actions CI run `26290534116` on guarded selected vault sync apply
  commit `103e7c6` passed.
- GitHub Actions CI run `26291352800` on guarded selected local-container
  browse commit `04f1096` passed.
- GitHub Actions CI run `26292137539` on guarded selected lifecycle policy
  apply commit `3b5e140` passed.
- GitHub Actions CI run `26292772262` on guarded selected review queue apply
  commit `19f2577` passed.
- GitHub Actions CI run `26293533847` on guarded selected local memory edit
  overlay commit `72ab902` passed.
- GitHub Actions CI run `26294323086` on guarded local edit overlay browse
  commit `b5352a0` passed.
- GitHub Actions CI run `26295772356` on guarded local memory materialize
  commit `21fd4d6` passed.
- GitHub Actions CI run `26297064340` on dynamic graph layout commit
  `be47cff` passed Test, Full smoke, and Release readiness check. Browser
  evidence reports `dynamic-graph-layout`, 9 fixture nodes, 9 fixture edges, 2
  columns, 5 rows, zero overlaps, zero console errors, and no
  private/key-shaped visible text.
- GitHub Actions CI run `26297876735` on graph navigation controls commit
  `62367a1` passed Test, Full smoke, and Release readiness check. Browser
  evidence reports neighborhood scope, 3 visible fixture nodes, 9 jump options,
  selected-node visibility, zero console errors, and no private/key-shaped
  visible text.
- GitHub Actions CI run `26299756374` on Brain UI Compaction Audit commit
  `fb466db` passed Test, Full smoke, and Release readiness check. Browser
  evidence reports metrics-only mode, 6 fixture input events, 4 candidate
  fingerprints, 2 redactions, chronological output, 1 exact-identifier
  candidate, zero privacy leaks, zero console errors, and no raw candidate
  text.
- GitHub Actions CI run `26300784883` on Brain UI Context Preview commit
  `0ec4396` passed Test, Full smoke, and Release readiness check.
- GitHub Actions CI run `26301888111` on Brain UI Release Readiness commit
  `8c26de7` passed Test, Full smoke, and Release readiness check.
- Brain UI Context Preview local verification passed fresh Brain UI smoke and
  interaction smoke. Browser evidence reports 642 of 900 fixture context tokens
  used, 258 tokens remaining, 3 selected memories, 3 context sections, 2
  omitted candidates, hosted read-through as read-only, local-only writes, zero
  privacy leaks, zero console errors, and no private/key-shaped visible text.
- Brain UI Release Readiness local verification passed fresh Brain UI smoke
  and interaction smoke. Browser evidence reports public launch verdict `FAIL`,
  `productionReady: false`, 16 proven surfaces, 5 remaining blockers, 5 manual
  actions, fixture-only evidence, hosted write-back disabled, zero privacy
  leaks, zero console errors, and no private/key-shaped visible text. GitHub
  Actions CI run `26301888111` passed on `8c26de7`.
- Brain UI Benchmark Dashboard local verification passed fresh Brain UI smoke
  and interaction smoke. Browser evidence reports 5 of 5 fixture scenarios
  passed, 0 failed scenarios, 0 privacy leaks, exact-identifier accuracy 1,
  average noise reduction 0.307, hosted-baseline caveat visible, no-raw-text
  caveat visible, zero console errors, and no private/key-shaped visible text.
  GitHub Actions CI run `26302442423` passed on `d0113c0`.
- Brain UI Canary Rollout local verification passed fresh Brain UI smoke and
  interaction smoke. Browser evidence reports `READY_FOR_ONE_AGENT_CANARY`,
  one-agent scope, hosted Supermemory read-through-only mode, public launch
  verdict `FAIL`, owner approval required, 5 steps, 11 metrics to collect,
  rollback and dry-run steps visible, zero console errors, and no
  private/key-shaped visible text. GitHub Actions CI run `26302990767` passed
  on `f51346f`.
- Brain UI Research Source Lock local verification passed fresh Brain UI smoke,
  interaction smoke, browser evidence, release readiness check, and GitHub
  Actions CI run `26304465466` on `e043d6b`. Browser evidence reports 11
  public sources, 8 implementation rules, dashboard-to-cluster zoom,
  topic/subtopic path and stale-supersession rules, zero console errors, and no
  private/key-shaped visible text.
- May 2026 model/autoresearch matrix gate verification passed local release
  readiness check, local full smoke, and GitHub Actions CI run `26305284384` on
  `13cbe8d`. The gate keeps provider credentials env-only, sets the Apple
  Silicon local default to Qwen3 0.6B through Hugging Face/llama.cpp/Metal,
  treats Voyage/Gemini/NVIDIA as controlled benchmark arms, and leaves query
  expansion disabled until a matched canary proves value.
- Model/autoresearch release-gate hardening passed GitHub Actions CI run
  `26305635737` on `22e17b1`. The release readiness check now requires the
  model matrix and autoresearch plan, verifies conservative local/cloud/query
  expansion defaults, and scans those docs/configs for key-shaped secrets.
- Brain UI Model Matrix local verification passed fresh Brain UI smoke,
  interaction smoke, browser evidence, release readiness check, and Gemini
  focused review. Browser evidence reports 6 provider arms, 4 cloud arms, 2
  local arms, Apple Silicon Qwen3 0.6B local default, Voyage/Gemini/NVIDIA
  cloud arms, query expansion off, env-only credentials, 5 gates, 3 blockers,
  zero console errors, and no private/key-shaped visible text. GitHub Actions
  CI run `26306469240` passed on `ff6f343`.
- Clean consumer smoke verification passed locally. A temporary public-style
  checkout ran updater help, update smoke, Brain UI smoke, Brain UI
  interaction smoke, local-container audit smoke, local-session compaction
  audit, and npm package dry-run, then verified required docs/package files,
  zero forbidden runtime files, and zero key-shaped hits. GitHub Actions CI
  run `26306827655` passed on `4cee083`.

## UI Evidence

Existing fixture-only UI evidence is present under
`reviews/overnight-20260522/ui-evidence/`, including screenshots and DOM
evidence for:

- main Brain UI graph/editor,
- vault preview,
- sync report,
- edit draft export,
- Nucleus snapshot preview.
- research-lineage preview,
- local audit preflight,
- selected local-container audit preview,
- selected local-container browse preview,
- selected local memory edit overlay,
- local edit overlay browse visibility,
- selected local memory materialize,
- selected audit history.
- selected vault sync dry-run,
- selected vault sync apply,
- lifecycle policy preview.
- selected lifecycle policy apply.
- memory review queue preview.
- selected review queue apply.
- Codex Browser DOM evidence for the main Brain UI surfaces.
- dynamic graph layout evidence with zero overlaps and fixture-only text.
- graph navigation controls evidence with fixture-only neighborhood scope and
  jump-to-node controls.
- compaction audit evidence with metrics-only fixture output, 6 input events,
  4 candidate fingerprints, chronological output, zero privacy leaks, zero
  console errors, and no raw candidate text.
- benchmark dashboard evidence with fixture local-only compaction benchmark
  metrics, 5 of 5 scenarios passed, hosted-baseline caveat, no-raw-text caveat,
  zero privacy leaks, zero console errors, and no private/key-shaped visible
  text.
- canary rollout evidence with fixture one-agent rollout status, dry-run and
  rollback path, metrics to collect, public launch still blocked, zero privacy
  leaks, zero console errors, and no private/key-shaped visible text.
- research source lock evidence with 11 public sources, 8 implementation
  rules, topic/subtopic path, stale-memory supersession, budgeted
  lifecycle-frequency decisions, dashboard-to-cluster zoom direction,
  collapsed technical export, zero privacy leaks, zero console errors, and no
  private/key-shaped visible text.
- model matrix evidence with 6 fixture provider arms, Apple Silicon local
  defaults, Voyage/Gemini/NVIDIA cloud arms, query expansion off, env-only
  credential mode, reviewer gates, hosted-baseline blockers, zero console
  errors, and no private/key-shaped visible text.
- context preview evidence with the fixture prompt recall packet, selected and
  omitted candidates, token budget, read-only hosted mode, local-only writes,
  zero privacy leaks, zero console errors, and no private/key-shaped visible
  text.
- release readiness evidence with the fixture public launch verdict, blocker
  list, manual action list, CI status, hosted write-back disabled, zero privacy
  leaks, zero console errors, and no private/key-shaped visible text.
- clean consumer smoke evidence with a fresh public-style checkout, updater
  help, Brain UI checks, local audit, compaction audit, npm package dry-run,
  required docs/package files, zero forbidden runtime files, and zero
  key-shaped hits.
- release blocker doctor evidence with conservative release-state checks,
  required blocker files, token-free remote verification, Claude/GitHub blocked
  route evidence, and manual next actions. It keeps `publicLaunchAllowed:
  false` and `productionReady: false`. GitHub Actions CI run `26307335652`
  passed on `d93d781`.
- current-head live browser evidence with a fresh rendered Brain UI screenshot
  on `8777290`, Nucleus graph visibility, wiki/vault sync visibility, model
  matrix visibility, context preview visibility, release readiness visibility,
  lifecycle trail visibility, lifecycle event card visibility, retrieval trace
  card visibility, zero console errors or warnings, zero private/key-shaped
  visible text hits, and public launch still `FAIL`.
- generated GitHub handoff packet evidence with paste-ready PR body, status
  comment, blocker issue title/body, labels, and manual GitHub steps. The
  packet writes no files, uses fixture/public release metadata only, reports
  zero privacy leaks, and keeps `productionReady: false`. GitHub Actions CI
  runs `26308475033` on `6a33e62` and `26308588261` on `8efe4d0` passed.
- goal completion audit evidence with `goalComplete: false`,
  `mayCallUpdateGoalComplete: false`, 25 proven requirements, 2 blocked
  requirements, and 1 incomplete requirement. This keeps production readiness
  separate from the native thread goal completion claim. GitHub Actions CI run
  `26308994908` passed on `13efb18`.
- hosted baseline preflight evidence with `callsHostedProvider: false`,
  `metricsOnly: true`, `hostedBaselineFresh: false`, and
  `benchmarkClaimsAllowed: false`. The preflight accepts only aggregate
  metrics and hashes for later live results, never raw memory text or
  credentials.
- hosted baseline collector evidence with fixture-mode metrics, query-set and
  scoring-code hashes, result fingerprints, latency metrics, retrieval
  metrics, and no raw memory, transcript, prompt, answer, credential, or
  private-path output; Gemini returned `CLEAN`.
- RecallWeave response export evidence with local-container fixture input,
  private-entry skipping, live no-raw-text enforcement, metrics-only output,
  and Gemini `CLEAN` review.
- RecallWeave baseline collector evidence with matched query-set and
  scoring-code hashes, raw-response-text rejection in live mode, metrics-only
  output, and Gemini `CLEAN` review.
- baseline comparison evidence with matched fixture metrics, explicit
  fixture-blocked public claims, required metric/privacy fields, and Gemini
  review coverage.
- hosted baseline operator packet evidence with attach-only aggregate JSON
  outputs, env-only credential handling, no hosted provider call, and Gemini
  `CLEAN` review.
- hosted baseline query-set author evidence with fixture and bounded live smoke
  coverage, private 0600 query-set output outside the repository, public counts
  and hashes only, strict query-set inspection, and Gemini `CLEAN` review.
- canary evidence intake evidence with `fixtureOnly: true`,
  `countsAsRealRolloutEvidence: false`, lifecycle coverage, hybrid search
  coverage, local write observation, read-through mode, p50/p95 latency,
  rollback readiness, zero secret hits, and zero privacy leaks. This proves the
  intake gate, not a real rollout.
- canary report generator evidence with trace-derived lifecycle counts,
  hybrid-search coverage, recall/store latency, privacy counters, event
  fingerprints, and fixture rejection under `--strict-real`.
- canary diagnostic bundle evidence with metadata-only directory and ZIP intake,
  relocated fixture detection, strict-real fixture rejection, and no raw memory
  or local-path output.
- canary remediation evidence with failed-check diagnosis, metrics-only action
  plans, and fleet/public rollout still blocked.
- canary operator packet evidence with public-safe Hermes/OpenClaw strict-real
  collection commands, attach-only metrics files, pass criteria, and forbidden
  raw artifacts. This helps collect the next live canary but does not satisfy it.
- canary evidence packet evidence with `canary:packet`, a metrics-only zip
  builder for report/intake/diagnosis files that rejects raw-content keys,
  key-shaped secrets, and private local paths.
- real canary diagnostic evidence from two redacted external Hermes bundles,
  both privacy-clean and both rejected by strict rollout intake because store
  latency was missing and recall p95 exceeded the strict threshold.
- GitHub Actions CI run `26310773948` passed on `6ae4ce7`, including Test,
  Full smoke, and Release readiness check for the canary report generator gate.
- GitHub Actions CI run `26311728246` passed on `77b3cee`, including Test,
  Full smoke, and Release readiness check for the diagnostic bundle canary
  report gate.
- GitHub Actions CI run `26312283137` passed on `4f5a079`, including Test,
  Full smoke, and Release readiness check for the canary remediation diagnosis
  gate.
- GitHub Actions CI run `26313942262` passed on `b5c1e02`, including Test,
  Full smoke, and Release readiness check for the GitHub live sync release
  gate.
- GitHub Actions CI run `26309563159` passed on `02b3a13`, including Test,
  Full smoke, and Release readiness check for the hosted baseline preflight
  gate.

Initial cron limitation: that run could not launch the UI on localhost, so it
could not issue a PASS verdict by itself. The controller follow-up and GitHub CI
now prove the fixture UI and release gate can pass, but public release should
still wait for the remaining human-approval, hosted-baseline, and real-canary
gates.

## Sandbox Automation Recheck

Run time: 2026-05-22 18:02:04 EDT.

This follow-up ran from the PR branch worktree
`feat/nucleus-wiki-native-contract` at
`8777290169f598ff9172e889e927858b3956f764`. GitHub connector inspection found
PR #5 open, not draft, mergeable, and with no unresolved inline review threads.
The live PR body still records the conservative public launch verdict and issue
#6 as the blocker trail.

Passed locally in this automation environment:

- `npm run build`
- `npm run test`: 6 files, 22 tests
- `npm run typecheck`
- `npm run privacy:test`
- `npm run smoke:openclaw`: `privacyLeakCount: 0`
- `npm run smoke:hermes`: `privacyLeakCount: 0`
- `npm run compaction:smoke:built`
- `npm run compaction:benchmark:built`: 5 of 5 scenarios passed,
  `privacyLeakCount: 0`, exact identifier accuracy 1
- `npm run compaction:local-audit:built`
- `npm run wiki:smoke:built`
- `npm run wiki:sync:smoke:built`
- `npm run container:audit:smoke:built`
- `npm run update:smoke`
- `npm run baseline:preflight`: no hosted provider call,
  `publicBenchmarkClaimsAllowed: false`
- `npm run baseline:collect -- --fixture`: metrics-only collector output with
  no hosted provider call
- `npm run baseline:export:recallweave -- --fixture`: metrics-only local
  response export with no raw memory text
- `npm run baseline:collect:recallweave -- --fixture`: metrics-only
  RecallWeave collector output with matched query-set and scoring-code hashes
- `npm run baseline:compare -- --fixture`: metrics-only comparison output with
  fixture public claims blocked
- `npm run baseline:operator-packet`: no hosted provider call and public-safe
  hosted baseline handoff output
- `npm run canary:report -- --fixture`
- `npm run canary:report -- --diagnostic-dir
  packages/bench/fixtures/canary-diagnostic-export.fixture`
- `npm run canary:intake`
- `npm run canary:diagnose`
- `npm run goal:audit`: `goalComplete: false`
- `npm run release:handoff`
- `npm_config_cache=/tmp/npm-cache npm pack --dry-run
  ./packages/core`
- `node --check packages/bench/release-readiness-check.mjs`
- `git diff --check`

Cleanup applied in this run:

- `packages/bench/release-readiness-check.mjs` now runs the core package
  `npm pack --dry-run` with an isolated temporary npm cache, avoiding false
  release-gate failures from an unwritable user-level npm cache.

Still blocked in this automation environment:

- `npm run brain:smoke:built` and `npm run brain:interaction:built` fail at
  localhost bind with `listen EPERM: operation not permitted 127.0.0.1`.
- `npm run consumer:smoke` fails because the consumer smoke invokes the same
  Brain UI localhost smoke.
- `npm run release:github-sync` fails because this shell cannot resolve
  `api.github.com`; GitHub connector inspection was used separately for PR #5.
- `npm run release:doctor` fails only through the same GitHub live-sync DNS
  dependency.
- `npm run release:check` remains red in this sandbox for the localhost and
  GitHub DNS failures above, while the package dry-run subcheck now passes.
- `pnpm` is not installed globally, and `npm exec --package pnpm@10.23.0`
  cannot download it because the shell cannot resolve `registry.npmjs.org`.

Controller follow-up after this sandbox recheck passed `release:github-sync`,
`release:doctor`, and `release:check`, and GitHub Actions run `26314102283`
passed on `3578802`. The sandbox failures above remain useful because they show
where constrained shells can still produce false negatives.

These blockers do not justify a public PASS. They reinforce the existing FAIL
verdict until the hosted-baseline run, human approval, and real one-agent
canary are all complete.

## Automation Rerun 2026-05-23T03:13:13Z

Verdict remains: FAIL.

This rerun used a fresh branch from PR #5,
`automation/recallweave-post12h-readiness-rerun-20260523`, at
`c278419cee62520513a66a06e7e0ecaad27096c5`. GitHub connector inspection found
PR #5 open, not draft, and mergeable, with issue #6 open as the blocker trail.
The live PR body and checked-in `release-state.json` both preserve the
conservative state: public launch verdict `FAIL`, `productionReady: false`,
and hosted write-back disabled.

Fresh checks passed in this rerun:

- `npm run build`
- `npm run test`: 6 files, 22 tests
- `npm run typecheck`
- `npm run privacy:test`: 1 file, 5 tests
- `npm run smoke:openclaw`: `privacyLeakCount: 0`
- `npm run smoke:hermes`: `privacyLeakCount: 0`
- `npm run brain:evidence:static`: 9 fixture nodes, 9 edges, required sections
  and controls present, `privacyLeakCount: 0`, `productionReady: false`
- `npm run container:audit:smoke:built`
- `npm run compaction:smoke:built`
- `npm run compaction:benchmark:built`: 5 of 5 scenarios passed,
  `privacyLeakCount: 0`
- `npm run compaction:local-audit:built`
- `npm run wiki:smoke:built`
- `npm run wiki:sync:smoke:built`
- `npm run update:smoke`
- `npm run canary:report -- --fixture`
- `npm run canary:report -- --diagnostic-dir
  packages/bench/fixtures/canary-diagnostic-export.fixture`
- `npm run canary:intake`
- `npm run canary:diagnose`
- `npm run canary:operator-packet`
- `npm run canary:packet`
- `npm run baseline:preflight`
- `npm run baseline:preflight -- --fixture`
- `npm run baseline:collect -- --fixture`
- `npm run baseline:export:recallweave -- --fixture`
- `npm run baseline:collect:recallweave -- --fixture`
- `npm run baseline:compare -- --fixture`
- `npm run baseline:operator-packet`
- `npm run baseline:packet`
- `npm run goal:audit`: `goalComplete: false`,
  `mayCallUpdateGoalComplete: false`
- `npm run release:handoff`
- `git diff --check`
- `npm_config_cache=/tmp/npm-cache npm pack --dry-run` from
  `packages/core`

Fresh checks blocked or failed in this rerun:

- `npm run brain:smoke:built` failed with `listen EPERM: operation not
  permitted 127.0.0.1`.
- `npm run brain:interaction:built` failed with the same localhost bind error.
- `npm run consumer:smoke` failed because it invokes the same Brain UI
  localhost smoke.
- `npm run release:check` failed on fresh Brain UI smoke, Brain UI interaction
  smoke, clean consumer smoke, release doctor, and GitHub live sync. The
  localhost failures are `127.0.0.1` bind restrictions in this sandbox; the
  live-sync failures are shell DNS failures to `api.github.com`.
- `npm run release:github-sync` failed with `getaddrinfo ENOTFOUND
  api.github.com`; GitHub connector evidence was used separately for live PR
  and issue state.
- A local secret-pattern scan found only placeholders or test strings in
  `.env.example`, privacy tests, and docs. No real credential was found in this
  rerun.

Reviewer rerun status:

- `claude --print --model opus ... --setting-sources local` was attempted with
  a sanitized evidence summary and returned `Not logged in`; this route is
  blocked, not approval.
- `gemini --skip-trust --approval-mode plan` was attempted with the same
  sanitized evidence summary and requested browser authentication; it produced
  no usable verdict and is blocked, not approval.
- Existing checked-in reviewer evidence remains relevant but narrow: Claude
  previously returned `CONCERNS` for PR #5 alpha review, while Gemini returned
  `CLEAN` for the fresh-canary-window slice only. Neither approves public
  launch.

Current launch blockers after this rerun:

- Human owner approval is still required before merge or public live update
  copy.
- Hosted Supermemory comparison claims still require a fresh metrics-only
  hosted baseline, matched RecallWeave run, and reviewer approval.
- A real one-agent production canary is still incomplete; fixture canary and
  metrics-only diagnostic tooling do not count as production rollout evidence.
- This sandbox cannot produce fresh localhost Browser/Playwright evidence, so
  the existing sanitized UI screenshots and DOM packet remain historical PR
  evidence rather than a fresh local replay from this environment.

## Automation Recheck 2026-05-23T05:58:49Z

Verdict remains: FAIL.

This recheck used the existing writable PR worktree at
`/tmp/selfmem-agent-memory-publish` on
`automation/recallweave-post12h-readiness-rerun-20260523`. GitHub connector
inspection found PR #5 open, not draft, mergeable, with head
`aedb81ab3a61ec7c70e3ac7cd07e8085637d5ea3`. The connector reported read-only
permissions for this repo, so no new PR branch, issue, or PR comment was
created from this run. PR #5 and blocker issue #6 remain the public trail.

Fresh checks passed in this recheck:

- `npm run build`
- `npm run test`: 6 files, 22 tests
- `npm run typecheck`
- `npm run privacy:test`: 1 file, 5 tests
- `npm run smoke:openclaw`: `privacyLeakCount: 0`
- `npm run smoke:hermes`: `privacyLeakCount: 0`
- `npm run brain:evidence:static`: 9 fixture nodes, 9 edges, required UI
  sections and controls present, `privacyLeakCount: 0`, `productionReady:
  false`
- `npm run compaction:smoke:built`
- `npm run compaction:benchmark:built`: 5 of 5 scenarios passed,
  `privacyLeakCount: 0`, exact identifier accuracy 1
- `npm run compaction:local-audit:built`
- `npm run wiki:smoke:built`
- `npm run wiki:sync:smoke:built`
- `npm run update:smoke`
- `npm run canary:report -- --fixture`
- `npm run canary:report -- --diagnostic-dir
  packages/bench/fixtures/canary-diagnostic-export.fixture`
- `npm run canary:intake`
- `npm run canary:diagnose`
- `npm run canary:operator-packet`
- `npm run canary:packet`
- `npm run canary:packet:review`
- `npm run canary:returned-packet`
- `npm run canary:batch-audit`
- `npm run canary:next-agent`
- `npm run canary:next-agent-packet`
- `npm run baseline:preflight`
- `npm run baseline:preflight -- --fixture`
- `npm run baseline:collect -- --fixture`
- `npm run baseline:export:recallweave -- --fixture`
- `npm run baseline:collect:recallweave -- --fixture`
- `npm run baseline:compare -- --fixture`
- `npm run baseline:operator-packet`
- `npm run baseline:next-run`
- `npm run baseline:packet`
- `npm run goal:audit`
- `npm run release:handoff`
- `npm_config_cache=/tmp/npm-cache npm pack --dry-run ./packages/core`
- `git diff --check`

Fresh checks blocked or failed in this recheck:

- `npm run brain:smoke:built`: failed with `listen EPERM: operation not
  permitted 127.0.0.1`.
- `npm run brain:interaction:built`: failed with the same localhost bind
  restriction.
- `npm run consumer:smoke`: failed because it invokes the same Brain UI
  localhost smoke.
- `npm run release:github-sync`: failed with `getaddrinfo ENOTFOUND
  api.github.com`; GitHub connector inspection supplied live PR state instead.
- `npm run release:doctor`: failed through the same shell DNS dependency.
- `npm run release:check`: failed on the localhost Brain UI routes, consumer
  smoke, release doctor, and GitHub live sync. The release gate still passed
  required file/script checks, static Brain UI evidence, conservative release
  state, local-container audit, canary/report/packet/returned-packet gates,
  hosted-baseline preflight, handoff packet, goal audit, `git diff --check`,
  remote-token check, core package dry-run, forbidden runtime file scan, and
  secret scan.

Reviewer status in this recheck:

- `claude --print --model opus --setting-sources local ...` returned `Not
  logged in`; this route is blocked, not approval.
- Gemini CLI attempted browser authentication and did not return a verdict;
  this route is blocked, not approval.

No evidence from this recheck supports a public live update. The next
production-readiness attempt still needs a localhost-capable environment for
fresh Brain UI replay, shell or CI GitHub live sync, human owner approval,
fresh metrics-only hosted baseline evidence, and one non-fixture real-agent
canary that passes strict intake.

## Readiness Grades

| Area | Grade | Reason |
| --- | --- | --- |
| Security/privacy | PASS WITH CONCERNS | Redaction, secret-pattern, forbidden-file, and privacy smokes are strong, and Claude Opus returned `CONCERNS`; public launch still needs owner approval and real-runtime evidence. |
| Install/update ergonomics | PASS WITH CONCERNS | Updater smoke passes, wrapper is dry-run-first, clean consumer smoke proves updater help, Brain UI checks, local audit, compaction audit, and package dry-run from a temporary public-style checkout, and the release blocker doctor prints the remaining manual actions. A true GitHub install still depends on public visibility and user approval. |
| Local-first memory correctness | PASS WITH CONCERNS | Hermes/OpenClaw smokes and compaction fixtures pass; selected local-container audit and browse previews are read-only and gated, selected local memory edits use append-only overlays, overlay browse makes those edits visible, selected local memory materialize applies safe overlays with duplicate-rerun skipping, backup, and content-free audit, and browser-local history is content-free. |
| LLM-wiki integrity | PASS WITH CONCERNS | Compiler, lint, and sync conflict smoke pass on fixtures; live user vault confirmation flow is still future work. |
| UI usefulness | PASS WITH CONCERNS | Fixture UI evidence exists, the graph now uses a dynamic layout and navigation controls rather than fixed coordinates alone, Compaction Audit shows metrics-only local-session evidence, Benchmark Dashboard shows fixture local-only compaction quality metrics and caveats, Canary Rollout shows the one-agent dry-run/apply/observe/rollback path, Research Source Lock shows methodology sources, Model Matrix shows guarded provider choices and local Apple Silicon defaults, Context Preview shows the prompt recall packet and omitted candidates, Release Readiness shows the current public launch verdict and blockers, selected local-container audit and browse previews, selected local memory edit overlay, local edit overlay browse visibility, selected local memory materialize, selected vault sync dry-run, selected vault sync apply, lifecycle policy preview, selected lifecycle policy apply, memory review queue preview/apply, and history are gated/read-only/content-free, and fresh controller/CI checks pass. |
| Benchmark readiness | PASS WITH CONCERNS | Hosted baseline preflight is now explicit and reviewed, but the live hosted Supermemory baseline and matched RecallWeave run have not been completed on this release branch. |
| Docs clarity | PASS WITH CONCERNS | Docs and evidence are extensive, but the public launch story needs a clean verdict and blocked-route notes. |
| Test coverage | PASS WITH CONCERNS | Core fixture coverage is good; browser/Playwright rerun is blocked in this environment. |
| Rollback safety | PASS WITH CONCERNS | Updater is dry-run-first and uses fixture smoke, but public live update should wait for release-gate pass. |

## Blocking Issue Or PR Follow-Up

Use
`reviews/overnight-20260522/issue-drafts/blocker-fresh-brain-ui-launch-and-release-gate.md`
as a conservative issue draft if the current PR is not immediately updated.
Run `release:handoff` first for the generated manual GitHub packet.
Run `goal:audit` before any claim that the native goal itself is complete.

## Public Live Update Status

Do not publish a public live update from this evidence set. The next public note
can say that PR #5 is a public readiness candidate with fixture Brain UI and
Nucleus/wiki work under review, but it should not call RecallWeave production
ready.

## Demo Plan With Dummy Fixture Data

Use only bundled fixture data:

1. Start the Brain UI from a clean checkout.
2. Search for the native-memory fixture.
3. Open the Nucleus graph/index view and inspect node kinds.
4. Confirm the dynamic graph layout shows the fixture graph without node
   overlaps.
5. Open provenance and retrieval trace panels.
6. Edit the derived native-memory doc, then show save/cancel and draft export.
7. Open the Nucleus snapshot preview and confirm `writesRealFiles: false`.
8. Open the wiki/vault preview and sync report, including the reviewed-page
   conflict note.
9. Open the local audit preflight panel.
10. Open selected vault sync apply and show that it requires explicit write
   confirmation before it can write files.
11. Open the lifecycle policy preview and stage a no-write draft export.
12. In a throwaway fixture only, start with
   `RECALLWEAVE_BRAIN_UI_ENABLE_POLICY_APPLY=1`, open selected lifecycle
   policy apply, and show that it requires explicit write confirmation before
   it can write the local policy file.
13. Open the memory review queue and stage a no-write candidate decision.
14. In a throwaway fixture only, start with
   `RECALLWEAVE_BRAIN_UI_ENABLE_REVIEW_APPLY=1`, open selected review queue
   apply, and show that it requires explicit write confirmation before it can
   write the local decision log.
15. Optional, in a throwaway fixture only: start with
   `RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_AUDIT=1` and
   `RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_BROWSE=1`, run selected local-container
   audit and browse, confirm the visible path is redacted, and confirm local
   edit overlay browse shows only redacted overlay previews.
16. Optional, in a throwaway fixture only: start with
   `RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_MATERIALIZE=1`, run selected local memory
   materialize, and confirm backup plus audit paths are relative and
   content-free.
17. End with the release-readiness gate output and residual alpha caveats.

Do not record real local memories, raw session history, private diagnostics,
credentials, private paths, or real agent logs.
