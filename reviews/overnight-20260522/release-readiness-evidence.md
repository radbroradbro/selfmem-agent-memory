# Release Readiness Evidence

Date: 2026-05-22

Scope:

- Added a repeatable `pnpm release:check` gate.
- Added CI coverage for full smoke and release readiness.
- Updated the PR template so future live-build changes include full smoke,
  release readiness, and UI evidence when relevant.
- Made the review evidence directory dynamic, with `RECALLWEAVE_REVIEW_DIR`
  available for pinned review packets.
- Added Brain UI interaction smoke coverage to the release gate so derived
  model behavior is tested directly, not only through static DOM evidence.
- Added Brain UI Container Health evidence to the release gate so the UI must
  prove fixture-safe local container, hosted read-through, provider mode,
  local-only write mode, leak count, redaction count, and retrieval trace
  visibility.
- Added local-container audit smoke coverage to the release gate so future live
  container work has a read-only preflight that returns counts and health
  reasons without exposing raw contents or root paths.
- Added Brain UI Local Audit Preflight evidence to the release gate so the UI
  must prove it can render audit counts and reasons without exposing raw memory
  content or temporary root paths.
- Added Brain UI selected local-container audit evidence to the release gate so
  a real-path preview remains disabled by default, requires read-only
  confirmation, clears the typed path, and displays only a redacted
  `.../container` label.
- Added Brain UI selected local-container browse evidence to the release gate
  so a real-path browse preview remains disabled by default, requires read-only
  confirmation, clears the typed path, returns bounded redacted snippets, skips
  fully private entries, and writes no files.
- Added Gemini review for selected local-container browse and made that review
  packet a required release-readiness artifact.
- Added Brain UI selected local memory edit overlay coverage so selected memory
  edits remain disabled by default, require
  `RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_EDIT`, require the exact
  `APPLY LOCAL MEMORY EDIT` phrase, reject private/key-shaped edit payloads,
  write append-only local edit overlays plus content-free audit logs, do not
  mutate `memories.jsonl` in place, and return only redacted root labels plus
  relative paths and counts.
- Added Gemini review for selected local memory edit and made that review
  packet a required release-readiness artifact.
- Added Brain UI local edit overlay browse coverage so selected local-container
  browse can show matching append-only edit overlays with redacted previews
  while keeping browse read-only and source memory files unchanged.
- Added Gemini review for local edit overlay browse and made that review packet
  a required release-readiness artifact.
- Added Brain UI selected local memory materialize coverage so safe overlays
  can be written into `memories.jsonl` only after an environment gate, exact
  phrase, backup, and content-free audit log.
- Added Gemini review for local memory materialize and made that review packet
  a required release-readiness artifact.
- Added Brain UI selected audit history evidence to the release gate so
  browser-local history is content-free, bounded, and does not expose raw local
  paths or private/key-shaped text.
- Added Brain UI selected vault sync dry-run evidence to the release gate so
  real-path sync previews remain disabled by default, require read-only
  confirmation, clear the typed path, show only a redacted root label, and
  write no wiki files.
- Added Brain UI selected vault sync apply coverage so real-path sync applies
  remain disabled by default, require `RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_APPLY`,
  require the exact `APPLY LOCAL WIKI SYNC` phrase, write content-free audit-log
  entries, and return only redacted root labels plus relative actions and
  counts.
- Added Brain UI lifecycle policy evidence to the release gate so policy
  changes are staged as fixture-only `writesRealFiles: false` draft exports.
- Added Brain UI lifecycle policy apply coverage so selected local policy
  applies remain disabled by default, require
  `RECALLWEAVE_BRAIN_UI_ENABLE_POLICY_APPLY`, require the exact
  `APPLY LOCAL LIFECYCLE POLICY` phrase, reject private/key-shaped policy
  payloads, write only a selected local policy file plus content-free audit log,
  and return only redacted root labels plus relative paths and counts.
- Added Brain UI memory review queue evidence to the release gate so noisy,
  duplicate, and high-value candidate decisions are staged as fixture-only
  `writesRealFiles: false` draft exports.
- Added Brain UI memory review queue apply coverage so selected local review
  applies remain disabled by default, require
  `RECALLWEAVE_BRAIN_UI_ENABLE_REVIEW_APPLY`, require the exact
  `APPLY LOCAL REVIEW QUEUE` phrase, reject private/key-shaped review payloads,
  write only selected local decision metadata plus a content-free audit log,
  and return only redacted root labels plus relative paths and counts.
- Added `release-state.json` to the release gate so the current packet must
  explicitly remain conservative: active goal, `FAIL` launch verdict, green
  verified code baseline, fixture-only safety boundary, unresolved blockers,
  and a guard note that later docs/gate commits still need CI but do not create
  a new runtime evidence claim.
- Added Gemini review for the release-state guard and made that review packet a
  required release-readiness artifact.
- Added Codex Browser DOM evidence to the release gate. This pass
  loaded browser evidence baseline `96ae9cc` in the in-app browser and verifies the main Brain UI
  surfaces without private or key-shaped visible text. Screenshot capture timed
  out and is recorded as such.
- Added dynamic Brain UI graph layout evidence to the release gate. The graph
  now derives positions from visible Nucleus nodes and edges, grows vertically,
  scrolls when needed, and the fixture evidence must report zero node overlaps,
  zero console errors, and no private/key-shaped visible text.
- Added Brain UI graph navigation evidence to the release gate. The UI now
  exposes all-vs-neighborhood scope, jump-to-node, and selected-node centering,
  and the fixture evidence must report selected-node visibility, active
  neighborhood scope, zero console errors, and no private/key-shaped visible
  text.
- Added Brain UI Compaction Audit evidence to the release gate. The UI now
  exposes metrics-only local-session audit output, candidate fingerprints,
  chronology, exact-identifier preservation, and privacy status without raw
  session text or candidate memory text.
- Added Brain UI Benchmark Dashboard evidence to the release gate. The UI now
  exposes fixture local-only compaction benchmark status, scenario pass/fail
  counts, exact-identifier accuracy, noise reduction, and caveats without raw
  session text or candidate memory text.
- Added Brain UI Canary Rollout evidence to the release gate. The UI now
  exposes the one-agent canary path, dry-run/apply/observe/rollback steps,
  metrics to collect, blockers, and caveats without touching real agent state
  or local paths.
- Added Brain UI Research Source Lock evidence to the release gate. The UI now
  exposes public source cards, implementation rules, topic/subtopic path
  direction, stale-memory supersession, budgeted lifecycle frequency,
  dashboard-to-cluster zoom, benchmark targets, and caveats without touching
  private research notes or local memory.
- Added Gemini review for the browser evidence gate and made that review packet
  a required release-readiness artifact.
- Added a machine-readable goal completion audit to the release gate. The audit
  maps the full active objective to current evidence and must keep
  `goalComplete: false` while reviewer, human approval,
  hosted-baseline, or real-rollout blockers remain unresolved.
- Added hosted baseline preflight evidence to the release gate. The preflight
  checks the future hosted Supermemory comparison contract, calls no hosted
  provider by default, keeps `benchmarkClaimsAllowed: false`, and requires
  metrics-only no-raw-text output before any comparison result can be reviewed.
- Added canary evidence intake to the release gate. The intake accepts
  sanitized one-agent runtime canary reports, rejects raw memories,
  transcripts, prompts, answers, secrets, and local paths, and keeps fixture
  reports from counting as real rollout evidence.
- Added canary report generator coverage to the release gate. The generator
  converts Hermes/OpenClaw traces into sanitized runtime canary reports, emits
  no raw local paths or memory text, writes output only when requested, and
  proves fixture-derived reports fail strict-real intake.
- Extended canary report generator coverage to redacted diagnostic directories
  and ZIP bundles. The gate now checks metadata-only diagnostic exports,
  relocated fixture ZIPs, strict-real fixture rejection, zip path safety, and
  no raw private logs, local paths, secrets, prompts, answers, or memory text.
- Added canary remediation coverage to the release gate. The diagnosis command
  turns failed canary reports into metrics-only action plans, verifies a failing
  fixture with `recall-p95` and `store-p95`, verifies a passing fixture, and
  keeps fleet and public rollout disabled.
- Added canary evidence packet coverage to the release gate. The packet command
  writes one metrics-only zip from report, intake, and optional diagnosis files,
  rejects raw-content keys, secrets, and private paths, and keeps fixture or
  failing packets from authorizing rollout.
- Added canary evidence packet review coverage to the release gate. The review
  command opens a received packet zip, validates expected entries and manifest
  consistency, rejects raw-content keys, secrets, and private paths, and fails
  closed under `--strict-real` unless the packet contains passing non-fixture
  strict-real intake evidence.
- Added canary diagnostic batch audit coverage to the release gate. The batch
  command audits a folder of redacted diagnostic bundles through report,
  strict intake, and diagnosis, ranks the closest candidate, and keeps
  production rollout blocked unless a non-fixture bundle passes strict-real
  evidence.
- Added canary next-agent planner coverage to the release gate. The planner
  converts batch findings into a single one-agent update and fresh-window plan,
  keeps fixture evidence from enabling a real canary, and keeps public and
  fleet rollout blocked.
- Added current canary handoff packet identity coverage to the release gate.
  The gate derives the current packet label and SHA256 from the current
  returned-diagnostics section, then requires the next-agent plan evidence,
  real diagnostic evidence, PR body draft, and blocker issue draft to match it.
- Added an opt-in post-baseline public evidence guard to the release gate. When
  `releaseStateGuard.enforcePostBaselinePublicEvidenceOnly` is enabled, the
  gate diffs the latest verified code baseline against `HEAD` and fails if any
  post-baseline change is outside public docs or review evidence. CI now uses a
  full checkout so the guard can inspect the baseline commit.
- Added baseline evidence packet coverage to the release gate. The packet
  command writes one metrics-only zip from hosted result, RecallWeave result,
  comparison, and preflight files, rejects raw-content keys, secrets, and
  private paths, and keeps fixture packets from authorizing public benchmark
  claims.
- Added GitHub live sync coverage to the release gate. The checker calls the
  GitHub API in read-only mode, verifies PR #5 and issue #6 match the
  checked-in drafts, and prints hashes and booleans instead of body text,
  credentials, private paths, memories, transcripts, or diagnostics.
- Reduced aggregate smoke churn by using one build before built-artifact smoke
  commands.
- Added public LongMemEval materialize-run coverage to the release gate. The
  materializer consumes the run-only target, confirms the public dataset and
  selected-id hashes, writes raw query and haystack inputs only outside the
  repository, and commits only counts, hashes, command templates, and the
  collector-compatible query-set hash used to bind the scored run.
- Added the first public LongMemEval RecallWeave retrieval-proxy result to the
  gate. The canonical checked-in result now uses `bm25-lite-b800-k5`, requires
  zero privacy failures, requires explicit retrieval-proxy/no-public-claims
  flags, and explicitly blocks MemoryBench quality-win language.
- Added public LongMemEval retrieval strategy comparison to the release gate.
  The same materialized slice now compares `jaccard`, `bm25-lite`, and
  `hybrid-v1`; `bm25-lite` wins the retrieval-proxy canary and the gate keeps
  the canonical result and comparison bound to retrieval-proxy,
  no-public-claims wording.
- Added public LongMemEval autoresearch-loop coverage to the release gate. The
  loop runs 24 same-data retrieval-proxy arms over strategy, context budget,
  and candidate limit; the current winner is `bm25-lite-b800-k5`, which keeps
  quality 0.4541 while cutting average context tokens to 800. The checked-in
  retrieval-proxy run now uses that setting.
- GitHub Actions run `26347754208` passed on commit
  `d91b27bcc869656197c1cc67804530b75757bbe2` after the strategy-comparison
  lane was added.
- GitHub Actions run `26348625868` passed on commit
  `9a95d08e86c0b212620ea8b3d2182b454e0b90af` after the canonical
  LongMemEval-S retrieval-proxy run was promoted to `bm25-lite-b800-k5`.
- GitHub Actions run `26349083689` passed on commit
  `e7fa56a13bb761c916e15388af50351ba380323e` after the public hybrid gate
  compared BM25 against local-only dense, sparse+dense, temporal, graph,
  rerank, and query-expansion proxy arms.
- Kept the gate public-safe and evidence-based.

What `release:check` verifies:

- required docs and review evidence files exist and are non-empty,
- the release readiness evidence file itself exists,
- package scripts for build, tests, smokes, and release check exist,
- local-session compaction audit scripts and evidence exist,
- Brain UI vault preview DOM evidence is sane,
- Brain UI Container Health DOM evidence is sane,
- Brain UI Local Audit Preflight DOM evidence is sane,
- Brain UI selected local-container audit DOM evidence is sane,
- Brain UI selected local-container browse evidence exists and is covered by
  fresh interaction smoke,
- Brain UI selected local memory edit evidence exists and is covered by fresh
  interaction smoke and Browser DOM evidence,
- Brain UI local edit overlay browse evidence exists and is covered by fresh
  interaction smoke and Browser DOM evidence,
- Brain UI selected local memory materialize evidence exists and is covered by
  fresh interaction smoke, local-container audit smoke, and Browser DOM
  evidence,
- Brain UI selected audit history DOM evidence is sane,
- Brain UI selected vault sync dry-run DOM evidence is sane,
- Brain UI selected vault sync apply controls are present in Browser DOM
  evidence,
- Brain UI lifecycle policy DOM evidence is sane,
- Brain UI selected lifecycle policy apply evidence exists and is covered by a
  fresh interaction smoke,
- Brain UI memory review queue DOM evidence is sane,
- Brain UI selected memory review queue apply evidence exists and is covered by
  a fresh interaction smoke,
- Brain UI dynamic graph layout evidence exists and reports the
  `dynamic-graph-layout` mode with zero overlaps,
- Brain UI graph navigation controls evidence exists and reports neighborhood
  scope, jump options, selected-node visibility, and public-safe text,
- Brain UI Compaction Audit evidence exists and reports metrics-only mode,
  chronological output, candidate fingerprints, exact-identifier coverage, zero
  privacy leaks, zero console errors, and no raw candidate text,
- Brain UI Benchmark Dashboard evidence exists and reports fixture local-only
  compaction benchmark mode, 5 passed scenarios, 0 failed scenarios, zero
  privacy leaks, exact-identifier accuracy 1, average noise reduction at least
  0.2, hosted-baseline caveat, no-raw-text caveat, zero console errors, and no
  private/key-shaped visible text,
- Brain UI Canary Rollout evidence exists and reports fixture one-agent canary
  mode, `READY_FOR_ONE_AGENT_CANARY`, hosted Supermemory read-through-only
  mode, public launch verdict `FAIL`, owner approval required, zero privacy
  leaks, dry-run and rollback steps, p95 latency and privacy metrics, human
  approval blocker, zero console errors, and no private/key-shaped visible
  text,
- Brain UI Research Source Lock evidence exists and reports fixture source-lock
  mode, 11 public sources, 10 source-locked sources, 8 implementation rules,
  topic/subtopic path, stale-memory supersession, budgeted lifecycle frequency,
  dashboard-to-cluster zoom, collapsed technical export, zero console errors,
  and no private/key-shaped visible text,
- Brain UI Context Preview evidence exists and reports selected memories,
  omitted candidates, token budget, read-only hosted mode, local-only writes,
  zero privacy leaks, zero console errors, and no private/key-shaped visible
  text,
- Brain UI Release Readiness evidence exists and reports public launch verdict
  `FAIL`, `productionReady: false`, blocker count, manual actions, fixture-only
  evidence, hosted write-back disabled, zero privacy leaks, zero console
  errors, and no private/key-shaped visible text,
- Hosted baseline preflight evidence exists and a fresh preflight reports
  `callsHostedProvider: false`, `metricsOnly: true`,
  `hostedBaselineFresh: false`, and `publicBenchmarkClaimsAllowed: false`,
- Canary evidence intake exists and a fresh intake pass reports metrics-only
  lifecycle coverage, hybrid search coverage, local writes, read-through mode,
  p50/p95 latency, rollback readiness, zero privacy leaks, and
  `countsAsRealRolloutEvidence: false`,
- Canary diagnostic batch audit exists and a fresh fixture batch reports one
  parsed diagnostic input, zero privacy leaks, lifecycle coverage, hybrid search
  coverage, positive store latency samples, and fails closed when
  `--require-real-pass` is used on fixture evidence,
- Canary next-agent plan exists and a fresh fixture plan emits placeholder
  update commands, fresh-window strict-real intake, metrics-only packet steps,
  and `oneAgentCanaryAllowed: false`,
- Canary report generator exists and a fresh fixture pass reports hashed
  labels, lifecycle counts, hybrid-search coverage, p50/p95 recall and store
  latency, privacy counters, rollback readiness, and strict-real fixture
  rejection,
- Codex Browser DOM evidence is sane,
- release-state manifest is conservative and lists required blockers,
- release docs mention current preview surfaces,
- a fresh local-container audit smoke passes against current source,
- a fresh Brain UI smoke passes against the current source,
- a fresh Brain UI interaction smoke passes against the current source,
- `git diff --check` passes,
- remote URL has no embedded token,
- `npm pack --dry-run` passes for `packages/core`,
- forbidden runtime files are absent, including common local auth/config/log
  artifacts,
- secret-pattern scan has zero hits across the public tree.

Boundary:

- The gate does not read real agent homes, raw memory logs, databases, or
  private diagnostics.
- It uses URL-to-path conversion so the checker can run from repos whose parent
  path contains spaces.
- It checks the latest review directory by default and can be pinned with
  `RECALLWEAVE_REVIEW_DIR`.
- It does not replace `pnpm smoke`; release review should run both.

Verification:

- `pnpm release:check`: passed.
- GitHub Actions CI run `26309563159` passed on `02b3a13`, including Test,
  Full smoke, and Release readiness check.
- GitHub Actions CI run `26310773948` passed on `6ae4ce7`, including Test,
  Full smoke, and Release readiness check after the canary report generator
  gate was added.
- GitHub Actions CI run `26311728246` passed on `77b3cee`, including Test,
  Full smoke, and Release readiness check after the diagnostic bundle canary
  report gate was added.
- GitHub Actions CI run `26312283137` passed on `4f5a079`, including Test,
  Full smoke, and Release readiness check after the canary remediation
  diagnosis gate was added.
- `pnpm smoke`: passed.
- `pnpm test`: 22 tests passed.
- `pnpm container:audit:smoke`: passed.
- `git diff --check`: covered by `release:check`.
- Fresh Brain UI smoke: covered by `release:check`.
- Fresh Brain UI interaction smoke: covered by `release:check`.
- Fresh dynamic graph layout smoke: covered by `release:check`.
- Fresh graph navigation controls smoke: covered by `release:check`.
- Fresh Brain UI Compaction Audit smoke: covered by `release:check`.
- Fresh Brain UI Benchmark Dashboard smoke: covered by `release:check`.
- Fresh Brain UI Canary Rollout smoke: covered by `release:check`.
- Fresh Brain UI Context Preview smoke: covered by `release:check`.
- Fresh Brain UI Release Readiness smoke: covered by `release:check`.
- Fresh local-session compaction audit: covered by `release:check`.
- Core package dry-run: covered by `release:check`.
- Broadened secret-pattern scan: covered by `release:check`.
- Broadened forbidden runtime file scan: covered by `release:check`.
- Remote URL token check: covered by `release:check`.
- GitHub Actions CI run `26299756374` passed on `fb466db` after the Brain UI
  Compaction Audit slice.

Cold review response:

- First Gemini pass returned concerns about stale evidence, narrow secret
  scanning, runtime artifact gaps, and indirect UI privacy evidence.
- Second Gemini pass returned concerns about hardcoded review paths, redundant
  CI build/smoke cycles, and package dry-run visibility.
- Changes after review: dynamic review directory resolution, broader secret and
  forbidden-artifact patterns, fresh Brain UI smoke inside `release:check`, and
  aggregate smoke scripts that build once.
- Changes after final review: CI now runs `pnpm test`, `pnpm smoke`, and
  `pnpm release:check` instead of repeating build/typecheck/adapter smoke as
  separate steps; the public scanner includes shell, example, SQL, and TOML
  files; the PR checklist no longer asks for core package dry-run separately
  because release readiness already covers it.
- Post-push CI check passed. An attempted move to `actions/checkout@v5` and
  `actions/setup-node@v5` failed because the runner could not locate `pnpm`.
  The workflow returned to the known-good v4 actions plus Corepack path and
  keeps `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` as the interim warning
  mitigation.
- Accepted residual note: `release:check` records every check result before
  exiting, so the core package dry-run is still reported even if another check
  fails.
- Accepted residual note: recorded DOM screenshots remain evidence artifacts,
  while `release:check` performs a fresh Brain UI smoke against current source
  to catch obvious runtime drift.
- Interaction smoke now covers search filtering, retrieval trace visibility,
  private/key-shaped edit rejection, draft export, Nucleus export, research
  lineage, lifecycle policy draft export, memory review queue draft export,
  vault path selection, selected local-container browse, write-confirmed
  selected local memory edit, private/key-shaped local edit rejection, selected
  local memory materialize, selected vault sync dry-run, write-confirmed selected vault sync apply,
  write-confirmed selected lifecycle policy apply, private/key-shaped policy
  rejection, dry-run sync reporting, write-confirmed selected review queue
  apply, private/key-shaped review rejection, dynamic graph layout spacing, graph navigation controls, Compaction Audit metrics-only rendering, Context Preview rendering, Release Readiness rendering, audit-log write intent coverage,
  Benchmark Dashboard rendering, Canary Rollout rendering, Research Source
  Lock rendering, and public-safe serialization.

Known limits:

- Private-name scans remain an operator-side release step because putting
  private names in public source would itself leak them.
- GitHub Actions CI run `26288370812` passed on inspected baseline `2888f91`.
  Reinspect Actions after any later branch push.
- GitHub Actions CI run `26289073223` passed on release-state guard commit
  `dd17f44` after the Gemini guard review became required.
- GitHub Actions CI run `26290534116` passed on guarded selected vault sync
  apply commit `103e7c6`.
- GitHub Actions CI run `26291352800` passed on guarded selected
  local-container browse commit `04f1096`.
- GitHub Actions CI run `26292137539` passed on guarded selected lifecycle
  policy apply commit `3b5e140`.
- GitHub Actions CI run `26292772262` passed on guarded selected review queue
  apply commit `19f2577`.
- GitHub Actions CI run `26293533847` passed on guarded selected local memory
  edit overlay commit `72ab902`.
- GitHub Actions CI run `26294323086` passed on guarded local edit overlay
  browse commit `b5352a0`.
- GitHub Actions CI run `26295772356` passed on guarded local memory
  materialize commit `21fd4d6`.
- GitHub Actions CI run `26297064340` passed on dynamic graph layout commit
  `be47cff`.
- GitHub Actions CI run `26297876735` passed on graph navigation controls
  commit `62367a1`.
- Release handoff follow-up: `docs/RELEASE_HANDOFF.md` now gives the manual PR
  body update, blocker issue, Claude concerns, public visibility, and
  one-agent canary steps. `release:check` requires the handoff and verifies the
  blocked launch path language.
- GitHub Actions CI run `26298339106` passed on release handoff gate commit
  `aebd205`.
- Local-session compaction audit follow-up: `release:check` now requires the
  local audit evidence file, release-state surface, and a fresh metrics-only
  audit run; the public secret scan includes `.jsonl` files.
- GitHub Actions CI run `26298965544` passed on metrics-only local session
  compaction audit commit `be08302`.
- GitHub Actions CI run `26299756374` passed on Brain UI Compaction Audit
  commit `fb466db`.
- GitHub Actions CI run `26302442423` passed on Brain UI Benchmark Dashboard
  commit `d0113c0`, including Test, Full smoke, and Release readiness check.
- GitHub Actions CI run `26302990767` passed on Brain UI Canary Rollout commit
  `f51346f`, including Test, Full smoke, and Release readiness check.
- GitHub Actions CI run `26304465466` passed on Brain UI Research Source Lock
  commit `e043d6b`, including Test, Full smoke, and Release readiness check.
- GitHub Actions CI run `26300784883` passed on Brain UI Context Preview
  commit `0ec4396`.
- GitHub Actions CI run `26301888111` passed on Brain UI Release Readiness
  commit `8c26de7`, including Test, Full smoke, and Release readiness check.
- GitHub Actions CI run `26313942262` passed on GitHub live sync gate commit
  `b5c1e02`, including Test, Full smoke, and Release readiness check.
