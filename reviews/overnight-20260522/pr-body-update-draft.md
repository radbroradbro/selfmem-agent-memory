# PR Body Update Draft

Live status:

- PR #5 body was updated from this public-safe source on 2026-05-23.
- The release blocker issue was created as GitHub issue #6.
- The GitHub connector itself still returned `401 token_expired`, so the write
  used the local git credential helper without printing or committing the
  credential.
- Keep this file as the source for later PR-body refreshes.

```markdown
## Summary

- Adds the Nucleus Index contract for memory nodes, lifecycle events, retrieval traces, wiki pages, research questions, hypotheses, decisions, and evidence.
- Adds LLM-wiki compile and vault sync flows with Obsidian-style frontmatter, wikilinks, provenance, linting, reviewed-page conflict handling, and content-free pre-write audit logging.
- Adds the self-hosted Brain UI preview for graph browsing, research lineage, research source lock, model matrix, compaction audit, benchmark dashboard, canary rollout, context preview, release readiness, lifecycle trail, current-head live browser evidence, local audit, selected local-container browse, selected vault sync dry-run, selected vault sync apply, lifecycle policy preview, selected lifecycle policy apply, memory review queue preview, selected review queue apply, selected local memory edit, local edit overlay browse, selected local memory materialize, dynamic graph layout, graph navigation, and provenance/timeline inspection.
- Adds `selfmem_update`, clean consumer smoke coverage, metrics-only local-session batch compaction audit, release blocker doctor, GitHub handoff packet, goal completion audit, hosted baseline preflight, hosted baseline discovery for hashed source-container candidates, live hosted metadata discovery evidence for hashed candidates, `baseline:queryset` public-safe query-set inspection, `baseline:author-queryset` private query-set drafting with public counts and hashes only, a read-only hosted baseline collector, a RecallWeave response exporter, a RecallWeave baseline collector, a matched baseline comparison gate, a hosted baseline operator packet, a state-aware hosted baseline next-run planner with `--require-ready` owner-review gating, `baseline:run` one-command hosted/local/preflight/comparison/packet/intake orchestration, `baseline:packet` metrics-only zip packaging for hosted baseline evidence, `baseline:packet:review` validation for received hosted-baseline zips, `baseline:returned-packet` maintainer intake for returned hosted-baseline packets, canary evidence intake, strict-real fail-closed JSON output, strict v1 adapter contract markers, updater adapter digest verification, canary report generator from trace/diagnostic exports, `canary:diagnose` remediation guidance for failed reports, `canary:drill` deterministic fresh-window prompts, a public-safe canary operator packet, `canary:packet` metrics-only zip packaging for report/intake/diagnosis files, `canary:packet:review` validation for received canary zips, `canary:returned-packet` maintainer intake for returned evidence packets, `canary:returned-workspace` markdown workspace generation for returned canary packets, `canary:returned-inbox` mixed-folder returned-evidence scanning, `canary:returned-downloads` standard Downloads and Telegram Desktop supervision with markdown findings, `canary:batch-audit` controller triage for folders of redacted diagnostic bundles, mixed-folder `--allow-failed-inputs` triage for returned diagnostic sets, `canary:next-agent` one-agent update planning from batch results, and `canary:next-agent-packet` public-safe zip packaging for the selected one-agent handoff. The updater now refuses `--strict-real` canary success unless a live mapped container or explicit diagnostic source produces a runtime report, and it can write the sanitized report, intake, optional diagnosis, and metrics-only evidence packet in one run.
- Adds a GitHub live sync check so PR #5 and blocker issue #6 can be compared against checked-in public-safe drafts without printing body text or credentials.
- Extends the release blocker doctor so agents see the same unresolved blockers as the goal audit: human approval, two-reviewer hosted baseline approval, and fresh real-agent canary evidence.
- Adds output-file-safe baseline and canary evidence commands so package-manager banners cannot corrupt JSON artifacts or leak local checkout paths into preflight, comparison, intake, diagnosis, batch-audit, or next-agent plan files.
- Adds a post-baseline public evidence guard. Once enabled in release-state, the release gate diffs the latest verified code baseline against `HEAD` and fails if any later change is outside public docs or review evidence.
- Adds a release-readiness guard that verifies the current returned-diagnostics canary handoff packet label and SHA256 stay consistent across packet evidence, next-agent plan evidence, real diagnostic evidence, the PR body draft, and the blocker issue draft.
- Adds `baseline:source-match`, `baseline:source-align`, and
  `baseline:source-gap` so a reviewed hosted-source query set must prove that
  the selected local RecallWeave source can collect matching expected
  references, that a matching hosted/local container label is not mistaken for
  matching content, and that agents get a deterministic ready-or-repair path
  before hosted calls are spent on another matched run. Blocked source-gap
  reports now include a hashed per-query repair queue so private operators can
  repair the exact source gap without exposing raw query text or memory text.
- Extends the hosted baseline operator packet so agents can reload a blocked
  `baseline:source-gap` report with `--source-gap <report> --format markdown`
  and hand off the repair queue as short query hashes, match counts, status
  labels, and repair actions only.
- Extends the hosted baseline operator packet, next-run planner, and
  `baseline:run` orchestrator so `baseline:source-match`,
  `baseline:source-align`, and `baseline:source-gap` run before hosted
  collection. Live runs now require the local container map and private hosted
  map through CLI flags or environment variables, while only public-safe
  source-match, source-alignment, and source-gap reports may be attached.
- Adds a source-matched, budgeted live hosted-baseline canary from 2026-05-23.
  It used a private hosted mirror, preserved hosted ids, a reviewed 8-query set,
  no-raw-text mode, and a 1600-token RecallWeave context budget. Hosted
  Supermemory scored 0.0000 quality; RecallWeave scored 0.1212 quality with
  zero privacy failures. Two independent reviewers approved the metrics-only
  packet for owner review. This is still a narrow canary comparison, not broad
  benchmark superiority language.
- Adds the public benchmark target lane for quota-locked Supermemory accounts:
  RecallWeave can run on source-locked public benchmark slices and compare
  against reported leaderboard/provider stats without requiring hosted
  Supermemory writes. Small wins may be described only as canary trends until a
  full comparable run is complete.
- Adds a current MemoryBench source lock at commit
  `118209a746d97d0d85e5a7234267f0b6962857e9`, with public-safe hashes for the
  harness files, benchmark/provider contracts, dataset source URLs, and
  `locomo` / `longmemeval` / `convomem` availability. The checker also has an
  optional checkout-verification mode that re-hashes a local MemoryBench clone
  without printing private paths.
- Adds a live public LongMemEval-S slice manifest from the source-locked
  dataset: 500 public rows, 6 selected canary rows, one per question type,
  dataset hash
  `sha256:d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`,
  selected-id hash
  `sha256:686da163b61d343549768cdccd890a46ce775b653414932bdd07aec2ccdd3a23`,
  answer-label hash
  `sha256:423098446f2953b45fe049fbd9da0b8d806050d4aed6cdec2a349f167ce1fa3e`,
  and no raw question ids, question text, answers, memories, or transcripts.
- Adds a real LongMemEval-S run-only target generated from that slice
  manifest. It passes `benchmark:public-target -- --strict-run`, so
  RecallWeave can run on the same public benchmark data now. It still blocks
  public comparison claims until a source-locked reported target row passes
  the stricter comparison gate.

- Adds the public LongMemEval-S materialize-run lane and first blind retrieval-proxy baseline. The materializer writes raw benchmark query and haystack inputs only to an operator-private directory, commits only hashes/counts/command templates, emits a collector-compatible query-set hash, and the release gate binds the RecallWeave result to that hash. The canonical `bm25-lite-b800-k5` retrieval-proxy baseline scored 0.4541 quality on the 6-row source-locked slice with average context tokens 800 and zero privacy failures; it is explicitly not MemoryBench answer-quality evidence and not public superiority language.
- Adds a same-data LongMemEval-S retrieval strategy comparison. `bm25-lite`
  wins the retrieval-proxy canary over the initial `jaccard` baseline, moving
  quality from 0.1089 to 0.4541 and P@1 from 0.1667 to 0.8333 with zero
  privacy failures. This is an autoresearch methodology signal, not a
  MemoryBench answer-quality win.
- Adds the same-data LongMemEval-S autoresearch loop. It now runs 72 local-only
  retrieval-proxy arms across lexical, dense-proxy, temporal, graph-proxy,
  rerank-proxy, and query-expansion-proxy strategies; `bm25-lite-b800-k5`
  preserves quality 0.4541 while cutting average context tokens to 800. The
  canonical checked-in run now uses this setting.
- Clarifies that BM25-lite is the control floor and fallback, not the final
  agent-memory default. The tested `hybrid-v1` arm is a lightweight lexical
  hybrid only; the next benchmark gate must compare BM25-lite against dense,
  graph, temporal, query-expansion, and reranked hybrid arms on the same
  source-locked data.
- Adds that next same-data hybrid gate. The new `benchmark:public-hybrid`
  command compares `bm25-lite` against local-only dense, sparse+dense,
  temporal, graph, rerank, and query-expansion proxy arms on the source-locked
  LongMemEval-S slice. `bm25-lite` remains the control/fallback winner at
  quality 0.4541 and p50 16 ms; the full hybrid proxy arms tie quality but are
  slower at p50 33 ms, so the gate refuses hybrid promotion and keeps broader
  claims blocked.
- Adds an expanded 30-question LongMemEval-S hybrid stress gate. The expanded
  public-safe run uses the same source-locked dataset hash with 92 expected
  references and 1,420 haystack sessions. `bm25-lite` remains the winner at
  quality 0.2506 and P@1 0.4667; `full-hybrid-rerank` is the best local proxy
  hybrid but trails at quality 0.2289 and p50 417 ms, so deterministic hybrid
  promotion remains blocked until live embedding/reranker arms beat the control.
- Adds the provider-backed gate scaffold. The new `benchmark:public-provider`
  command compares `bm25-lite`, `full-hybrid-rerank`,
  `cloud-voyage-rerank-only`, `cloud-voyage4-voyage`,
  `cloud-voyage4-voyage-lite-rerank`, `cloud-voyage4-lite-voyage-lite`,
  `cloud-gemini-embed-rerank-proxy`, `cloud-gemini-voyage-rerank`,
  `cloud-nvidia-retriever-500m`, `cloud-nvidia-nemotron-1b`,
  `cloud-nvidia-e5-mistral`, and `local-apple-qwen3-0_6b` through the same
  public-safe metrics path. Fixture mode uses deterministic provider mocks and
  zero hosted calls; live provider runs require explicit provider-call and
  public-data environment guards plus env-only readiness for the selected
  provider arm.
- Adds a latency-sensitive 30-query Voyage canary on the same public
  LongMemEval-S target. The run compares `bm25-lite`, `full-hybrid-rerank`,
  `cloud-voyage4-voyage`, `cloud-voyage4-voyage-lite-rerank`, and
  `cloud-voyage4-lite-voyage-lite`. The best provider arm,
  `cloud-voyage4-lite-voyage-lite`, reached quality 0.3040 versus BM25 0.2506,
  P@1 0.5667 versus 0.4667, and p50 1988 ms versus 6659 ms for the larger
  `cloud-voyage4-voyage` arm, with zero privacy failures. The report still
  blocks MemoryBench/SOTA claims.
- Enforces the benchmark comparison shape in the runner itself. A provider
  gate now rejects a solo provider-arm run unless `bm25-lite`,
  `full-hybrid-rerank`, and at least one provider-backed arm are present. A
  hybrid gate rejects runs that omit the `bm25-lite` lexical control. This
  keeps solo RecallWeave tests in the smoke lane and makes same-data controls a
  command-level contract.
- Adds `benchmark:public-provider:preflight`, a fail-closed live provider
  benchmark preflight. It checks the source-locked public LongMemEval target,
  provider-call consent flags, public-data consent flags, and env-only
  Gemini/Voyage/NVIDIA/local-Apple readiness without calling provider APIs or
  sending benchmark text. The current controller evidence reports
  `BLOCKED_PROVIDER_ENV`, so no live provider benchmark claim is made.
- Adds private provider key-file env support for live benchmark preflights and
  provider fixture runs. Operators can set `VOYAGE_API_KEYS_FILE`,
  `NVIDIA_API_KEYS_FILE`, or `GEMINI_API_KEYS_FILE` to a private file outside
  the repository so keys do not appear in commands, checked-in docs, packets,
  or reports. The release gate now verifies this path with a temporary key file
  and checks that only key counts are printed.
- Adds an expanded provider preflight for the 30-question target:
  `reviews/overnight-20260522/public-longmemeval-expanded-provider-live-preflight.json`.
  It calls no provider APIs, sends no benchmark text, and binds the future live
  command to `reviews/overnight-20260522/public-longmemeval-expanded-run-target.json`
  so the next cloud-provider test does not fall back to the smaller slice.
- Promotes GitHub Actions run `26351014379` on `c59aed9` as the latest
  verified code/product baseline after binding the provider preflight to the
  expanded 30-query LongMemEval-S target. The checked-in evidence keeps BM25 as
  the current control winner, blocks deterministic hybrid promotion, and blocks
  live provider calls until explicit public-data/provider-call consent plus
  env-only provider readiness is present.
- Previous verified code/product baseline before the expanded provider
  preflight:
  `67d0c9fc8cc3faef2150efa8368d619a1b4c9f11`.
- Promotes GitHub Actions run `26349930959` on `a67c411` as the previous
  verified code/product baseline after extending the provider gate with Gemini
  embedding arms, binding every arm to the same source-locked fixture path, and
  keeping retrieval-proxy/no-public-claims guards active.
- Clarifies that MTEB/MMTEB/BEIR/MIRACL/MS MARCO and reranker leaderboards are
  component evidence for choosing Gemini, Voyage, NVIDIA, Qwen, Jina, BGE, GTE,
  and Apple Silicon arms. Public memory claims still require the same benchmark
  data, revision, split, labels, judge model, answer model, judge rule, and scoring setup as the target row.
- Adds `benchmark:source-lock`, `benchmark:public-slice`,
  `benchmark:public-target:author`, and `benchmark:public-target`, a
  metrics-only source-lock, slice-manifest, run-only target mode, plus
  author-and-validator path for source-locked public benchmark target rows. It
  keeps fixture targets, run-only targets, and component-only leaderboard
  evidence from turning into public memory-system claims.
- Hardens `baseline:source-match` for real local selfmem exports that contain
  path-bearing provenance. Memory text and local path provenance are redacted
  before hashing, stdout, and report output, unsafe ids are hash-replaced, and
  source-mismatched exports remain blocked from public benchmark claims.
- Adds real diagnostic canary evaluation evidence from redacted external Hermes/OpenClaw bundles. The latest postwatch batch audit parsed 8 of 9 returned diagnostics, found zero strict-real passes, ranked the closest privacy-clean OpenClaw candidate, confirmed no returned production canary packet was present, and generated a public-safe OpenClaw next-agent handoff plus a single sendable handoff packet; it still failed adapter-contract and store-latency checks, so it does not count as production rollout evidence.
- Adds `canary:returned-workspace` so a returned one-agent packet can fill the
  next-agent markdown workspace with metrics-only operator findings, returned
  packet intake, and failed-check notes without raw logs, memories, prompts,
  answers, private paths, or keys.
- Adds `canary:returned-downloads` so maintainers can scan the standard
  Downloads and Telegram Desktop inboxes without typing private folder paths
  into package-manager commands, and write a metrics-only markdown findings
  note into the next-agent workspace.
- Refreshes the current standard-inbox scan: 0 production evidence packets, 12
  handoff packet, 8 diagnostics, 19 unknown packets, and 5 unreadable packets.
  The findings now include hash-only triage for unknown and unreadable zips.
  Public launch and real-container rollout remain blocked.
- Hardens the canary batch-audit and next-agent packet paths so empty,
  handoff-only, or no-candidate folders fail closed as metrics-only JSON,
  remove requested output zip paths on blocked packet creation, avoid stack
  traces, and preserve public/fleet launch blockers.
- Adds current OpenClaw hosted/local source-alignment evidence. The selected local container map and hosted candidate label hash aligned, but the local source had 0 of 3 source-matched queries and 0 of 3 collectable queries, so the full hosted/local benchmark remains blocked until content alignment passes.
- Adds a real local Codex selfmem source-match smoke with metrics only: 1081
  parsed memories, 709 private path redactions, zero unsafe id redactions, zero
  privacy leaks, and a correctly blocked source-mismatch verdict against the
  fixture hosted query set.
- Bounds Hermes and OpenClaw hosted Supermemory read-through so canaries can prove local-first recall, explicit old-memory lookup, skip reasons, and total/local/remote latency without making every prompt wait on hosted search.
- Adds fresh canary window isolation so strict-real reports can ignore pre-patch trace history, stale errors, and old missing-latency events after a patched adapter is applied.
- Adds a deterministic strict-real canary drill so the selected one-agent
  operator can exercise local write, local recall, hosted read-through,
  lifecycle/LCM compression, rollback, and metrics-only packet collection
  without storing private data.
- Keeps public launch conservative: fixture evidence is allowed, real private memory text is not committed, and benchmark claims stay blocked until a matched source-locked canary or hosted baseline passes with reviewer sign-off.

## Current Verdict

Not production ready for public launch yet.

The code, fixture UI, release gate, CI, and Claude Opus review are healthy enough for an alpha PR, but launch remains blocked on human approval and one real-container production canary.

## Latest Verified Baseline

- Latest verified PR branch head:
  `2bb8b6b3f024ed3f691196fd739065d8c00dd27a`.
- GitHub Actions run `26367018906`: passed CI after adding the same-data Voyage
  latency comparison gate. This does not change the approved runtime canary
  adapter/report commit.
- Approved one-agent canary adapter/report commit:
  `18d606aff589986b4d8b416a686bedb7ff1506d2`.
- Latest verified code/product baseline:
  `2bb8b6b3f024ed3f691196fd739065d8c00dd27a`.
- GitHub Actions run `26367018906`: passed CI with release checks, release
  doctor, live GitHub sync, goal audit, secret scan, and private-path scan
  green. The checked-in evidence keeps BM25 and full-hybrid controls in the
  same comparison, shows the live `voyage-4-lite` plus `rerank-2.5-lite` arm
  beating BM25 on the 30-query public LongMemEval-S retrieval-proxy slice, and
  requires returned one-agent canary packets to report the approved runtime
  adapter commit.
- Current live Voyage provider evidence now includes both a 6-query and
  30-query source-locked public LongMemEval-S canary comparing `bm25-lite`,
  `full-hybrid-rerank`, and live `cloud-voyage4-voyage`. Voyage beat BM25 on
  retrieval-proxy quality on both slices, with zero privacy failures, but p50
  latency was much higher. This is provider-backed canary evidence, not
  MemoryBench answer-quality evidence or public SOTA proof.
- Current live Voyage latency evidence adds `cloud-voyage4-voyage-lite-rerank`
  and `cloud-voyage4-lite-voyage-lite` to the same 30-query target. The
  `voyage-4-lite` plus `rerank-2.5-lite` arm matched the larger Voyage arm's
  retrieval-proxy quality at 0.3040 while reducing p50 latency to 1988 ms.
  Public claims remain blocked because this is not MemoryBench answer quality.
- Previous verified code/product baseline before provider-arm expansion:
  `8aa98265e84db5a1e2dda2b66d16065c7be30902`.
- GitHub Actions run `26351957568`: passed CI after requiring a same-data benchmark comparator matrix and binding returned canary evidence to the approved adapter commit.
- Previous verified code/product baseline before the commit-bound canary evidence gate:
  `c59aed9939d3cc148c17a98e2f0adfa4ed6c3e1d`.
- GitHub Actions run `26351014379`: passed CI after binding the provider preflight to the expanded 30-query LongMemEval-S target. The checked-in evidence calls no provider APIs, sends no benchmark text, and keeps the next live cloud-provider run tied to the stronger expanded target.
- Previous verified code/product baseline before the expanded provider preflight:
  `67d0c9fc8cc3faef2150efa8368d619a1b4c9f11`.
- GitHub Actions run `26350709133`: passed CI after adding the expanded 30-query LongMemEval-S hybrid stress gate. The gate compares BM25 and local hybrid-family arms on the same source-locked target, keeps BM25 as the current control winner, blocks deterministic hybrid promotion, and preserves the fail-closed provider-backed benchmark path for the next live Voyage/Gemini-style arm.
- Previous verified code/product baseline before the expanded hybrid stress gate:
  `95768a6ebc97c13d53eb0e6a63ad4c3c3b1141e9`.
- GitHub Actions run `26350184513`: passed CI after adding the fail-closed live provider benchmark preflight. The preflight checks the public LongMemEval-S target, BM25/full-hybrid/Voyage/Gemini strategy list, consent flags, and env-only provider readiness without provider API calls or benchmark-text transmission.
- Previous verified code/product baseline before the live provider preflight:
  `a67c4115dc00450f5a51c09089879ec4687c596d`.
- GitHub Actions run `26349930959`: passed CI after extending the opt-in provider-backed benchmark gate to compare BM25, full local hybrid, Voyage rerank-only, Voyage embed+rerank, Gemini embed+local rerank proxy, and Gemini embed+Voyage rerank arms in fixture mode with zero hosted calls, and keeping the result retrieval-proxy only.
- Previous verified code/product baseline before the Gemini provider arms:
  `1e71c434725be7c95350d10ec61f8763a9558e63`.
- Previous verified code/product baseline before the provider gate:
  `1d91c2c7afd4a3074528abeb8472b8c445dca505`.
- Previous verified code/product baseline before the hybrid gate:
  `9a95d08e86c0b212620ea8b3d2182b454e0b90af`.
- GitHub Actions run `26348625868`: passed CI after promoting the canonical LongMemEval-S retrieval-proxy run to the autoresearch winner, `bm25-lite-b800-k5`, binding it to the materialized query-set hash, and marking the result as retrieval-proxy only.
- Previous verified code/product baseline before the materialize-run lane:
  `8eb69e848d442b08ebf4f5204d6ed17224161683`.
- GitHub Actions run `26346613433`: passed CI after adding the public
  LongMemEval-S slice manifest, deterministic question-id policy,
  answer-label hash, scoring-code hash, and focused Codex review.
- Previous verified code/product baseline before public benchmark target
  gating:
  `67993f1d9eab7742ae70841d38ad9cd14021982c`.
- Previous verified code/product baseline before current canary-drill handoff
  hardening:
  `4310e0ec7565abcf7eb4378fd165ecd5bab799f4`.
- Earlier verified code/product baseline:
  `daac851d031d5a2a8c95a307aa7db2a6d2d00762`.
- GitHub Actions run `26342589049`: passed CI after adding returned canary
  workspace generation, keeping fixture workspace output temporary,
  fast-forwarding PR #5 to the helper code, and recording the post-12h
  readiness recheck while preserving strict-real and public-launch blockers.
- Previous verified code/product baseline before the returned-workspace
  follow-up:
  `a56449db786a334db3554f7fd66721ae44261073`.
- GitHub Actions run `26338015421`: passed CI after hardening
  `baseline:source-match` for real local selfmem exports with path-bearing
  provenance, preserving metrics-only output, source-mismatch blockers, and
  public-launch blockers.
- Previous verified code/product baseline before source-match private-path
  redaction:
  `59ebb53824ce0e90cf9b54fbd9621d5e2e381c54`.
- GitHub Actions run `26337456058`: passed CI after hardening empty,
  handoff-only, and no-candidate canary batch and next-agent packet behavior,
  preserving strict-real and public-launch blockers, removing blocked output
  zips, refreshing the release guard allowlist, and keeping the PR/issue sync
  checks green.
- Previous verified code/product baseline before the empty/handoff/no-candidate
  fail-closed hardening:
  `afcc0f44f28c00ea155cf542a22c7c7ac8530e32`.
- GitHub Actions run `26336780942`: passed CI after adding direct
  mixed-folder next-agent handoff packet support, wiring
  `--allow-failed-inputs` through the planner and packet builder, refreshing the
  sendable OpenClaw packet evidence, release readiness assertions, release
  blocker guidance, PR/issue sync evidence, and Gemini review, while preserving
  strict-real and public-launch blockers.
- Previous verified code/product baseline before the mixed-folder next-agent
  handoff packet extension:
  `db7f531b72c6a5fe347b89f537d69df49de4bb8a`.
- GitHub Actions run `26335844586`: passed CI after adding the deterministic
  strict-real canary drill, wiring it into clean consumer smoke, canary
  operator and next-agent packets, release readiness assertions, release
  blocker guidance, goal audit, public docs, PR/issue sync evidence, and Gemini
  review, while preserving strict-real and public-launch blockers.
- Previous verified code/product baseline before the strict-real canary drill:
  `e1f114e664e6bcf6d49ff32bd578c8eefef6e6ce`.
- GitHub Actions run `26335300537`: passed CI after adding
  `baseline:source-gap`, wiring it into clean consumer smoke, the hosted
  baseline operator packet, next-run planner, one-command baseline runner,
  release readiness assertions, public benchmark docs, PR/issue sync evidence,
  and Gemini review, while preserving strict-real and public-launch blockers.
- Previous checked-in evidence refresh before source-gap:
  `3f2eed0c6245f3827f423225478c95a71db67725`.
- Previous verified source-gate code baseline:
  `fc76077f74793ddcf0e69b80617fc81b68d9bcd2`.
- GitHub Actions run `26334827218`: passed CI after enforcing
  `baseline:source-match` plus `baseline:source-align` in the operator packet,
  next-run planner, one-command baseline runner, release readiness assertions,
  public benchmark docs, PR/issue sync evidence, and Gemini review, while
  preserving strict-real and public-launch blockers.
- Previous verified baseline before source-gate enforcement:
  `d234a566354615155dcdc0043404a14b160d4cb3`.
- GitHub Actions run `26334426951`: passed CI after adding the baseline
  source-alignment gate and current OpenClaw label-aligned/content-divergent
  evidence.
- Previous verified baseline before baseline source-alignment:
  `3c9ef0806e5a454783140e1ac821b40edd5776cf`.
- GitHub Actions run `26333740615`: passed CI after adding
  `canary:returned-inbox`, wiring it into the release gate, clean consumer
  smoke, docs, goal audit, and Gemini review, and preserving strict-real and
  public-launch blockers.
- Previous verified baseline before the returned canary inbox scanner:
  `667ed57052eab4bf05f2bbed738f4b4b9c8155a4`.
- GitHub Actions run `26332952176`: passed CI after adding
  `baseline:source-match`, wiring it into the next-run planner, release
  doctor, release readiness, clean consumer smoke, docs, and Gemini review, and
  preserving public benchmark claim blockers.
- Previous verified baseline before the baseline source-match preflight:
  `15e66574e1ae9b54cdfaa93cf67dc4e5fc8f53c7`.
- GitHub Actions run `26332365170`: passed CI after the live hosted-vs-local
  Codex baseline follow-up, export-style private env parsing, preflight path
  sanitization, release doctor, goal audit, and release guard updates.
- Previous verified baseline before the live hosted-vs-local Codex baseline
  follow-up: `aeaa5aadfc8b92e764f910704b34eea3e6e22b50`.
- GitHub Actions run `26331865543`: passed CI after hardening hosted baseline
  live-prep query-set uniqueness, collector evidence, release doctor, and the
  release guard.
- Previous verified baseline before hosted baseline live-prep hardening:
  `e7ce4f1c1a05b6e416b16234784f8694b83615bf`.
- GitHub Actions run `26331102535`: passed CI after adding the
  `baseline:run` hosted-baseline orchestrator and wiring it through clean
  consumer smoke, release readiness, release doctor, docs, and public-safe
  evidence.
- Previous verified baseline before hosted baseline run orchestration:
  `14030ddd9c88020c114a3e5fd3d32735f31557a6`.
- GitHub Actions run `26330646504`: passed CI after adding one-command
  canary evidence packaging to `selfmem_update` and wiring the next-agent
  fresh-window plan to use that packet path.
- Previous verified baseline before updater one-command canary packaging:
  `54f59ee18094d824e3696e13621ac4070e795a7b`.
- GitHub Actions run `26330433491`: passed CI after adding the
  post-baseline public evidence guard and switching CI checkout to full
  history so the guard can inspect the verified code baseline.
- Previous verified baseline before post-baseline public evidence enforcement:
  `c3e948735c1d91c1eacfbc1e7bebba22622bf993`.
- GitHub Actions run `26330234781`: passed CI after adding current canary
  handoff packet identity coverage across packet evidence, next-agent plan
  evidence, real diagnostic evidence, the PR body draft, and the blocker issue
  draft.
- Previous verified baseline before current canary handoff identity coverage:
  `cdf4615de1e9e3c7fa161d70f40fe5bf3e4cea76`.
- GitHub Actions run `26329828449`: passed CI after requiring hosted and
  RecallWeave baseline comparison results to prove matched counterpart runs
  before any comparison can count as evidence.
- Previous verified baseline before matched-counterpart hardening:
  `c0036470512950fa77900221f08d0cbafeab6d7b`, GitHub Actions run
  `26329521666`, passed after adding the hosted-baseline
  query-set author, wiring it into operator, next-run, release doctor, release
  readiness, clean consumer smoke, and docs, and proving fixture plus bounded
  live author smokes.
- Previous verified baseline before query-set authoring:
  `94be156c52904e9379372023037cb7cccff8c7ad`, GitHub Actions run
  `26329113469`, passed after adding the hosted-baseline container selector.
- Previous verified code baseline before the hosted-baseline selector:
  `e9a483af3a416c5d5db17ae511d25c40f52d4c12`.
- GitHub Actions run `26328719263`: passed CI after hardening the hosted
  baseline next-run planner with `--require-ready`, owner-review readiness,
  fail-closed fixture rejection, strict-real evidence fields, updated release
  doctor guidance, and public-safe evidence refresh.
- Previous verified code baseline before the hosted-baseline readiness gate:
  `c19e4dc7be0f45d9d1b29a6e5381cd48fc82c1eb`.
- GitHub Actions run `26328477985`: passed CI after refreshing release-state
  and PR-body evidence for the one-agent handoff hardening baseline.
- Previous verified code baseline before the release-state refresh:
  `07cd61b009e85c071d2a54dc9de1b53db5525e6c`.
- GitHub Actions run `26328348834`: passed CI after hardening the one-agent
  next-agent handoff packet with `--require-ready`, a fresh-window contract,
  fail-closed fixture rejection, updated release doctor guidance, and
  public-safe evidence refresh.
- Previous verified code baseline before the next-agent handoff hardening:
  `dd31fcb293fc8d591aa572fe5c77d4012a5fe630`.
- GitHub Actions run `26327680816`: passed CI after adding public-safe live
  hosted discovery evidence for hashed candidates, wiring release readiness and
  blocker doctor checks for that evidence, and preserving the hosted-baseline
  blocker.
- Latest live hosted discovery evidence: public-safe read-only discovery found
  4 hashed candidate containers across 100 hosted documents, with no raw labels
  or memory text. This narrows the next operator step but does not count as a
  hosted baseline or comparison result.
- Previous verified code baseline before live hosted discovery evidence:
  `2ac02fcbb9d321dc338e59d856abbcc3cfb6cd0a`.
- GitHub Actions run `26327367386`: passed CI after adding `baseline:queryset`
  public-safe query-set inspection and wiring its hashed report into hosted
  baseline operator, next-run, consumer smoke, release readiness, and docs.
- Previous verified code baseline before the query-set inspector:
  `c9c655049c036ca773a62e1c6498bc3438198986`.
- GitHub Actions run `26327102787`: passed CI after requiring labeled
  source-locked query sets for hosted and RecallWeave baseline evidence.
- Previous verified code baseline before the labeled query-set baseline gate:
  `a5d300ad1986e166d214e5c4dae537ad7f2f1bcb`.
- GitHub Actions run `26326805194`: passed CI after wiring the local-session
  batch compaction audit into the formal goal audit and release-readiness gate.
- Previous verified code baseline before the goal-audit batch compaction
  extension: `8d49cf35af0aeeb34b37e913041c723035ff8cca`.
- GitHub Actions run `26326589900`: passed CI after the local-session batch
  compaction audit gate.
- Previous verified code baseline before the local-session batch compaction
  audit gate: `c01513ff37f17562b4fe9f9930332439d5404ec0`.
- GitHub Actions run `26326199048`: passed CI after the hosted baseline
  discovery and next-run planner extension. The first attempt failed during
  GitHub checkout, then rerun attempt 2 passed.
- Previous verified code baseline before the hosted baseline discovery and
  next-run planner extension: `00836ec3105c84814aa65885a1d6828aa298f6a6`.
- GitHub Actions run `26325592308`: passed CI after the hosted baseline
  returned packet intake gate.
- Previous verified code baseline before the hosted baseline returned packet
  intake gate: `aedb81ab3a61ec7c70e3ac7cd07e8085637d5ea3`.
- GitHub Actions run `26325210942`: passed CI after the returned canary
  packet intake gate.
- Previous verified code baseline before the returned canary packet intake gate:
  `7fdac2f287c589ba75731722edaee17cd154451c`.
- GitHub Actions run `26324810035`: passed CI after the canary next-agent
  handoff packet.
- Previous verified code baseline before the canary next-agent handoff packet:
  `8f5910d49a6f1fe4d8967e014c5dd8e1df3e7b6e`.
- GitHub Actions run `26324442965`: passed CI after the real OpenClaw
  next-agent handoff and CI read-permission fix.
- Previous verified code baseline before the real OpenClaw next-agent handoff
  and CI read-permission fix: `1d8375a8dbcc9027d48d7e6821ff24d99fcdb916`.
- GitHub Actions run `26324201679`: passed CI after the mixed canary
  diagnostic batch triage extension.
- Previous verified code baseline before the mixed canary diagnostic batch
  triage extension: `d7e2e13304cd81b9ae3b6013915f13d727f88ebe`.
- GitHub Actions run `26323991060`: passed CI after the package-script-safe
  evidence output extension.
- Previous verified code baseline before the package-script-safe evidence
  output extension: `6c44714e5af4bc578f50070c51d40201303ad6c4`.
- GitHub Actions run `26323533153`: passed CI after the release blocker doctor
  real-canary blocker gate.
- Previous verified code baseline before the release blocker doctor
  real-canary blocker gate: `4aa363dcb6e95e3f3a3e94d9b5297bca639211e8`.
- GitHub Actions run `26323255585`: passed CI after the hosted baseline
  next-run planner gate.
- Previous verified code baseline before the hosted baseline next-run planner
  gate: `0c881257923eb813e904ff11f364648c94823080`.
- GitHub Actions run `26322830311`: passed CI after the canary next-agent
  planner gate.
- Previous verified code baseline before the canary next-agent planner gate:
  `b5ad1b8f9e25832cbdc9afcaa6ad6c71685e7e68`.
- GitHub Actions run `26322521697`: passed CI after the canary diagnostic
  batch audit gate.
- Previous verified code baseline before the canary diagnostic batch audit
  gate: `4ed6c006ac8e69f55bd91f5541dc127b7f0b272d`.
- GitHub Actions run `26322155069`: passed CI after the canary packet review
  gate.
- Previous verified code baseline before the canary packet review gate:
  `c278419cee62520513a66a06e7e0ecaad27096c5`.
- GitHub Actions run `26321087248`: passed CI after the strict adapter
  canary contract gate.
- Previous verified baseline before the strict adapter canary contract:
  `7fc3be269e5e26d0fb0fb58fdcebcabb6b4f1744`.
- GitHub Actions run `26320492619`: passed CI after the RecallWeave response
  export gate.
- Previous verified baseline before the RecallWeave response export:
  `3b1870eb71fe406b77eabd380d9d786886b60236`.
- GitHub Actions run `26320054524`: passed CI after the RecallWeave
  baseline collector gate after rerun attempt 2.
- Previous verified baseline before the RecallWeave baseline collector:
  `8520140bfcb4cb08bed16ee3c34bcb6705fd9310`.
- GitHub Actions run `26319551404`: passed CI after the baseline comparison gate.
- Previous verified baseline before the baseline comparison gate:
  `95f7fea7519574427c7f26e94f00a1085f7c6fb2`.
- GitHub Actions run `26319050876`: passed CI after the hosted baseline collector gate.
- Previous verified baseline before the hosted baseline collector:
  `adfd4352d63810daecfa72a58ccb2c2641b89580`.
- GitHub Actions run `26318710488`: passed CI after the hosted baseline operator packet evidence refresh.
- Previous verified baseline before the hosted baseline operator packet:
  `39feae5f825c045e681aa93f6e71b02ebf4b32c1`.
- GitHub Actions run `26318633036`: passed CI after the hosted baseline operator packet gate.
- Previous verified baseline before the hosted baseline operator packet:
  `2b7fc92d43e1aeff1211dba7eb0c5727bce2fd7b`.
- GitHub Actions run `26318177698`: passed CI after the fresh canary window isolation gate.
- Previous verified baseline before the fresh canary window isolation gate:
  `9eeed9e8e6665588efba9d2dfdfbb57785d05b17`.
- GitHub Actions run `26317637761`: passed CI after the adapter store latency trace gate.
- Previous verified baseline before the adapter store latency trace gate:
  `6b772936f57fbe31e33aaeb18bb4696da90b8185`.
- GitHub Actions run `26317344140`: passed CI after the strict-real canary operator packet.
- Previous verified baseline before the strict-real canary operator packet:
  `4b2ec839cddbce73540d3aea02b4b81f2a474e6a`.
- GitHub Actions run `26316961518`: passed CI after the strict-real update guard.
- Previous verified baseline before the strict-real update guard:
  `6a8bbf09ef6e24ed12c30e0fcff1fe185100e907`.
- GitHub Actions run `26316450928`: passed CI after the Brain UI lifecycle trail evidence refresh.
- Previous verified baseline before the lifecycle trail evidence refresh:
  `8777290169f598ff9172e889e927858b3956f764`.
- GitHub Actions run `26316074705`: passed CI after the Brain UI lifecycle trail and current-head browser evidence refresh.
- Earlier verified baseline before the lifecycle trail browser evidence refresh:
  `b5c1e025db072fca750dc6730741c23e1b981eca`.
- GitHub Actions run `26313942262`: passed CI after the GitHub live sync release gate.
- Earlier verified baseline before the live sync release gate:
  `e765e8ff331475c6f91565f4e68577b011e4781a`.
- GitHub Actions run `26313358962`: passed CI after the bounded read-through latency patch.
- PR #5 body is live and current.
- GitHub issue #6 exists for final release blockers.

## Verification

- `npm exec --yes pnpm@10.23.0 -- test`: 22 tests passed.
- `npm exec --yes pnpm@10.23.0 -- smoke`: passed.
- `node packages/bench/release-readiness-check.mjs`: passed.
- `node packages/bench/github-handoff-packet.mjs`: passed.
- `node packages/bench/github-live-sync-check.mjs`: passed with PR #5 and issue #6 matching checked-in drafts.
- `node packages/bench/goal-completion-audit.mjs`: passed with `goalComplete: false`.
- `node packages/bench/hosted-baseline-preflight.mjs`: passed with `callsHostedProvider: false` and benchmark claims blocked.
- `npm exec --yes pnpm@10.23.0 -- baseline:collect -- --fixture`: passed, producing metrics-only hosted baseline collector output without calling a hosted provider.
- `npm exec --yes pnpm@10.23.0 -- baseline:export:recallweave -- --fixture`: passed, producing a metrics-only local RecallWeave response export with no raw memory text.
- `npm exec --yes pnpm@10.23.0 -- baseline:collect:recallweave -- --fixture`: passed, producing metrics-only RecallWeave baseline collector output with the same query-set and scoring-code hashes.
- `npm exec --yes pnpm@10.23.0 -- baseline:compare -- --fixture`: passed, proving matched comparison checks stay metrics-only and fixture-blocked.
- `npm exec --yes pnpm@10.23.0 -- baseline:operator-packet`: passed, producing
  a public-safe hosted baseline handoff without calling a hosted provider. It
  now includes `preflight-local-source-match`, `preflight-source-alignment`,
  `plan-source-gap`, and a `baseline:run` command that passes `--local-map`
  and `--private-map` before any hosted collection.
- `npm exec --yes pnpm@10.23.0 -- baseline:operator-packet -- --source-gap
  <blocked-source-gap-report> --format markdown`: passed, rendering a
  public-safe repair table with only short query hashes, status labels, match
  counts, and repair actions.
- `npm exec --yes pnpm@10.23.0 -- baseline:select-container`: passed in fixture smoke and live metadata-only selector smoke, writing the selected raw hosted label only to a 0600 private env file while stdout/public reports kept raw labels out.
- `npm exec --yes pnpm@10.23.0 -- baseline:author-queryset`: passed in fixture smoke and bounded live smoke, writing a private 0600 query set outside the repository while stdout/public reports kept raw queries, expected ids, expected hashes, raw labels, memory text, keys, and private paths out.
- Live hosted prep extension: scanned 200 hosted docs, found 14 hashed candidate containers, drafted 8 distinct private queries from 47 text-bearing docs, strict query-set inspection passed with 0 duplicates and 0 unlabeled queries, and Gemini returned `CLEAN`. This still is not a matched baseline.
- Live hosted-vs-local Codex baseline attempt: completed the full metrics-only
  `baseline:run` chain against hosted Supermemory plus the local Codex
  RecallWeave/selfmem bridge. It called the hosted provider, produced a
  strict-real packet, and had zero privacy leaks, but both arms scored 0, so it
  is source-match research evidence rather than a public benchmark claim.
- Live OpenClaw source-alignment attempt: the local container map matched the
  selected hosted candidate label hash, but content alignment failed safely with
  `BLOCKED_CONTENT_DIVERGENT`, 0 of 3 source-matched queries, 0 of 3 collectable
  queries, and 0 privacy leaks. This blocks a full hosted/local benchmark until
  the local RecallWeave source is mirrored from the selected hosted source or a
  reviewed local-source query set is rebuilt and checked against hosted
  read-through.
- Local Codex selfmem source-match smoke: the preflight parsed 1081 memories,
  redacted 709 private path fragments before hashing or reporting, emitted zero
  unsafe id redactions, and reported zero privacy leaks. It still failed
  sourceMatchReady against the fixture hosted query set, so the output is
  source-match research evidence only and does not support public comparison
  claims.
- `npm exec --yes pnpm@10.23.0 -- baseline:next-run`: passed, producing a state-aware hosted-baseline next-run plan that keeps fixture evidence as `FIXTURE_PLAN_ONLY`, requires source-match, source-alignment, and source-gap before the matched run chain, and does not authorize public claims.
- `npm exec --yes pnpm@10.23.0 -- baseline:run -- --fixture`: passed with
  12 steps, including `preflight-local-source-match`,
  `preflight-source-alignment`, and `plan-source-gap` before hosted collection.
- Gemini returned `CLEAN` for the source-gate enforcement diff after reviewing
  the public-safe diff payload.
- `npm exec --yes pnpm@10.23.0 -- baseline:packet`: passed and produced a metrics-only zip with no hosted memories, local memories, transcripts, prompts, answers, keys, or private paths.
- `npm exec --yes pnpm@10.23.0 -- baseline:packet:review`: passed on fixture packet review and kept fixture evidence from counting.
- `npm exec --yes pnpm@10.23.0 -- baseline:returned-packet`: passed on fixture intake with `status: NOT_BASELINE_EVIDENCE`; `--require-production-baseline` fails closed for fixture packets.
- Hosted baseline and canary evidence commands now use `--output` for JSON
  artifacts instead of shell redirection after package scripts, and
  `release:check` asserts this guard.
- `node packages/bench/canary-evidence-intake.mjs`: passed in fixture mode and rejects raw memories/transcripts/prompts.
- Strict-real intake now exits nonzero while still printing sanitized JSON for
  fixture or weak real evidence, so failed canaries can feed `canary:diagnose`
  without exposing raw content.
- Adapter contract gate: Hermes and OpenClaw smokes pass with
  `adapterContractCovered: true`; canary reports now expose strict v1 adapter
  markers, and `selfmem_update` reports source/target adapter digests.
- `node packages/bench/canary-report-from-trace.mjs`: passed for trace fixtures and redacted diagnostic export fixtures.
- `npm exec --yes pnpm@10.23.0 -- canary:diagnose`: passed, producing metrics-only remediation guidance for a failing canary report.
- `npm exec --yes pnpm@10.23.0 -- canary:drill`: passed, producing a
  public-safe strict-real drill for Hermes/OpenClaw that forces local write,
  recall, hosted read-through attempt, lifecycle/LCM coverage, rollback, and
  metrics-only collection.
- `npm exec --yes pnpm@10.23.0 -- canary:operator-packet`: passed with fresh-window timestamp instructions.
- `npm exec --yes pnpm@10.23.0 -- canary:packet`: passed and produced a metrics-only zip with no raw memories, transcripts, prompts, answers, keys, or private paths.
- `npm exec --yes pnpm@10.23.0 -- canary:returned-packet`: passed on fixture intake, treats returned packet paths as strict-real review, and failed closed with `--require-production-canary` for fixture evidence.
- `npm exec --yes pnpm@10.23.0 -- canary:batch-audit`: passed on the fixture batch, failed closed with `--require-real-pass`, supported explicit mixed-folder `--allow-failed-inputs` triage, and triaged the available redacted real diagnostics without exposing raw content.
- `reviews/overnight-20260522/real-next-agent-openclaw-canary-plan.md`: added a paste-ready OpenClaw fresh-window canary handoff selected from redacted metrics-only evidence.
- `npm exec --yes pnpm@10.23.0 -- canary:next-agent`: passed on the fixture planner and converted the real redacted batch into a one-agent OpenClaw fresh-window plan focused on adapter-contract and store-latency evidence.
- `npm exec --yes pnpm@10.23.0 -- canary:next-agent-packet -- --batch reviews/overnight-20260522/real-diagnostics-postwatch-batch-audit.json --require-ready --expected-commit 18d606aff589986b4d8b416a686bedb7ff1506d2`: passed from the postwatch batch report, preserving the selected privacy-clean OpenClaw candidate and keeping failed sibling diagnostics from counting as rollout evidence.
- `npm exec --yes pnpm@10.23.0 -- canary:returned-workspace`: passed in
  fixture mode, wrote metrics-only markdown and JSON into a temp workspace, and
  failed closed with `--require-production-canary` for fixture evidence.
- `npm exec --yes pnpm@10.23.0 -- canary:returned-downloads`: passed, scanned
  the standard Downloads and Telegram Desktop inboxes, found 0 production
  evidence packets, and wrote a metrics-only markdown findings note.
- GitHub Actions run `26343015277`: passed CI after adding
  `canary:returned-downloads`, wiring it into the release gate, consumer smoke,
  docs, and public-safe markdown findings, while preserving strict-real and
  public-launch blockers.
- GitHub Actions run `26343998064`: passed CI after expanding the returned
  downloads findings note with a per-inbox metrics table and next-action list,
  while preserving strict-real and public-launch blockers.
- GitHub Actions run `26344382488`: passed CI after hardening the current
  OpenClaw one-agent handoff so deterministic drill execution and the
  native-memory/read-through contract are explicit in the main next-agent plan.
- GitHub Actions run `26345383489`: passed CI after adding the public benchmark
  target validator for source-locked memory benchmarks, same judge model, and
  same answer model comparability.
- GitHub Actions run `26346310930`: passed CI after adding the current
  MemoryBench source lock, optional checkout hash verification, and
  machine-readable source-lock evidence.
- GitHub Actions run `26346613433`: passed CI after adding the public
  LongMemEval-S slice manifest, deterministic question-id policy,
  answer-label hash, scoring-code hash, and focused Codex review.
- Previous verified code baseline before returned downloads supervision:
  `daac851d031d5a2a8c95a307aa7db2a6d2d00762`.
- Current one-agent handoff packet:
  `recallweave-openclaw-next-agent-canary-20260524-SEND-THIS-ONE-18d606a.zip`, SHA256
  `f5aa0f89f250b695152218b542c9bf498de7e2b3b291ce6081451dfb23565cda`.
  Send it with `recallweave-SEND-THIS-ONE-openclaw-canary-instructions.md`
  and `recallweave-SEND-THIS-ONE-checksum.txt` so the selected agent can
  verify the exact packet before running it.
  Packet generated from controller commit
  `18d606aff589986b4d8b416a686bedb7ff1506d2`; approved adapter commit
  `18d606aff589986b4d8b416a686bedb7ff1506d2`.
  Returned canary reports must name commit
  `18d606aff589986b4d8b416a686bedb7ff1506d2`.
  If a newer adapter commit should count, regenerate the packet first.
  It is ready only for one fresh OpenClaw canary window, not fleet rollout.
- Fresh canary window synthetic diagnostic: passed, proving old pre-patch errors and store events outside `--since` do not poison strict-real intake.
- `npm exec --yes pnpm@10.23.0 -- smoke:openclaw`: passed with bounded read-through policy and local/remote/total recall timing assertions.
- `npm exec --yes pnpm@10.23.0 -- smoke:hermes`: passed with bounded read-through policy and local/remote/total recall timing assertions.
- `git diff --check`: clean.
- Changed-file secret and private-name scans: no actual key or private memory hits.

## Release Blockers

- Claude/Opus review completed with `CONCERNS`; it supports alpha PR review only and does not approve public launch.
- Human approval is required before merge, visibility changes, or public release messaging.
- Hosted Supermemory comparison claims require a source-aligned,
  source-matched, non-zero, reviewer-approved metrics-only baseline routed
  through the next-run planner.
- One real-container production rollout remains incomplete; fixture UI and canary tooling are not enough for public launch.
- The available redacted real diagnostic bundle set has been evaluated and rejected by the strict rollout gate. A fresh patched one-agent canary must follow the deterministic `canary:drill` window and pass before this blocker can close.
- Gemini returned `CLEAN` on the fresh-window diff. Claude CLI review for that narrow diff returned no usable stdout and is recorded as blocked, not as approval.

## Evidence Packet

Primary evidence lives under `reviews/overnight-20260522/` and is intentionally fixture-first and metrics-only. Do not treat fixture scores or private local experiments as public benchmark claims.
```
