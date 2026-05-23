# RecallWeave Overnight Summary

Date: 2026-05-22

Thread goal: run and supervise the 12-hour RecallWeave product goal loop for
Nucleus Index, wiki/vault sync, self-hosted Brain UI, update flow, and
local-only memory compaction benchmarking.

Verdict: post-12-hour production readiness remains FAIL for public launch. The
fresh controller run, Claude Opus review, and GitHub CI now pass for alpha PR
evidence, but human approval, hosted-baseline evidence, and real canary
evidence are still required before any public live update.

## Current PR State

- Repository: `radbroradbro/selfmem-agent-memory`
- Pull request: <https://github.com/radbroradbro/selfmem-agent-memory/pull/5>
- Branch: `feat/nucleus-wiki-native-contract`
- Base: `main`
- Latest CI-inspected code/product baseline:
  `8f5910d`, run `26324442965`, success.
- Latest release-state guard CI:
  `dd17f44`, run `26289073223`, success.
- PR API state when checked: open, not draft, mergeable, clean.
- GitHub Actions CI run `26288370812` on `2888f91`: success.
- GitHub Actions CI run `26290534116` on `103e7c6`: success.
- GitHub Actions CI run `26291352800` on `04f1096`: success.
- GitHub Actions CI run `26292137539` on `3b5e140`: success.
- GitHub Actions CI run `26292772262` on `19f2577`: success.
- GitHub Actions CI run `26293533847` on `72ab902`: success.
- GitHub Actions CI run `26294323086` on `b5352a0`: success.
- GitHub Actions CI run `26295772356` on `21fd4d6`: success.
- GitHub Actions CI run `26297064340` on `be47cff`: success.
- GitHub Actions CI run `26297876735` on `62367a1`: success.
- GitHub Actions CI run `26298339106` on `aebd205`: success.
- GitHub Actions CI run `26298965544` on `be08302`: success.
- GitHub Actions CI run `26299756374` on `fb466db`: success.
- GitHub Actions CI run `26300784883` on `0ec4396`: success.
- GitHub Actions CI run `26301888111` on `8c26de7`: success.
- GitHub Actions CI run `26302442423` on `d0113c0`: success.
- GitHub Actions CI run `26302990767` on `f51346f`: success.
- GitHub Actions CI run `26304465466` on `e043d6b`: success.
- GitHub Actions CI run `26305284384` on `13cbe8d`: success.
- GitHub Actions CI run `26305635737` on `22e17b1`: success.
- GitHub Actions CI run `26306469240` on `ff6f343`: success.
- GitHub Actions CI run `26306827655` on `4cee083`: success.
- GitHub Actions CI run `26309563159` on `02b3a13`: success.
- GitHub Actions CI run `26310168571` on `d26eb78`: success.
- GitHub Actions CI run `26310773948` on `6ae4ce7`: success.
- GitHub Actions CI run `26311728246` on `77b3cee`: success.
- GitHub Actions CI run `26312283137` on `4f5a079`: success.
- GitHub Actions CI run `26313358962` on `e765e8f`: success.
- GitHub Actions CI run `26313942262` on `b5c1e02`: success.
- GitHub Actions CI run `26316074705` on `8777290`: success.
- GitHub Actions CI run `26316450928` on `6a8bbf0`: success.
- GitHub Actions CI run `26316961518` on `4b2ec83`: success.
- GitHub Actions CI run `26317344140` on `6b77293`: success.
- GitHub Actions CI run `26317637761` on `9eeed9e`: success.
- GitHub Actions CI run `26318177698` on `2b7fc92`: success.
- GitHub Actions CI run `26318633036` on `39feae5`: success.
- GitHub Actions CI run `26318710488` on `adfd435`: success.
- GitHub Actions CI run `26319050876` on `95f7fea`: success.
- GitHub Actions CI run `26319551404` on `8520140`: success.
- GitHub Actions CI run `26320054524` on `3b1870e`: success after rerun
  attempt 2.
- GitHub Actions CI run `26320492619` on `7fc3be2`: success.
- GitHub Actions CI run `26321087248` on `5a5107f`: success.
- GitHub Actions CI run `26321472056` on `e2388f0`: success.
- GitHub Actions CI run `26321818276` on `aa0e1d3`: success.
- GitHub Actions CI run `26321912900` on `c278419`: success.
- GitHub Actions CI run `26322155069` on `4ed6c00`: success.
- GitHub Actions CI run `26322521697` on `b5ad1b8`: success.
- GitHub Actions CI run `26322830311` on `0c88125`: success after rerun
  attempt 2.
- GitHub Actions CI run `26323255585` on `4aa363d`: success.
- GitHub Actions CI run `26323533153` on `6c44714`: success.
- GitHub Actions CI run `26323991060` on `d7e2e13`: success.
- GitHub Actions CI run `26324201679` on `1d8375a`: success.
- GitHub Actions CI run `26324442965` on `8f5910d`: success.

## Shipped Overnight Slices

| Area | Evidence |
| --- | --- |
| Nucleus Index | `packages/core/src/nucleus/index.ts`, `docs/NUCLEUS_INDEX.md`, `reviews/overnight-20260522/wiki-vault-evidence.md` |
| LLM-wiki compiler | `packages/core/src/wiki/compiler.ts`, `packages/bench/wiki-vault-smoke.mjs`, `reviews/overnight-20260522/wiki-vault-evidence.md` |
| Wiki vault disk sync | `packages/core/src/wiki/sync.ts`, `packages/bench/wiki-vault-sync-smoke.mjs`, `reviews/overnight-20260522/wiki-vault-sync-evidence.md` |
| Wiki sync audit log | `packages/core/src/wiki/sync.ts`, `reviews/overnight-20260522/gemini-wiki-sync-audit-log-review.md` |
| Brain UI graph and editor | `packages/brain-ui/`, `reviews/overnight-20260522/ui-evidence/README.md` |
| Brain UI dynamic graph layout | `packages/brain-ui/src/model.js`, `reviews/overnight-20260522/brain-ui-dynamic-layout-evidence.md`, `reviews/overnight-20260522/gemini-brain-ui-dynamic-layout-review.md` |
| Brain UI graph navigation controls | `packages/brain-ui/src/model.js`, `packages/brain-ui/src/app.js`, `reviews/overnight-20260522/brain-ui-graph-navigation-evidence.md`, `reviews/overnight-20260522/gemini-brain-ui-graph-navigation-review.md` |
| Model/autoresearch matrix gate | `docs/MODEL_MATRIX.md`, `docs/AUTORESEARCH_BENCHMARK_PLAN.md`, `configs/provider-matrix.yaml`, `configs/bench-budget.yaml` |
| Hosted baseline preflight | `packages/bench/hosted-baseline-preflight.mjs`, `reviews/overnight-20260522/hosted-baseline-preflight-evidence.md`, `reviews/overnight-20260522/gemini-hosted-baseline-preflight-review.md` |
| Hosted baseline collector | `packages/bench/hosted-baseline-collector.mjs`, `reviews/overnight-20260522/hosted-baseline-collector-evidence.md`, `reviews/overnight-20260522/gemini-hosted-baseline-collector-review.md` |
| RecallWeave response export | `packages/bench/recallweave-response-export.mjs`, `baseline:export:recallweave`, `reviews/overnight-20260522/recallweave-response-export-evidence.md`, `reviews/overnight-20260522/gemini-recallweave-response-export-review.md` |
| RecallWeave baseline collector | `packages/bench/recallweave-baseline-collector.mjs`, `baseline:collect:recallweave`, `reviews/overnight-20260522/recallweave-baseline-collector-evidence.md`, `reviews/overnight-20260522/gemini-recallweave-baseline-collector-review.md` |
| Baseline comparison gate | `packages/bench/baseline-comparison.mjs`, `baseline:compare`, `reviews/overnight-20260522/baseline-comparison-evidence.md`, `reviews/overnight-20260522/gemini-baseline-comparison-review.md` |
| Hosted baseline operator packet | `packages/bench/hosted-baseline-operator-packet.mjs`, `reviews/overnight-20260522/hosted-baseline-operator-packet-evidence.md` |
| Hosted baseline next-run planner | `packages/bench/hosted-baseline-next-run.mjs`, `baseline:next-run`, `reviews/overnight-20260522/hosted-baseline-next-run-evidence.md`, `reviews/overnight-20260522/gemini-hosted-baseline-next-run-review.md` |
| Baseline evidence packet | `packages/bench/baseline-evidence-packet.mjs`, `baseline:packet`, `reviews/overnight-20260522/baseline-evidence-packet-evidence.md`, `reviews/overnight-20260522/gemini-baseline-evidence-packet-review.md` |
| Baseline/canary output path safety | `packages/bench/hosted-baseline-preflight.mjs`, `packages/bench/baseline-comparison.mjs`, `packages/bench/canary-evidence-intake.mjs`, `reviews/overnight-20260522/baseline-output-path-evidence.md`, `reviews/overnight-20260522/gemini-baseline-output-path-review.md` |
| Canary evidence intake | `packages/bench/canary-evidence-intake.mjs`, `reviews/overnight-20260522/canary-evidence-intake-evidence.md`, `reviews/overnight-20260522/gemini-canary-evidence-intake-review.md` |
| Strict-real fail-closed intake output | `packages/bench/canary-evidence-intake.mjs`, `reviews/overnight-20260522/canary-evidence-intake-evidence.md`, `reviews/overnight-20260522/gemini-strict-real-fail-closed-intake-review.md` |
| Adapter strict canary contract | `packages/adapters/hermes/selfmem_canary/__init__.py`, `packages/adapters/openclaw/selfmem_canary/index.mjs`, `packages/bench/canary-evidence-intake.mjs`, `plugins/selfmem-fallback/scripts/selfmem_update.py`, `reviews/overnight-20260522/adapter-strict-canary-contract-evidence.md`, `reviews/overnight-20260522/gemini-adapter-strict-canary-contract-review.md` |
| Canary report generator | `packages/bench/canary-report-from-trace.mjs`, `reviews/overnight-20260522/canary-report-generator-evidence.md`, `reviews/overnight-20260522/gemini-canary-report-generator-review.md` |
| Canary operator packet | `packages/bench/canary-operator-packet.mjs`, `reviews/overnight-20260522/canary-operator-packet-evidence.md`, `reviews/overnight-20260522/gemini-canary-operator-packet-review.md` |
| Canary evidence packet | `packages/bench/canary-evidence-packet.mjs`, `reviews/overnight-20260522/canary-evidence-packet-evidence.md`, `reviews/overnight-20260522/gemini-canary-evidence-packet-review.md` |
| Canary evidence packet review | `packages/bench/canary-evidence-packet-review.mjs`, `reviews/overnight-20260522/canary-evidence-packet-review-evidence.md`, `reviews/overnight-20260522/gemini-canary-evidence-packet-review-review.md` |
| Canary diagnostic batch audit | `packages/bench/canary-diagnostic-batch-audit.mjs`, `reviews/overnight-20260522/canary-diagnostic-batch-audit-evidence.md`, `reviews/overnight-20260522/gemini-canary-diagnostic-batch-audit-review.md` |
| Canary mixed-folder triage | `packages/bench/canary-diagnostic-batch-audit.mjs`, `--allow-failed-inputs`, `reviews/overnight-20260522/canary-diagnostic-batch-audit-evidence.md`, `reviews/overnight-20260522/real-canary-diagnostic-evidence.md` |
| Canary next-agent plan | `packages/bench/canary-next-agent-plan.mjs`, `reviews/overnight-20260522/canary-next-agent-plan-evidence.md`, `reviews/overnight-20260522/gemini-canary-next-agent-plan-review.md` |
| Real OpenClaw next-agent handoff | `reviews/overnight-20260522/real-next-agent-openclaw-canary-plan.md`, selected from redacted metrics-only batch evidence |
| Fresh canary window isolation | `packages/bench/canary-report-from-trace.mjs`, `plugins/selfmem-fallback/scripts/selfmem_update.py`, `reviews/overnight-20260522/gemini-fresh-canary-window-review.md` |
| Real canary diagnostic evaluation | `reviews/overnight-20260522/real-canary-diagnostic-evidence.md` |
| Adapter bounded read-through | `packages/adapters/hermes/selfmem_canary/__init__.py`, `packages/adapters/openclaw/selfmem_canary/index.mjs`, `reviews/overnight-20260522/adapter-bounded-read-through-evidence.md` |
| Adapter store latency gate | `packages/adapters/hermes/selfmem_canary_standalone_smoke.py`, `packages/adapters/openclaw/selfmem_canary_standalone_smoke.mjs`, `reviews/overnight-20260522/gemini-adapter-store-latency-review.md` |
| Brain UI model matrix | `packages/brain-ui/fixtures/model-matrix.json`, `reviews/overnight-20260522/brain-ui-model-matrix-evidence.md`, `reviews/overnight-20260522/gemini-brain-ui-model-matrix-review.md` |
| Brain UI vault preview | `reviews/overnight-20260522/brain-ui-vault-preview-evidence.md` |
| Brain UI sync report | `reviews/overnight-20260522/brain-ui-sync-report-evidence.md` |
| Brain UI draft export | `reviews/overnight-20260522/brain-ui-edit-export-evidence.md` |
| Brain UI container health | `reviews/overnight-20260522/brain-ui-container-health-evidence.md` |
| Brain UI local audit preview | `reviews/overnight-20260522/brain-ui-local-audit-preview-evidence.md` |
| Brain UI selected local-container browse | `reviews/overnight-20260522/brain-ui-selected-local-browse-evidence.md` |
| Brain UI selected local-container browse review | `reviews/overnight-20260522/gemini-brain-ui-selected-local-browse-review.md` |
| Brain UI selected local memory edit overlay | `reviews/overnight-20260522/brain-ui-local-memory-edit-evidence.md` |
| Brain UI selected local memory edit review | `reviews/overnight-20260522/gemini-brain-ui-local-memory-edit-review.md` |
| Brain UI local edit overlay browse | `reviews/overnight-20260522/brain-ui-local-edit-overlay-browse-evidence.md` |
| Brain UI local edit overlay browse review | `reviews/overnight-20260522/gemini-brain-ui-local-edit-overlay-browse-review.md` |
| Brain UI selected local memory materialize | `reviews/overnight-20260522/brain-ui-local-memory-materialize-evidence.md` |
| Brain UI selected local memory materialize review | `reviews/overnight-20260522/gemini-brain-ui-local-memory-materialize-review.md` |
| Brain UI selected vault sync dry-run | `reviews/overnight-20260522/brain-ui-selected-sync-dry-run-evidence.md` |
| Brain UI selected vault sync apply | `packages/brain-ui/server.mjs`, `packages/brain-ui/interaction-smoke.mjs`, `reviews/overnight-20260522/ui-evidence/brain-ui-browser-dom-evidence.json` |
| Selected vault sync apply review | `reviews/overnight-20260522/gemini-selected-sync-apply-review.md` |
| Brain UI lifecycle policy preview | `reviews/overnight-20260522/brain-ui-lifecycle-policy-evidence.md` |
| Brain UI lifecycle policy apply | `reviews/overnight-20260522/brain-ui-lifecycle-policy-apply-evidence.md` |
| Brain UI lifecycle policy apply review | `reviews/overnight-20260522/gemini-brain-ui-lifecycle-policy-apply-review.md` |
| Brain UI memory review queue | `reviews/overnight-20260522/brain-ui-review-queue-evidence.md` |
| Brain UI memory review queue apply | `reviews/overnight-20260522/brain-ui-review-queue-apply-evidence.md` |
| Brain UI memory review queue apply review | `reviews/overnight-20260522/gemini-brain-ui-review-queue-apply-review.md` |
| Brain UI Nucleus snapshot | `reviews/overnight-20260522/brain-ui-nucleus-snapshot-evidence.md` |
| Brain UI research lineage | `reviews/overnight-20260522/brain-ui-research-lineage-evidence.md` |
| Brain UI research source lock | `reviews/overnight-20260522/brain-ui-research-source-lock-evidence.md` |
| Brain UI compaction audit | `reviews/overnight-20260522/brain-ui-compaction-audit-evidence.md` |
| Brain UI benchmark dashboard | `reviews/overnight-20260522/brain-ui-benchmark-dashboard-evidence.md` |
| Brain UI canary rollout | `reviews/overnight-20260522/brain-ui-canary-rollout-evidence.md` |
| Brain UI context preview | `reviews/overnight-20260522/brain-ui-context-preview-evidence.md` |
| Brain UI release readiness | `reviews/overnight-20260522/brain-ui-release-readiness-evidence.md` |
| Brain UI lifecycle trail | `packages/brain-ui/src/model.js`, `packages/brain-ui/src/app.js`, `reviews/overnight-20260522/brain-ui-static-rerun-evidence.md`, `reviews/overnight-20260522/brain-ui-lifecycle-trail-evidence.md` |
| Brain UI static evidence fallback | `packages/brain-ui/static-evidence.mjs`, `reviews/overnight-20260522/brain-ui-static-evidence.md`, `reviews/overnight-20260522/brain-ui-static-rerun-evidence.md` |
| Brain UI interaction smoke | `packages/brain-ui/interaction-smoke.mjs`, `reviews/overnight-20260522/brain-ui-interaction-smoke-evidence.md` |
| Browser DOM evidence | `reviews/overnight-20260522/ui-evidence/brain-ui-browser-dom-evidence.json` |
| Browser evidence gate review | `reviews/overnight-20260522/gemini-browser-evidence-gate-review.md` |
| Local container audit preflight | `packages/core/src/local-container/audit.ts`, `reviews/overnight-20260522/local-container-audit-evidence.md` |
| Agent update command | `bin/selfmem_update`, `reviews/overnight-20260522/update-flow-evidence.md` |
| Clean consumer smoke | `packages/bench/consumer-install-smoke.mjs`, `reviews/overnight-20260522/consumer-install-smoke-evidence.md`, `reviews/overnight-20260522/gemini-consumer-install-smoke-review.md` |
| Session compaction benchmark | `packages/bench/session-compaction-benchmark.mjs`, `reviews/overnight-20260522/session-compaction-benchmark-evidence.md` |
| Local-session compaction audit | `packages/bench/session-compaction-local-audit.mjs`, `reviews/overnight-20260522/session-compaction-local-audit-evidence.md` |
| Public release gate | `packages/bench/release-readiness-check.mjs`, `reviews/overnight-20260522/release-readiness-evidence.md` |
| Release handoff | `docs/RELEASE_HANDOFF.md`, `reviews/overnight-20260522/release-handoff-evidence.md` |
| Conservative release-state manifest | `reviews/overnight-20260522/release-state.json` |
| Release-state guard review | `reviews/overnight-20260522/gemini-release-state-guard-review.md` |
| Post-12-hour readiness verdict | `reviews/overnight-20260522/production-readiness.md` |
| Public live-update draft | `reviews/overnight-20260522/public-live-update-draft.md` |
| Dummy Brain demo storyboard | `reviews/overnight-20260522/dummy-brain-demo-storyboard.md` |
| Public live-update copy review | `reviews/overnight-20260522/gemini-public-live-update-copy-review.md` |
| PR body/comment update draft | `reviews/overnight-20260522/pr-body-update-draft.md` |
| Historical GitHub issue creation blocker | `reviews/overnight-20260522/github-issue-create-blocked.md` |
| Live GitHub write evidence | `reviews/overnight-20260522/github-write-route-evidence.md` |
| GitHub live sync check | `packages/bench/github-live-sync-check.mjs`, `reviews/overnight-20260522/github-live-sync-evidence.md` |
| Blocker permission refresh review | `reviews/overnight-20260522/gemini-blocker-permission-refresh-review.md` |
| Completion audit | `reviews/overnight-20260522/completion-audit.md` |
| Completion audit review | `reviews/overnight-20260522/gemini-completion-audit-review.md` |

## Verification Run

Latest local verification before this summary:

- `npm run test`: passed, 22 tests.
- `node packages/brain-ui/static-evidence.mjs`: passed with 9 fixture Nucleus
  nodes, 9 graph edges, 19 required UI sections, 13 required controls, zero
  privacy leaks, hosted write-back disabled, and `productionReady: false`.
- `pnpm smoke`: passed.
- `pnpm brain:interaction`: passed for the Brain UI model refactor slice.
- `pnpm wiki:sync:smoke`: passed with 12 pre-write audit entries.
- `pnpm container:audit:smoke`: passed.
- `pnpm release:check`: passed.
- `git diff --check`: passed.
- Public secret-pattern scan: no hits.
- Private-name scan: no hits.
- Release handoff follow-up: `docs/RELEASE_HANDOFF.md` added and required by
  `release:check`.
- Local-session compaction audit: `pnpm compaction:local-audit:built` passed
  in metrics-only mode with 6 input events, 2 redactions, 4 candidate
  fingerprints, chronological output, and zero privacy leaks.
- GitHub Actions CI: success on the latest inspected baseline, `4ed6c00`.
- GitHub Actions CI: success on release-state guard commit `dd17f44`, run
  `26289073223`.
- Strict adapter contract verification: local tests, full smoke,
  `release:check`, `release:doctor`, `goal:audit`, Gemini review, PR/issue
  live sync, and GitHub Actions CI run `26321087248` passed on `5a5107f`.
- Canary evidence packet verification: local packet smoke, clean consumer smoke,
  full smoke, `release:check`, `release:doctor`, `goal:audit`, Gemini review,
  PR/issue live sync, and GitHub Actions CI run `26321472056` passed on
  `e2388f0`.
- Baseline evidence packet verification: local packet smoke and strict fixture
  rejection passed. Gemini review returned `CLEAN`. GitHub Actions CI run
  `26321818276` passed on `aa0e1d3`, and the docs refresh run
  `26321912900` passed on `c278419`. The packet keeps public benchmark claims
  disabled unless a strict-real hosted baseline, RecallWeave result,
  comparison, and preflight all pass.
- Canary packet review verification: packet review smoke, strict fixture
  rejection, clean consumer smoke, full smoke, `release:check`,
  `release:doctor`, `goal:audit`, Gemini review, PR/issue live sync, and
  GitHub Actions CI run `26322155069` passed on `4ed6c00`.
- Canary diagnostic batch audit verification: default fixture batch passed,
  `--require-real-pass` failed closed for fixture evidence, a real redacted
  batch triage parsed 8 of 9 inputs and found zero strict-real passes, and
  Gemini review returned `CLEAN`. GitHub Actions CI run `26322521697` passed on
  `b5ad1b8`. The best real candidate remains blocked by adapter contract and
  store-latency evidence.
- Canary next-agent planner verification: fixture planner passed without
  enabling a real canary, the real redacted batch produced a one-agent OpenClaw
  fresh-window plan focused on adapter-contract and store-latency evidence, and
  Gemini review returned `CLEAN`. GitHub Actions CI run `26322830311` passed on
  `0c88125` after rerun attempt 2.
- Hosted baseline next-run planner verification: fixture planner produced a
  metrics-only `FIXTURE_PLAN_ONLY` packet, no hosted provider was called,
  public claims remain disabled by default, clean consumer smoke includes the
  planner, and Gemini review returned `CLEAN`. GitHub Actions CI run
  `26323255585` passed on `4aa363d`.
- Release blocker doctor real-canary blocker verification: the doctor now
  reports human approval, hosted baseline, and fresh real-agent canary blockers
  in the same report, fixture canary output cannot count as real rollout
  evidence, and Gemini review returned `CLEAN`. GitHub Actions CI run
  `26323533153` passed on `6c44714`.
- GitHub Actions CI: success on guarded selected vault sync apply commit
  `103e7c6`, run `26290534116`.
- GitHub Actions CI: success on guarded selected local-container browse commit
  `04f1096`, run `26291352800`.
- GitHub Actions CI: success on guarded selected lifecycle policy apply commit
  `3b5e140`, run `26292137539`.
- GitHub Actions CI: success on guarded selected review queue apply commit
  `19f2577`, run `26292772262`.
- GitHub Actions CI: success on guarded selected local memory edit overlay
  commit `72ab902`, run `26293533847`.
- GitHub Actions CI: success on guarded local edit overlay browse commit
  `b5352a0`, run `26294323086`.
- GitHub Actions CI: success on guarded local memory materialize commit
  `21fd4d6`, run `26295772356`.
- Dynamic Brain UI layout verification: local smoke and interaction smoke
  passed with `dynamic-graph-layout` evidence, and GitHub Actions CI run
  `26297064340` passed on `be47cff`.
- Graph navigation verification: local smoke and interaction smoke passed with
  `graph-navigation-controls` evidence, and GitHub Actions CI run
  `26297876735` passed on `62367a1`.
- Release handoff verification: local release gate, full smoke, tests,
  private-name scan, Gemini review, and GitHub Actions CI run `26298339106`
  passed on `aebd205`.
- Local-session compaction audit verification: release gate now requires
  `session-compaction-local-audit-evidence.md`, the local audit script, and
  the `session-compaction-local-audit` release-state surface.
  GitHub Actions CI run `26298965544` passed on `be08302`.
- Brain UI Compaction Audit verification: release gate now requires
  `brain-ui-compaction-audit-evidence.md`, the screenshot, Browser DOM
  evidence, Gemini review evidence, the `brain-ui-session-compaction-audit`
  release-state surface, and fresh Brain UI smoke and interaction smoke
  coverage. GitHub Actions CI run `26299756374` passed on `fb466db`.
- Brain UI Context Preview verification: local smoke and interaction smoke pass
  with `prompt-context-preview` evidence. Browser DOM evidence reports 642 of
  900 fixture context tokens used, 3 selected memories, 3 context sections, 2
  omitted candidates, read-only hosted mode, local-only writes, zero privacy
  leaks, zero console errors, and no private/key-shaped visible text. GitHub
  Actions CI run `26300784883` passed on `0ec4396`.
- Brain UI Release Readiness verification: local smoke and interaction smoke
  pass with `release-readiness-console` evidence. Browser DOM evidence reports
  public launch verdict `FAIL`, `productionReady: false`, 16 proven preview
  surfaces, 5 remaining blockers, 5 manual actions, fixture-only evidence,
  hosted write-back disabled, zero privacy leaks, zero console errors, and no
  private/key-shaped visible text. GitHub Actions CI run `26301888111` passed
  on `8c26de7`.
- Brain UI Benchmark Dashboard verification: local smoke and interaction smoke
  pass with `benchmark-dashboard` evidence. Browser DOM evidence reports 5 of
  5 fixture scenarios passed, 0 failed scenarios, 0 privacy leaks,
  exact-identifier accuracy 1, average noise reduction 0.307, 3 caveats,
  hosted-baseline caveat visible, zero console errors, and no
  private/key-shaped visible text. GitHub Actions CI run `26302442423` passed
  on `d0113c0`.
- Brain UI Canary Rollout verification: local smoke and interaction smoke pass
  with `canary-rollout` evidence. Browser DOM evidence reports
  `READY_FOR_ONE_AGENT_CANARY`, target scope `one-agent`, hosted Supermemory
  mode `read-through-only`, public launch verdict `FAIL`, owner approval
  required, 5 rollout steps, 11 metrics to collect, rollback and dry-run steps
  visible, zero console errors, and no private/key-shaped visible text. GitHub
  Actions CI run `26302990767` passed on `f51346f`.
- Brain UI Research Source Lock verification: local smoke and interaction
  smoke pass with `research-source-lock` evidence. Browser evidence reports 11
  public sources, 10 source-locked sources, 9 recent sources, 8 implementation
  rules, 3 benchmark targets, topic-path and stale-supersession rules,
  dashboard-to-cluster zoom, collapsed technical export, human-readable
  container labels, zero console errors, and no private/key-shaped visible
  text. GitHub Actions CI run `26304465466` passed on `e043d6b`.
- May 2026 model/autoresearch matrix gate verification: local release check,
  local full smoke, and GitHub Actions CI run `26305284384` passed on
  `13cbe8d`. The gate records Apple Silicon local defaults, Voyage/Gemini/NVIDIA
  challenger arms, env-only provider credentials, clean local runtime rules,
  query expansion disabled by default, and matched-canary-only public benchmark
  claims.
- Model/autoresearch release-gate hardening verification: GitHub Actions CI run
  `26305635737` passed on `22e17b1`. The release check now requires the model
  matrix and autoresearch plan and validates conservative provider, query
  expansion, local runtime, and no-secret guardrails.
- Brain UI Model Matrix verification: local smoke, interaction smoke, browser
  evidence, release readiness check, and Gemini focused review passed locally.
  Browser evidence reports 6 provider arms, 4 cloud arms, 2 local arms, Apple
  Silicon Qwen3 0.6B local default, Voyage/Gemini/NVIDIA cloud arms, query
  expansion off, env-only credentials, 5 gates, 3 blockers, zero console
  errors, and no private/key-shaped visible text. GitHub Actions CI run
  `26306469240` passed on `ff6f343`.
- Clean consumer smoke verification: a temporary public-style checkout ran
  `selfmem_update --help`, update smoke, Brain UI smoke, Brain UI interaction
  smoke, local-container audit smoke, local-session compaction audit,
  canary report/intake/diagnose/operator/packet checks, hosted/RecallWeave
  baseline fixture checks, and `npm pack --dry-run --json`. It verified
  required user-facing docs, updater files, built core runtime, Brain UI
  model-matrix fixture, zero forbidden runtime files, and zero key-shaped hits.
  GitHub Actions CI run
  `26306827655` passed on `4cee083`.
- Release blocker doctor verification: local `release:doctor` now checks the
  conservative release state, required blocker evidence, token-free remote URL,
  Claude concerns packet, GitHub 403 packet, and manual next-action list.
  It reports `publicLaunchAllowed: false` and `productionReady: false` by
  design, so green CI cannot be mistaken for public-launch approval. GitHub
  Actions CI run `26307335652` passed on `d93d781`.
- GitHub handoff packet verification: local `release:handoff` now generates a
  public-safe manual GitHub packet with PR body, status comment, blocker issue,
  labels, and manual GitHub steps. It writes no files, reports
  `privateLeakCount: 0`, keeps `productionReady: false`, and keeps the public
  launch verdict blocked while PR #5 and issue #6 remain visible as the live
  GitHub release-tracking surfaces. GitHub
  Actions CI run `26308475033` passed on `6a33e62`; dynamic follow-up CI run
  `26308588261` passed on `8efe4d0`.
- Goal completion audit verification: local `goal:audit` now maps the full
  active objective to current evidence. It reports `goalComplete: false`,
  `mayCallUpdateGoalComplete: false`, 20 proven requirements, 2 blocked
  requirements, and 1 incomplete requirement, preserving the human approval,
  hosted-baseline, and real-rollout blockers. GitHub Actions CI
  run `26308994908` passed on `13efb18`.
- Hosted baseline preflight verification: local `baseline:preflight` now checks
  the live Supermemory comparison contract without calling a hosted provider by
  default. It reports `callsHostedProvider: false`, `metricsOnly: true`,
  `hostedBaselineFresh: false`, and `benchmarkClaimsAllowed: false`, so future
  comparison claims need a sanitized live result plus reviewer approval.
  GitHub Actions CI run `26309563159` passed on `02b3a13`.
- Hosted baseline next-run verification: local `baseline:next-run` now turns
  partial hosted, RecallWeave, preflight, and comparison evidence into the next
  safe source-locked run plan. Fixture evidence stays `FIXTURE_PLAN_ONLY`,
  public launch stays disabled, and Gemini returned `CLEAN`.
- Canary evidence intake verification: local `canary:intake` accepts only
  metrics-only one-agent runtime canary reports. The bundled fixture reports
  lifecycle coverage, hybrid search coverage, local writes, read-through mode,
  p50/p95 latency, rollback readiness, and zero privacy leaks, but it also
  reports `fixtureOnly: true`, `countsAsRealRolloutEvidence: false`,
  `fleetRolloutAllowed: false`, and `publicLaunchAllowed: false`. GitHub
  Actions CI run `26310168571` passed on `d26eb78`.
- Canary report generator verification: local `canary:report -- --fixture`
  converts fixture Hermes/OpenClaw-style traces into a metrics-only report with
  hashed agent/container labels, lifecycle counts, hybrid-search coverage,
  p50/p95 recall and store latency, privacy counters, and rollback readiness.
  The fixture report remains `fixtureOnly: true` and fails `--strict-real`.
  GitHub Actions CI run `26310773948` passed on `6ae4ce7`.
- Canary diagnostic bundle verification: local `canary:report` now accepts
  redacted diagnostic directories and ZIP bundles, including metadata-only
  exports. The release gate zips a relocated fixture, confirms it still reports
  `fixtureOnly: true`, and confirms strict-real intake rejects it. GitHub
  Actions CI run `26311728246` passed on `77b3cee`.
- Canary remediation verification: local `canary:diagnose` turns failed
  metrics-only canary reports into safe remediation actions. The failing
  fixture reports `recall-p95` and `store-p95`, keeps fleet/public rollout
  blocked, and requires a fresh collection window after fixes. GitHub Actions
  CI run `26312283137` passed on `4f5a079`.
- Canary operator packet verification: local `canary:operator-packet` emits a
  public-safe Hermes/OpenClaw handoff with strict-real commands, attach-only
  metrics files, pass criteria, and forbidden raw artifacts. It is an operator
  aid, not rollout success.
- Real canary diagnostic evaluation: two redacted external Hermes diagnostic
  bundles were converted into temporary metrics-only reports. Both were real
  external inputs and privacy-clean. Both failed strict rollout intake on
  missing store latency and recall p95, so neither counts as real rollout
  evidence. This confirms the canary gate rejects weak real evidence rather
  than treating any diagnostic bundle as success.
- Current-head live browser evidence: the in-app browser rendered the Brain UI
  on `8777290` at `http://127.0.0.1:4189/`. The screenshot shows the Nucleus
  graph, lifecycle trail, lifecycle event card, retrieval trace card, and
  surrounding Brain surfaces. The page title is `RecallWeave Brain`, browser
  console error/warning count is 0, private/key-shaped visible text hits are 0,
  and the public launch verdict remains `FAIL`.

Automation rerun evidence from 2026-05-22T14:42Z is recorded in
`automation-rerun-20260522T1442Z.md`. That rerun passed the non-server fixture
smokes, tests, syntax checks, `git diff --check`, and a core package dry-run
with a repo-local npm cache. Fresh Brain UI server/browser checks remain
blocked in this automation sandbox by loopback `listen EPERM` and Browser
`file://` policy, so the packet continues to rely on the existing sanitized
fixture screenshots and DOM evidence for visual review.

## UI Evidence

Sanitized fixture evidence exists under
`reviews/overnight-20260522/ui-evidence/`:

- `brain-ui-fixture-edit.png`
- `brain-ui-vault-preview.png`
- `brain-ui-sync-report.png`
- `brain-ui-container-health.png`
- `brain-ui-local-audit.png`
- `brain-ui-selected-local-audit.png`
- `brain-ui-selected-audit-history.png`
- `brain-ui-selected-sync-dry-run.png`
- `brain-ui-lifecycle-policy.png`
- `brain-ui-review-queue.png`
- `brain-ui-local-memory-edit.png`
- `brain-ui-edit-export.png`
- `brain-ui-nucleus-snapshot.png`
- `brain-ui-research-lineage.png`
- matching DOM evidence JSON for the UI, vault preview, sync report, and edit
  draft export, plus Container Health, Local Audit Preflight, Nucleus snapshot,
  selected local-container audit, selected local-container browse, selected
  audit history, selected vault sync dry-run, lifecycle policy, memory review
  queue, and research-lineage previews
- `brain-ui-browser-dom-evidence.json`, captured by Codex Browser
  against browser evidence baseline `96ae9cc`; screenshot capture timed out and is recorded in
  the artifact
- selected vault sync apply controls are present in browser DOM evidence and
  interaction smoke proves writes require `RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_APPLY`
  plus the exact `APPLY LOCAL WIKI SYNC` phrase
- selected lifecycle policy apply controls are present in the current Brain UI
  source and interaction smoke proves writes require
  `RECALLWEAVE_BRAIN_UI_ENABLE_POLICY_APPLY` plus the exact
  `APPLY LOCAL LIFECYCLE POLICY` phrase
- selected review queue apply controls are present in the current Brain UI
  source and interaction smoke proves writes require
  `RECALLWEAVE_BRAIN_UI_ENABLE_REVIEW_APPLY` plus the exact
  `APPLY LOCAL REVIEW QUEUE` phrase
- selected local memory edit controls are present in Browser DOM evidence and
  interaction smoke proves writes require
  `RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_EDIT` plus the exact
  `APPLY LOCAL MEMORY EDIT` phrase
- selected local edit overlay browse evidence is present in Browser DOM
  evidence and interaction smoke proves a matching append-only overlay appears
  in the selected local-container browse without mutating `memories.jsonl`
- selected local memory materialize controls are present in Browser DOM
  evidence and interaction smoke proves safe overlays can be written into
  `memories.jsonl` with a backup and content-free audit log
- dynamic graph layout evidence records `dynamic-graph-layout`, 9 fixture
  nodes, 9 fixture edges, 2 columns, 5 rows, zero node overlaps, no console
  errors, and no private/key-shaped visible text
- graph navigation evidence records all-vs-neighborhood scope, 3 visible
  neighborhood nodes, 9 jump options, selected-node visibility, zero console
  errors, and no private/key-shaped visible text
- compaction audit evidence records metrics-only mode, 6 fixture input events,
  4 candidate fingerprints, 2 redactions, chronological output, 1
  exact-identifier candidate, zero privacy leaks, zero console errors, and no
  raw candidate text
- benchmark dashboard evidence records 5 of 5 fixture scenarios passed, 0
  failed scenarios, 0 privacy leaks, exact-identifier accuracy 1, average noise
  reduction 0.307, hosted-baseline caveat visible, zero console errors, and no
  private/key-shaped visible text
- canary rollout evidence records `READY_FOR_ONE_AGENT_CANARY`, one-agent
  scope, read-through-only hosted Supermemory mode, public launch verdict
  `FAIL`, owner approval required, rollback and dry-run steps visible, 11
  metrics to collect, zero console errors, and no private/key-shaped visible
  text
- research source lock evidence records 11 public sources, 10 source-locked
  sources, 9 recent sources, 8 implementation rules, topic/subtopic path,
  stale-memory supersession, budgeted lifecycle-frequency, and
  dashboard-to-cluster zoom rules, collapsed technical export, human-readable
  container labels, zero console errors, and no private/key-shaped visible text
- context preview evidence records the fixture prompt recall packet, 642 of 900
  context tokens used, 258 tokens remaining, 3 selected memories, 3 context
  sections, 2 omitted candidates, hosted read-through as read-only, local-only
  writes, zero privacy leaks, zero console errors, and no private/key-shaped
  visible text
- release readiness evidence records public launch verdict `FAIL`,
  `productionReady: false`, verified CI status, 16 proven preview surfaces, 5
  blockers, 5 manual actions, hosted write-back disabled, zero privacy leaks,
  zero console errors, and no private/key-shaped visible text
- release blocker doctor evidence records the same blocker list in
  machine-readable form, confirms no raw memories or credentials are needed,
  and prints the manual commands needed before public launch can be reconsidered
- current-head live browser evidence records a fresh rendered Brain UI
  screenshot and DOM-derived checks for Nucleus, wiki/vault sync, model matrix,
  context preview, release readiness, compaction audit, benchmark dashboard,
  canary rollout, research source lock, lifecycle trail, lifecycle event card,
  retrieval trace card, and `on_pre_compress` fixture text

The evidence uses bundled fixture data only. It does not show raw memories,
raw transcripts, credentials, private diagnostics, private agent paths, or real
local memory contents.

## Reviewer Evidence

- Gemini UI review: concerns found and applied in earlier UI slice.
- Gemini wiki/vault reviews: final `CLEAN`.
- Gemini wiki sync audit-log review: `CLEAN`.
- Gemini sync-report review: `CLEAN`.
- Gemini update-command review: first `BLOCK`, then final `CLEAN` after symlink
  resolution was fixed and tested.
- Gemini edit-export review: `CLEAN`.
- Gemini Container Health review: `CLEAN`, with a note that Gemini CLI produced
  transient routing warnings before returning the verdict.
- Gemini Brain UI local-audit preview review: `CLEAN`.
- Gemini Brain UI selected local-audit review: `CLEAN`.
- Gemini Brain UI selected local-container browse review: `CLEAN`.
- Gemini Brain UI selected audit-history review: `CLEAN`.
- Gemini Brain UI selected vault sync dry-run review: `CLEAN`.
- Gemini selected vault sync apply review: first `BLOCK`, then final `CLEAN`
  after explicit lint checking and visible path fields were added.
- Gemini Brain UI lifecycle policy review: `CLEAN`.
- Gemini Brain UI lifecycle policy apply review: first `BLOCK` for missing env
  gate docs, then final `CLEAN` after `docs/BRAIN_UI.md` documented the apply
  path.
- Gemini Brain UI review queue review: `CLEAN`.
- Gemini Brain UI review queue apply review: `CLEAN`.
- Gemini Brain UI local memory edit review: `CLEAN`.
- Gemini Brain UI local edit overlay browse review: `CLEAN`.
- Gemini Brain UI local memory materialize review: `CLEAN`.
- Gemini Brain UI context preview review: `CLEAN`, with a note that Gemini CLI
  produced transient capacity warnings before returning the verdict.
- Gemini Brain UI benchmark dashboard review: `CLEAN`, with a note that Gemini
  CLI produced transient capacity warnings before returning the verdict.
- Gemini Brain UI canary rollout review: `CLEAN`.
- Gemini Brain UI research source lock review: `CLEAN`.
- Gemini Brain UI model matrix review: `CLEAN`.
- Gemini Brain UI release readiness review: `CLEAN`, with a note that Gemini
  CLI produced transient capacity warnings before returning the verdict.
- Gemini Nucleus snapshot review: first `CONCERNS`, then final `CLEAN` after
  object-key redaction was fixed and smoke-guarded.
- Gemini research-lineage review: `CLEAN`.
- Gemini Brain UI interaction-smoke review: `CLEAN`.
- Gemini browser evidence gate review: `CLEAN`.
- Gemini local-container audit review: `CLEAN`.
- Gemini public live-update copy review: `CLEAN`.
- Gemini completion-audit review: first `BLOCK` because the audit was untracked
  and absent from the diff, then final `CLEAN` after staging.
- Gemini session compaction local audit review: `CLEAN`.
- Gemini blocker-permission refresh review: `CLEAN`.
- Gemini release-state guard review: `CLEAN`.
- Gemini release-handoff review: `CLEAN`.
- Gemini clean consumer smoke review: `CLEAN`.
- Gemini release blocker doctor review: `CLEAN`.
- Gemini current-head live browser review: `CLEAN`.
- Gemini production-readiness review: blocked by CLI browser authentication.
- Claude CLI route: blocked because Claude CLI is not logged in. See
  `reviews/overnight-20260522/claude-pr5-review-blocked.md`.

## Safety Boundaries

- No credentials are committed.
- No raw memory files are committed.
- No raw transcripts are committed.
- No diagnostics zips are committed.
- No hosted Supermemory write-back is enabled.
- Brain UI writes are fixture-only. The draft export states
  `writesRealFiles: false`.
- Brain UI model helpers are covered by a repeatable interaction smoke for
  search, retrieval traces, draft export, Nucleus export, research lineage,
  vault path selection, sync reporting, and private/key-shaped edit rejection.
- Local-container audit preflight is read-only, redacts the selected root path,
  returns counts and health reasons only, and never returns raw memory/event
  text.
- Brain UI local-audit preview uses a temporary fixture container and displays
  counts/reasons only.
- Brain UI selected local-audit mode is disabled by default, requires read-only
  confirmation, clears the typed path, and displays only a redacted
  `.../container` label.
- Brain UI selected local-container browse is disabled by default, requires
  read-only confirmation, clears the typed path, returns bounded redacted
  memory/trace snippets, skips fully private entries, and writes no files.
- Brain UI local edit overlay browse surfaces matching append-only edit
  overlays beside selected local-container browse entries using redacted
  previews only, and still writes no files.
- Brain UI selected local memory materialize is disabled by default, requires
  the local materialize environment flag, requires write confirmation plus an
  exact phrase, writes a backup, applies supported safe overlays to
  `memories.jsonl`, appends a content-free audit line, skips private/key-shaped
  overlays, and returns only redacted root labels and relative paths.
- Brain UI selected audit history is browser-local and stores only redacted
  labels, counts, status, event name, and timestamp.
- Brain UI selected vault sync dry-run is disabled by default, requires
  read-only confirmation, clears the typed path, returns only a redacted root
  label plus relative action counts, and writes no wiki files.
- Brain UI selected vault sync apply is disabled by default, requires the local
  apply environment flag, requires write confirmation plus an exact phrase,
  writes only compiled wiki files, and emits content-free audit-log entries.
- Brain UI lifecycle policy preview is fixture-only. It stages recall/write
  settings as `writesRealFiles: false` draft output and does not edit host
  config files.
- Brain UI selected lifecycle policy apply is disabled by default, requires the
  policy apply environment flag, requires write confirmation plus an exact
  phrase, rejects private/key-shaped policy payloads, writes only a sanitized
  selected local `.recallweave/lifecycle-policy.json` plus a content-free audit
  line, and returns only redacted root labels and relative paths.
- Brain UI memory review queue is fixture-only. It stages approve, suppress,
  merge, and needs-more-evidence decisions as `writesRealFiles: false` draft
  output and does not write real memories.
- Brain UI selected memory review queue apply is disabled by default, requires
  the review apply environment flag, requires write confirmation plus an exact
  phrase, rejects private/key-shaped review payloads, writes only selected
  local decision metadata plus a content-free audit line, excludes candidate
  text, and returns only redacted root labels and relative paths.
- Brain UI selected local memory edit is disabled by default, requires the
  local edit environment flag, requires write confirmation plus an exact
  phrase, rejects private/key-shaped edit payloads, writes only an append-only
  local edit overlay plus a content-free audit line, does not mutate
  `memories.jsonl` in place, and returns only redacted root labels and relative
  paths.
- Wiki vault sync is explicit and protects reviewed pages by writing conflict
  notes instead of overwriting.
- Wiki vault sync can append a content-free pre-write audit log when
  `auditLogPath` is supplied.
- `selfmem_update` is dry-run by default and requires `--apply` before copying
  files.
- `selfmem_update --run-canary --strict-real` now requires a live mapped
  container or an explicit diagnostic source. Adapter standalone smoke alone
  cannot satisfy strict-real rollout evidence.

## Residual Risks

- Claude review is blocked until Claude CLI is logged in.
- This 2026-05-22 automation rerun created branch
  `automation/recallweave-overnight-20260522-2315` and added only the static
  Brain UI evidence fallback. In this sandbox, server-backed Brain UI smoke,
  interaction smoke, clean consumer smoke, GitHub live sync, and release check
  are still blocked by `listen EPERM` on `127.0.0.1` or DNS failure for
  GitHub. The static evidence check is a fallback signal, not a production or
  launch gate replacement.
- The Brain UI has read-only selected local-container audit and browse previews,
  browser-local audit history, plus write-confirmed selected vault sync apply,
  write-confirmed selected lifecycle policy apply, and write-confirmed selected
  review queue apply, plus write-confirmed selected local memory edit overlays
  with read-only overlay browse visibility and guarded materialization.
  Freeform in-place local memory mutation remains disabled outside the guarded
  materialize path.
- The compaction benchmark uses public fixtures. Private local Codex or Claude
  session-history runs must stay local and may commit only aggregate metrics or
  reusable tooling. The local-session compaction audit now provides that
  metrics-only path without candidate text.
- Benchmark comparison against hosted Supermemory is not a release claim. The
  current public docs correctly require a fresh valid metrics-only baseline
  accepted by the hosted baseline preflight, then routed through the next-run
  planner, before quality marketing.
- The post-12-hour production-ready verdict remains `FAIL` for public launch.
  Fresh controller and CI checks pass, Claude Opus returned `CONCERNS`, PR #5
  and issue #6 are live, and a human release decision has not been made. Use
  the generated GitHub handoff packet as the manual GitHub source of truth
  while that remains true. Use the goal completion audit before any future
  attempt to mark the native goal complete.

## Next Recommended Slice

Use `reviews/overnight-20260522/issue-drafts/blocker-fresh-brain-ui-launch-and-release-gate.md`
as the conservative issue text unless PR #5 is updated directly. Run
`release:handoff` first for the current manual GitHub packet. Do not publish a
live update until human approval, hosted-baseline evidence, and real canary
evidence are resolved.
