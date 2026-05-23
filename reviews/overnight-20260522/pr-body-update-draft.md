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
- Adds `selfmem_update`, clean consumer smoke coverage, release blocker doctor, GitHub handoff packet, goal completion audit, hosted baseline preflight, a read-only hosted baseline collector, a RecallWeave response exporter, a RecallWeave baseline collector, a matched baseline comparison gate, a hosted baseline operator packet, a state-aware hosted baseline next-run planner, `baseline:packet` metrics-only zip packaging for hosted baseline evidence, canary evidence intake, strict-real fail-closed JSON output, strict v1 adapter contract markers, updater adapter digest verification, canary report generator from trace/diagnostic exports, `canary:diagnose` remediation guidance for failed reports, a public-safe canary operator packet, `canary:packet` metrics-only zip packaging for report/intake/diagnosis files, `canary:packet:review` validation for received canary zips, `canary:batch-audit` controller triage for folders of redacted diagnostic bundles, mixed-folder `--allow-failed-inputs` triage for returned diagnostic sets, `canary:next-agent` one-agent update planning from batch results, and `canary:next-agent-packet` public-safe zip packaging for the selected one-agent handoff. The updater now refuses `--strict-real` canary success unless a live mapped container or explicit diagnostic source produces a runtime report.
- Adds a GitHub live sync check so PR #5 and blocker issue #6 can be compared against checked-in public-safe drafts without printing body text or credentials.
- Extends the release blocker doctor so agents see the same three unresolved blockers as the goal audit: human approval, fresh hosted baseline, and fresh real-agent canary evidence.
- Adds output-file-safe baseline and canary evidence commands so package-manager banners cannot corrupt JSON artifacts or leak local checkout paths into preflight, comparison, intake, diagnosis, batch-audit, or next-agent plan files.
- Adds real diagnostic canary evaluation evidence from redacted external Hermes/OpenClaw bundles. The latest batch audit parsed 8 of 9 returned diagnostics, found zero strict-real passes, ranked the closest privacy-clean candidate, and generated a public-safe OpenClaw next-agent handoff plus a single sendable handoff packet; it still failed adapter-contract and store-latency checks, so it does not count as production rollout evidence.
- Bounds Hermes and OpenClaw hosted Supermemory read-through so canaries can prove local-first recall, explicit old-memory lookup, skip reasons, and total/local/remote latency without making every prompt wait on hosted search.
- Adds fresh canary window isolation so strict-real reports can ignore pre-patch trace history, stale errors, and old missing-latency events after a patched adapter is applied.
- Keeps public launch conservative: fixture evidence is allowed, real private memory text is not committed, and benchmark claims stay blocked until a matched source-locked canary or hosted baseline passes with reviewer sign-off.

## Current Verdict

Not production ready for public launch yet.

The code, fixture UI, release gate, CI, and Claude Opus review are healthy enough for an alpha PR, but launch remains blocked on human approval, hosted Supermemory baseline evidence for public comparison claims, and one real-container production canary.

## Latest Verified Baseline

- Latest code/product baseline: `8f5910d49a6f1fe4d8967e014c5dd8e1df3e7b6e`.
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
- `npm exec --yes pnpm@10.23.0 -- baseline:operator-packet`: passed, producing a public-safe hosted baseline handoff without calling a hosted provider.
- `npm exec --yes pnpm@10.23.0 -- baseline:next-run`: passed, producing a state-aware hosted-baseline next-run plan that keeps fixture evidence as `FIXTURE_PLAN_ONLY` and does not authorize public claims.
- `npm exec --yes pnpm@10.23.0 -- baseline:packet`: passed and produced a metrics-only zip with no hosted memories, local memories, transcripts, prompts, answers, keys, or private paths.
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
- `npm exec --yes pnpm@10.23.0 -- canary:operator-packet`: passed with fresh-window timestamp instructions.
- `npm exec --yes pnpm@10.23.0 -- canary:packet`: passed and produced a metrics-only zip with no raw memories, transcripts, prompts, answers, keys, or private paths.
- `npm exec --yes pnpm@10.23.0 -- canary:batch-audit`: passed on the fixture batch, failed closed with `--require-real-pass`, supported explicit mixed-folder `--allow-failed-inputs` triage, and triaged the available redacted real diagnostics without exposing raw content.
- `reviews/overnight-20260522/real-next-agent-openclaw-canary-plan.md`: added a paste-ready OpenClaw fresh-window canary handoff selected from redacted metrics-only evidence.
- `npm exec --yes pnpm@10.23.0 -- canary:next-agent`: passed on the fixture planner and converted the real redacted batch into a one-agent OpenClaw fresh-window plan focused on adapter-contract and store-latency evidence.
- Fresh canary window synthetic diagnostic: passed, proving old pre-patch errors and store events outside `--since` do not poison strict-real intake.
- `npm exec --yes pnpm@10.23.0 -- smoke:openclaw`: passed with bounded read-through policy and local/remote/total recall timing assertions.
- `npm exec --yes pnpm@10.23.0 -- smoke:hermes`: passed with bounded read-through policy and local/remote/total recall timing assertions.
- `git diff --check`: clean.
- Changed-file secret and private-name scans: no actual key or private memory hits.

## Release Blockers

- Claude/Opus review completed with `CONCERNS`; it supports alpha PR review only and does not approve public launch.
- Human approval is required before merge, visibility changes, or public release messaging.
- Hosted Supermemory comparison claims require a fresh metrics-only baseline routed through the next-run planner.
- One real-container production rollout remains incomplete; fixture UI and canary tooling are not enough for public launch.
- The available redacted real diagnostic bundle set has been evaluated and rejected by the strict rollout gate. A fresh patched one-agent canary must pass before this blocker can close.
- Gemini returned `CLEAN` on the fresh-window diff. Claude CLI review for that narrow diff returned no usable stdout and is recorded as blocked, not as approval.

## Evidence Packet

Primary evidence lives under `reviews/overnight-20260522/` and is intentionally fixture-first and metrics-only. Do not treat fixture scores or private local experiments as public benchmark claims.
```
