# PR Body Update Draft

Live status:

- PR #5 body was updated from this public-safe source on 2026-05-22.
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
- Adds `selfmem_update`, clean consumer smoke coverage, release blocker doctor, GitHub handoff packet, goal completion audit, hosted baseline preflight, canary evidence intake, canary report generator from trace/diagnostic exports, and `canary:diagnose` remediation guidance for failed reports. The updater now refuses `--strict-real` canary success unless a live mapped container or explicit diagnostic source produces a runtime report.
- Adds a GitHub live sync check so PR #5 and blocker issue #6 can be compared against checked-in public-safe drafts without printing body text or credentials.
- Adds real diagnostic canary evaluation evidence from two redacted external Hermes bundles. Both were metrics-only and privacy-clean, and both failed strict rollout intake, so they do not count as production rollout evidence.
- Bounds Hermes and OpenClaw hosted Supermemory read-through so canaries can prove local-first recall, explicit old-memory lookup, skip reasons, and total/local/remote latency without making every prompt wait on hosted search.
- Keeps public launch conservative: fixture evidence is allowed, real private memory text is not committed, and benchmark claims stay blocked until a matched source-locked canary or hosted baseline passes with reviewer sign-off.

## Current Verdict

Not production ready for public launch yet.

The code, fixture UI, release gate, CI, and Claude Opus review are healthy enough for an alpha PR, but launch remains blocked on human approval, hosted Supermemory baseline evidence for public comparison claims, and one real-container production canary.

## Latest Verified Baseline

- Latest code/product baseline: `6a8bbf09ef6e24ed12c30e0fcff1fe185100e907`.
- GitHub Actions run `26316450928`: passed CI after the Brain UI lifecycle trail evidence refresh.
- Previous verified baseline before the latest lifecycle trail evidence refresh:
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
- `node packages/bench/canary-evidence-intake.mjs`: passed in fixture mode and rejects raw memories/transcripts/prompts.
- `node packages/bench/canary-report-from-trace.mjs`: passed for trace fixtures and redacted diagnostic export fixtures.
- `npm exec --yes pnpm@10.23.0 -- canary:diagnose`: passed, producing metrics-only remediation guidance for a failing canary report.
- `npm exec --yes pnpm@10.23.0 -- smoke:openclaw`: passed with bounded read-through policy and local/remote/total recall timing assertions.
- `npm exec --yes pnpm@10.23.0 -- smoke:hermes`: passed with bounded read-through policy and local/remote/total recall timing assertions.
- `git diff --check`: clean.
- Changed-file secret and private-name scans: no actual key or private memory hits.

## Release Blockers

- Claude/Opus review completed with `CONCERNS`; it supports alpha PR review only and does not approve public launch.
- Human approval is required before merge, visibility changes, or public release messaging.
- Hosted Supermemory comparison claims require a fresh metrics-only baseline.
- One real-container production rollout remains incomplete; fixture UI and canary tooling are not enough for public launch.
- Two redacted real diagnostic bundles have been evaluated and rejected by the strict rollout gate. A fresh patched one-agent canary must pass before this blocker can close.

## Evidence Packet

Primary evidence lives under `reviews/overnight-20260522/` and is intentionally fixture-first and metrics-only. Do not treat fixture scores or private local experiments as public benchmark claims.
```
