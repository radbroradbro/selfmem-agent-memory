# Production Readiness

Date: 2026-05-24

Verdict: FAIL

RecallWeave is not ready for a public live update. The current PR branch has
strong alpha evidence for the LLM-wiki/Nucleus/Brain UI direction, and the new
LongMemEval-S autoresearch lane is useful methodology work, but this gate still
does not have enough current proof to authorize a production launch.

## Current Trail

- Public repo: <https://github.com/radbroradbro/selfmem-agent-memory>
- PR: <https://github.com/radbroradbro/selfmem-agent-memory/pull/5>
- PR state verified through the GitHub connector on 2026-05-24: open, not
  draft, mergeable.
- PR base: `main` at `f4981733a39cf9f09f3f87cac04e9b76a896e38b`.
- Current inspected branch: `automation/recallweave-post12h-launch-review-20260524-tmp`.
- Current inspected HEAD: `e7fa56a13bb761c916e15388af50351ba380323e`.
- Blocker issue verified through the GitHub connector on 2026-05-24:
  <https://github.com/radbroradbro/selfmem-agent-memory/issues/6>, open.
- CI run for `e7fa56a13bb761c916e15388af50351ba380323e`:
  `26349083689`, passed on the PR branch.

## What Actually Shipped Or Was Proposed

The current PR branch proposes the RecallWeave alpha surface, not a completed
production launch:

- Nucleus Index contracts for sanitized memory, lifecycle, retrieval trace,
  wiki, research lineage, decision, and evidence nodes.
- LLM-wiki compile and sync flows with frontmatter, wikilinks, provenance,
  linting, conflict handling, and content-free audit logs.
- Fixture-first self-hosted Brain UI for search, graph/index navigation,
  provenance, lifecycle/retrieval trace inspection, derived-doc editing,
  selected vault sync dry-run, selected vault sync apply, selected
  local-container browse, lifecycle policy, selected lifecycle policy apply,
  memory review queue, selected review queue apply, selected local memory edit,
  local edit overlays, release readiness, benchmark dashboard, and context
  preview.
- Hosted-baseline and canary evidence gates that keep hosted Supermemory
  write-back off and keep private hosted/local inputs out of git.
- Metrics-only hosted baseline, reviewer-intake, returned-packet, canary drill,
  canary packet, returned-inbox/downloads/watch, and next-agent packet tooling.
- Public benchmark scaffolding for source-locked LongMemEval-S and a
  retrieval-proxy autoresearch lane.

The current preview surface names are: selected vault sync dry-run, selected vault sync apply, selected local-container browse, lifecycle policy, selected lifecycle policy apply, memory review queue, selected review queue apply, selected local memory edit, edit overlay browse, materialization, dynamic graph layout, graph navigation, compaction audit, benchmark dashboard, canary rollout, canary report generator, canary evidence intake, canary diagnose, operator packet, canary evidence packet, research source lock, model matrix, and context preview.

The current operational evidence names are: release readiness, current-head live browser evidence, clean consumer smoke, release blocker doctor, hosted baseline preflight, hosted baseline collector, baseline compare, hosted baseline operator packet, baseline evidence packet, GitHub handoff packet, GitHub live sync, and goal completion audit.

The latest inspected benchmark evidence promotes the LongMemEval-S autoresearch
winner into the checked-in retrieval-proxy run. It reports
`retrievalProxyOnly: true`, `memoryBenchAnswerQuality: false`,
`publicBenchmarkClaimsAllowed: false`, 24 arms, and `bm25-lite-b800-k5` as the
current canary setting. This is methodology evidence only, not public
superiority language.

## Checks Run In This Gate

Passed locally:

- `npm run build`
- `npm run test`: 6 test files, 22 tests
- `npm run typecheck`
- `npm run privacy:test`: 5 tests
- `npm run smoke:openclaw`: `privacyLeakCount: 0`
- `npm run smoke:hermes`: `privacyLeakCount: 0`
- `node packages/brain-ui/static-evidence.mjs`: 9 nodes, 9 edges,
  `privacyLeakCount: 0`, release verdict `FAIL`
- `node packages/bench/hosted-baseline-preflight.mjs`: no hosted provider call,
  hosted write-back disabled, claims blocked
- `node packages/bench/goal-completion-audit.mjs`: `goalComplete: false`;
  human approval and real-container rollout remain unresolved
- `npm exec --yes pnpm@10.23.0 -- release:check`: passed, including fresh
  Brain UI smoke, fresh Brain UI interaction smoke, clean consumer smoke,
  release blocker doctor, GitHub live sync, goal completion audit, secret scan,
  and public-doc private-path scan
- `npm exec --yes pnpm@10.23.0 -- release:github-sync`: passed; live PR and
  issue text match the checked-in public-safe drafts by hash
- `git diff --check`
- Secret-pattern scan across the worktree, excluding dependencies/generated
  artifacts: zero hits
- `npm pack --dry-run` from `packages/core`: passed with a writable temporary
  npm cache

Blocked or unresolved locally:

- Claude reviewer: blocked, `Not logged in`.
- Gemini reviewer: blocked, requested browser authentication and timed out
  without producing a review.
- No strict-real production canary packet was accepted.
- No owner approval was recorded for merge, visibility change, release note, or
  public live update.

## Browser And UI Evidence

Fresh UI evidence is clean and useful, but it is not enough for a public live
update:

- Static evidence proves the fixture Nucleus graph, graph/timeline/provenance
  sections, lifecycle trail, benchmark dashboard, canary rollout, context
  preview, release readiness, wiki vault, local edit, local materialize, and
  selected audit renderers are present.
- The static evidence reports no privacy leaks and keeps hosted write-back off.
- Fresh Brain UI smoke and interaction smoke passed through the release gate.
- Existing screenshot evidence under
  `reviews/overnight-20260522/ui-evidence/` remains sanitized fixture evidence,
  not proof of a current live production surface.

## Readiness Grades

- Security/privacy: PASS WITH CONCERNS. Local scans found zero secret-pattern
  hits, public docs have zero private-path hits, and fixture evidence reports
  zero privacy leaks.
- Install/update ergonomics: PASS WITH CONCERNS. Local build/test/package dry
  run and clean consumer smoke passed.
- Local-first memory correctness: PASS WITH CONCERNS. Fixture and metrics-only
  gates are strong; a real-container rollout is still incomplete.
- LLM-wiki integrity: PASS WITH CONCERNS. Nucleus/wiki contracts and smoke
  evidence exist, but production rollout still needs a strict real-container
  canary.
- UI usefulness: PASS WITH CONCERNS. Static evidence plus fresh Brain UI smoke
  and interaction smoke passed, but evidence remains fixture/sanitized rather
  than production canary proof.
- Docs clarity: PASS WITH CONCERNS. Public docs keep benchmark and launch
  claims conservative.
- Test coverage: PASS WITH CONCERNS. Unit, privacy, adapter, UI, consumer, and
  release checks pass; strict-real canary coverage is still missing.
- Rollback safety: PASS WITH CONCERNS. Canary drill, packet, returned evidence,
  and next-agent workflows exist, but the real-container production canary has
  not passed.

## Residual Risks And Blockers

- Human owner approval is still required before merge, visibility changes, or
  public release language.
- A real-container production canary remains incomplete.
- External reviewer routes were blocked in this environment, so no fresh
  Claude/Gemini approval was collected.
- The LongMemEval-S autoresearch result is retrieval-proxy methodology
  evidence only and must not be marketed as MemoryBench answer quality or broad
  memory-system superiority.

## Next Trail Item

Keep PR #5 and issue #6 as the active public trail. The next unblocker is one
strict real-container canary packet that passes returned-packet intake, plus
owner approval for any merge, visibility change, release note, or public live
update.

This gate does not authorize public launch.
