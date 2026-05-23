# Public Live Update Draft

Status: draft only. Do not publish until the owner approves the release.

## Candidate Update

RecallWeave now has a public-safe preview branch for the local-first agent
memory direction.

The current PR adds:

- a Nucleus Index contract for memories, lifecycle events, retrieval traces,
  wiki pages, research questions, hypotheses, decisions, and evidence;
- an LLM-wiki compiler with Obsidian-style frontmatter, wikilinks, index/log
  pages, provenance, conflict handling for reviewed pages, and optional
  content-free pre-write audit logging;
- a fixture-only Brain UI for graph browsing with dynamic graph layout, graph navigation controls, lifecycle trail, search, provenance, timeline
  review, derived-doc editing, draft export, Nucleus snapshot preview, research
  lineage, Research Source Lock, Compaction Audit, Benchmark Dashboard, Canary Rollout, Context Preview, Release Readiness, vault preview, sync-report
  inspection,
  selected vault sync dry-run, selected vault sync apply, selected
  local-container browse, lifecycle policy preview, selected lifecycle policy apply, memory
  review queue preview, and selected review queue apply, selected local memory
  edit overlay, local edit overlay browse visibility, and selected local memory
  materialize;
- a dry-run-first `selfmem_update` command for agent update workflows, with
  strict-real canary checks blocked unless a live mapped container or explicit
  diagnostic source produces a runtime report;
- a generated GitHub handoff packet for manual GitHub updates while connector
  write routes are blocked;
- a live GitHub sync check that verifies PR #5 and issue #6 still match the
  checked-in release drafts without printing body text or credentials;
- a hosted baseline preflight for future Supermemory comparisons, offline by
  default and blocked from public score claims until a metrics-only live result
  is reviewed;
- a read-only hosted baseline collector that emits aggregate metrics and hashes
  only after explicit live opt-in and local environment credentials;
- a matched baseline comparison gate that blocks public claims unless hosted
  and RecallWeave result files are non-fixture, source-matched, privacy-clean,
  and reviewer-approved;
- a canary evidence intake for sanitized one-agent runtime reports, blocked
  from fleet rollout and public launch when the report is only a fixture;
- a canary report generator that converts Hermes/OpenClaw traces into the
  sanitized report format without raw memory text or local paths;
- a canary diagnosis command that turns failed canary reports into metrics-only
  remediation actions without exposing diagnostic contents;
- a canary operator packet that prints public-safe Hermes/OpenClaw strict-real
  collection commands, attach-only metrics files, pass criteria, and forbidden
  raw artifacts;
- an adapter store-latency gate so Hermes and OpenClaw smokes prove store
  events include positive `elapsed_ms` samples before the next real canary;
- a strict v1 adapter contract marker plus updater digest reporting so stale
  installed adapters are visible before a live canary can count;
- real diagnostic canary evaluation evidence from two redacted external Hermes
  bundles, both privacy-clean and both rejected by strict rollout intake;
- fixture smokes for Hermes, OpenClaw, wiki sync, compaction, update flow, and
  release readiness.
- a metrics-only local-session compaction audit path for private Codex, Claude,
  Hermes, and OpenClaw exports.

Preview surfaces include selected local-container browse, selected vault sync
dry-run, selected vault sync apply, lifecycle policy, lifecycle policy apply,
memory review queue, review queue apply, local memory edit, overlay browse,
materialize, dynamic graph layout, graph navigation, Research Source Lock,
Compaction Audit, Benchmark Dashboard, Canary Rollout, Context Preview, and
Release Readiness.

## Safety Boundary

This branch does not ship credentials, raw memories, raw transcripts, private
diagnostics, hosted Supermemory contents, or private agent logs. The public UI
evidence uses dummy fixture data only.

Hosted Supermemory remains read-through history when configured. RecallWeave
writes locally by default and does not enable hosted write-back.

## Current Verdict

Not production ready yet.

The code and fixture checks pass, and GitHub Actions has passed the release
readiness gate on PR #5. Claude Opus returned `CONCERNS`, which supports alpha
PR review only. Public launch should still wait for human approval,
hosted-baseline evidence, and real canary evidence.

## Try The Fixture Brain

From the repo checkout:

```bash
npm exec --yes pnpm@10.23.0 -- install
npm exec --yes pnpm@10.23.0 -- brain:serve
```

Then open:

```text
http://127.0.0.1:4177
```

Use only the bundled fixture data for screenshots, recordings, demos, and
issues.

## Verification Snapshot

Latest verified head before this draft refresh:

- PR: `https://github.com/radbroradbro/selfmem-agent-memory/pull/5`
- Latest verified code baseline: `7fc3be2`
- GitHub Actions: CI run `26320492619` passed for the RecallWeave response
  export gate
- Generated GitHub handoff packet: `release:handoff` prints the paste-ready PR
  body, status comment, blocker issue, labels, and manual GitHub steps with
  no file writes and no secret-pattern hits
- GitHub live sync: `release:github-sync` confirms PR #5 and issue #6 match
  the checked-in public-safe drafts, with hashes and booleans only
- Goal completion audit: `goal:audit` reports `goalComplete: false`, 20 proven
  requirements, 2 blocked requirements, and 1 incomplete requirement, so this
  remains a public-readiness candidate rather than a completed production goal
- Hosted baseline preflight: `baseline:preflight` passes offline with
  `callsHostedProvider: false`, `metricsOnly: true`, and
  `benchmarkClaimsAllowed: false`
- Hosted baseline collector: `baseline:collect -- --fixture` passes without a
  hosted provider call and proves the collector emits aggregate metrics and
  hashes only
- RecallWeave response exporter: `baseline:export:recallweave -- --fixture`
  passes and proves a local `memories.jsonl` container can produce a
  metrics-only response export without raw memory text
- RecallWeave baseline collector: `baseline:collect:recallweave -- --fixture`
  passes and proves local RecallWeave result files use the same query-set and
  scoring-code hashes while rejecting raw response text in live mode
- Baseline comparison: `baseline:compare -- --fixture` passes without a hosted
  provider call and proves fixture inputs cannot authorize public benchmark
  claims
- Hosted baseline operator packet: `baseline:operator-packet` prints a
  public-safe handoff for aggregate-only hosted Supermemory baseline collection
  and calls no hosted provider
- Canary evidence intake: `canary:intake` passes on the public fixture with
  lifecycle coverage, hybrid search coverage, local writes, read-through mode,
  p50/p95 latency, rollback readiness, zero privacy leaks, and
  `countsAsRealRolloutEvidence: false`
- Strict-real canary intake: failed fixture or weak real reports exit nonzero
  but still print sanitized JSON with failed checks, latency, instrumentation,
  quality, and privacy counters for `canary:diagnose`
- Adapter contract gate: Hermes/OpenClaw smokes pass with strict v1 canary
  markers, canary reports expose the marker, and the updater reports adapter
  source/target digests
- Canary report generator: `canary:report -- --fixture` creates the sanitized
  report shape from trace fixtures and proves fixture-derived reports fail
  `--strict-real`
- Canary diagnostic bundle generator: redacted diagnostic directories and ZIP
  bundles can produce the same sanitized report shape, while relocated fixtures
  still fail `--strict-real`
- Canary diagnosis: `canary:diagnose` turns failed canary reports into
  metrics-only remediation actions and keeps fleet/public rollout blocked
- Adapter store-latency gate: Hermes and OpenClaw standalone smokes now assert
  positive store `elapsed_ms` samples, and `release:check` enforces the result
- Fresh canary window gate: strict-real canary collection now records a
  post-update timestamp and uses `--since`/`--canary-since` so old trace
  history cannot prove or poison patched adapter evidence
- Real diagnostic canary evaluation: two redacted external Hermes bundles were
  converted into temporary metrics-only reports. Both were real inputs,
  privacy-clean, and rejected by strict rollout intake on missing store latency
  and recall p95. They do not count as real rollout evidence
- GitHub Actions CI run `26312283137` passed on `4f5a079`, the canary
  remediation diagnosis gate commit.
- GitHub Actions CI run `26313942262` passed on `b5c1e02`, the GitHub live
  sync release gate commit.
- GitHub Actions CI run `26316074705` passed on `8777290`, the Brain UI
  lifecycle trail and current-head browser evidence refresh.
- GitHub Actions CI run `26316450928` passed on `6a8bbf0`, the lifecycle
  trail evidence refresh.
- GitHub Actions CI run `26316961518` passed on `4b2ec83`, the strict-real
  update guard.
- GitHub Actions CI run `26317344140` passed on `6b77293`, the strict-real
  canary operator packet.
- GitHub Actions CI run `26317637761` passed on `9eeed9e`, the adapter store
  latency trace gate.
- GitHub Actions CI run `26318177698` passed on `2b7fc92`, the fresh canary
  window isolation gate.
- GitHub Actions CI run `26318633036` passed on `39feae5`, the hosted
  baseline operator packet gate.
- GitHub Actions CI run `26318710488` passed on `adfd435`, the hosted
  baseline operator packet evidence refresh.
- GitHub Actions CI run `26320492619` passed on `7fc3be2`, the RecallWeave
  response export gate.
- GitHub Actions CI run `26320054524` passed on `3b1870e`, the RecallWeave
  baseline collector gate after rerun attempt 2.
- GitHub Actions CI run `26319551404` passed on `8520140`, the baseline
  comparison gate.
- GitHub Actions CI run `26319050876` passed on `95f7fea`, the hosted
  baseline collector gate.
- Previous clean consumer smoke head: `4cee083`, CI run `26306827655` passed
- Previous model/autoresearch matrix gate: `13cbe8d`, CI run `26305284384`
  passed
- Release-state guard follow-up: `dd17f44`, CI run `26289073223` passed
- Local release gate: `node packages/bench/release-readiness-check.mjs` passed
  in the controller run
- Model/autoresearch matrix gate: Apple Silicon local default is Qwen3 0.6B
  through Hugging Face/llama.cpp/Metal, Voyage/Gemini/NVIDIA are benchmark
  challengers, query expansion is off by default, and public benchmark claims
  require a matched source-locked canary win with reviewer sign-off
- Brain UI Model Matrix evidence: 6 fixture provider arms, 4 cloud arms, 2
  local arms, Apple Silicon Qwen3 0.6B local default, Voyage/Gemini/NVIDIA
  cloud arms, query expansion off, env-only credentials, 5 gates, 3 blockers,
  zero console errors, and no private/key-shaped visible text
- Clean consumer smoke evidence: a temporary public-style checkout ran updater
  help, update smoke, Brain UI smoke, Brain UI interaction smoke, local audit,
  compaction audit, and npm package dry-run, then verified required
  docs/package files, zero forbidden runtime files, and zero key-shaped hits
- Dynamic graph layout evidence: 9 fixture nodes, 9 fixture edges, 2 columns,
  5 rows, zero overlaps, zero console errors, and no private/key-shaped visible
  text
- Graph navigation evidence: neighborhood scope, 3 visible fixture nodes, 9
  jump options, selected-node visibility, zero console errors, and no
  private/key-shaped visible text
- Compaction Audit evidence: metrics-only fixture output, 6 input events, 4
  candidate fingerprints, chronological output, zero privacy leaks, zero
  console errors, and no raw candidate text
- Benchmark Dashboard evidence: fixture local-only compaction benchmark
  summary with 5 of 5 scenarios passed, 0 failed scenarios, 0 privacy leaks,
  exact-identifier accuracy 1, average noise reduction 0.307,
  hosted-baseline caveat, no-raw-text caveat, zero console errors, and no
  private/key-shaped visible text. This is not a public benchmark score; public
  score claims require a matched source-locked canary win with the same judge,
  settings, scoring code, privacy scan, and reviewer sign-off
- Canary Rollout evidence: fixture one-agent rollout dashboard with dry-run,
  apply, observe, and rollback steps, 11 metrics to collect, public launch
  still `FAIL`, owner approval required, zero console errors, and no
  private/key-shaped visible text
- Research Source Lock evidence: 11 public sources, 8 implementation rules,
  topic/subtopic paths, stale-memory supersession, budgeted lifecycle
  frequency, dashboard-to-cluster zoom, collapsed technical export, zero
  console errors, and no private/key-shaped visible text
- Context Preview evidence: fixture recall packet with selected memories,
  omitted candidates, token budget, read-only hosted mode, local-only writes,
  zero privacy leaks, zero console errors, and no private/key-shaped visible
  text
- Release Readiness evidence: public launch verdict `FAIL`,
  `productionReady: false`, blocker list, manual actions, hosted write-back
  disabled, zero privacy leaks, zero console errors, and no private/key-shaped
  visible text
- Release blocker doctor evidence: machine-readable blocker check with
  conservative release-state assertions, GitHub/Claude blocked-route evidence,
  token-free remote verification, and manual next actions. It keeps public
  launch blocked. GitHub Actions CI run `26307335652` passed on `d93d781`.
- Current-head live browser evidence: fresh rendered Brain UI screenshot on
  `8777290` with Nucleus, wiki/vault sync, Model Matrix, Context Preview,
  Release Readiness, Compaction Audit, Benchmark Dashboard, Canary Rollout,
  Research Source Lock, Lifecycle Trail, lifecycle event cards, retrieval trace
  cards, and `on_pre_compress` fixture text visible; zero console errors or
  warnings; zero private/key-shaped visible text hits.
- Reviewer state: Gemini focused slice reviews passed; Claude Opus returned
  `CONCERNS`
- Completion audit: not complete, with public launch still blocked on human
  approval, hosted baseline, and real canary evidence

## Known Gaps

- The Brain UI is still fixture mode.
- Direct local memory materialization is guarded by an environment flag, exact
  phrase, backup, and content-free audit log; selected local memory edits still
  start as append-only overlays before they are materialized.
- The benchmark evidence is fixture-focused. Hosted Supermemory comparison
  claims require a fresh, valid, metrics-only baseline accepted by the hosted
  baseline preflight and reviewed against a matched RecallWeave run.
- The public release should stay conservative until the owner approves it.
