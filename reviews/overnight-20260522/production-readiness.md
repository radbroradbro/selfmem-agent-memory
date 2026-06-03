# Production Readiness

Date: 2026-05-24

Verdict: FAIL

RecallWeave is not ready for a public live update. The current PR candidate has
strong public-alpha evidence for the LLM-wiki, Nucleus Index, Brain UI,
canary, hosted-baseline, and public-benchmark directions, but this gate still
lacks current proof for launch-critical checks.

## Current Trail

- Public repo: <https://github.com/radbroradbro/selfmem-agent-memory>
- Active PR trail: <https://github.com/radbroradbro/selfmem-agent-memory/pull/5>
- Active blocker issue trail:
  <https://github.com/radbroradbro/selfmem-agent-memory/issues/6>
- Current inspected branch:
  `automation/recallweave-post12h-launch-review-20260524-ce38`
- Current inspected HEAD: `2bd4bc986289cdade812c6264b7dd82950682849`
- Current gate time: `2026-05-24T05:00:47Z`

Shell GitHub verification could not refresh PR or issue state in this sandbox
because `api.github.com` DNS resolution failed. Existing checked-in GitHub
sync evidence remains historical evidence, not a fresh live confirmation for
this gate.

## What Actually Shipped Or Was Proposed

The current PR candidate proposes a fixture-first RecallWeave alpha surface,
not a completed production rollout:

- Nucleus Index contracts for sanitized memory, lifecycle, retrieval trace,
  wiki, research lineage, decision, source, and evidence nodes.
- LLM-wiki compile and sync flows with frontmatter, wikilinks, central index
  and log pages, provenance, conflict handling, and content-free audit logs.
- Fixture-first Brain UI coverage for search, graph/index navigation,
  provenance, lifecycle/retrieval trace inspection, derived-doc editing,
  selected vault sync dry-run, selected vault sync apply, selected
  local-container browse, selected local memory edit and materialize,
  lifecycle policy, selected lifecycle policy apply, memory review queue,
  selected review queue apply, release readiness, benchmark dashboard, and
  context preview.
- Hosted-baseline and canary evidence gates that keep hosted Supermemory
  write-back off and keep private hosted/local inputs out of git.
- Public benchmark scaffolding for source-locked LongMemEval-S and
  retrieval-proxy autoresearch work. This remains methodology evidence only;
  public benchmark claims are still blocked without owner-reviewed same-data
  evidence and reviewer sign-off.

Current preview surface names include: selected vault sync dry-run, selected vault sync apply, selected local-container browse, lifecycle policy, selected lifecycle policy apply, memory review queue, and selected review queue apply.
Full preview/check surface inventory includes: selected vault sync dry-run, selected vault sync apply, selected local-container browse, lifecycle policy, selected lifecycle policy apply, memory review queue, selected review queue apply, selected local memory edit, edit overlay browse, local memory materialize, dynamic graph layout, graph navigation, compaction audit, benchmark dashboard, canary rollout, canary report generator, canary evidence intake, canary diagnose, operator packet, canary evidence packet, research source lock, model matrix, context preview, release readiness, and current-head live browser evidence.
Operational evidence surfaces include: clean consumer smoke, release blocker doctor, hosted baseline preflight, hosted baseline collector, baseline compare, hosted baseline operator packet, baseline evidence packet, update flow release packet, GitHub live sync, and goal completion audit.

## Checks Run In This Gate

Passed in this sandbox:

- `npm run build`
- `npm run test`: 6 test files, 22 tests
- `npm run typecheck`
- `npm run privacy:test`: 5 tests
- `npm run smoke:openclaw`: `privacyLeakCount: 0`
- `npm run smoke:hermes`: `privacyLeakCount: 0`
- `npm run brain:evidence:static`: fixture graph has 9 nodes, 9 edges,
  expected Nucleus/wiki/provenance/lifecycle/retrieval/edit controls,
  `hostedWriteBackEnabled: false`, `privacyLeakCount: 0`, and
  `productionReady: false`
- `npm run goal:audit`: `goalComplete: false`,
  `mayCallUpdateGoalComplete: false`, 36 proven requirements, 1 blocked
  requirement, and 1 incomplete requirement
- `npm pack --dry-run` from `packages/core`: passed and produced
  `recallweave-core-0.1.0-alpha.0.tgz`
- `git diff --check`
- The passing portions of `npm run release:check`: required files/scripts,
  release docs, conservative release state, public benchmark source locks,
  local session audit, batch audit, static Brain UI evidence, local container
  audit smoke, adapter store-latency instrumentation, canary report/intake/
  drill/packet/returned-packet gates, hosted-baseline preflight, release update
  packet, goal audit, remote-token check, core dry-run pack, forbidden runtime
  file scan, secret scan, and public docs/evidence private-path scan.

Blocked or failed in this sandbox:

- `npm_config_cache=/tmp/npm-cache npm exec --yes pnpm@10.23.0 -- install
  --frozen-lockfile --offline`: failed because `registry.npmjs.org` DNS
  resolution failed before pnpm could be fetched.
- `npm run brain:smoke:built`: failed with `listen EPERM` on `127.0.0.1`.
- `npm run brain:interaction:built`: failed with `listen EPERM` on
  `127.0.0.1`.
- `npm run release:check`: failed because fresh Brain UI smoke, fresh Brain UI
  interaction smoke, clean consumer smoke, release blocker doctor, and GitHub
  live sync could not pass in this environment.
- `npm run release:github-sync`: failed because `api.github.com` DNS
  resolution failed.
- Browser file navigation to the Brain UI was rejected by Browser Use URL
  policy, so this run captured no fresh browser screenshot or recording.
- Claude reviewer route: blocked, `Not logged in`.
- Gemini reviewer route: blocked at browser authentication prompt and produced
  no review.

## Browser And UI Evidence

Current UI evidence is useful but not launch-grade:

- Static Brain UI evidence passed and remained fixture-only.
- Existing screenshot evidence under the checked-in UI evidence packet remains
  sanitized fixture evidence from prior runs.
- This run could not produce fresh localhost/browser evidence because the
  sandbox could not bind `127.0.0.1` and Browser Use rejected direct file
  navigation.

## Readiness Grades

- Security/privacy: PASS WITH CONCERNS. Current scans and fixture evidence
  report zero secret/private hits, but launch still needs fresh live sync and
  real-canary proof.
- Install/update ergonomics: FAIL FOR THIS GATE. Local build/package checks
  pass, but dependency refresh and consumer smoke were not proven here.
- Local-first memory correctness: PASS WITH CONCERNS. Fixture and metrics-only
  gates are strong; real-container rollout remains incomplete.
- LLM-wiki integrity: PASS WITH CONCERNS. Contracts and fixture smoke evidence
  exist; production rollout still needs strict real-container canary evidence.
- UI usefulness: FAIL FOR THIS GATE. Static fixture evidence is good, but fresh
  live localhost/browser evidence failed or was blocked.
- Docs clarity: PASS WITH CONCERNS. Public docs keep claims conservative.
- Test coverage: PASS WITH CONCERNS. Unit, privacy, adapter, fixture, canary,
  baseline, and benchmark guard coverage is broad; live UI, live GitHub, and
  strict-real canary coverage are still unresolved in this run.
- Rollback safety: PASS WITH CONCERNS. Canary drill, packet, returned evidence,
  and next-agent workflows exist; real-container production canary has not
  passed.

## Residual Risks And Blockers

- Human owner approval is still required before merge, visibility change,
  release note, or public live update.
- A strict-real, non-fixture one-agent production canary packet is still
  missing.
- Fresh live Brain UI localhost smoke, interaction smoke, and browser evidence
  did not pass in this environment.
- Fresh live GitHub sync did not pass in this environment.
- Fresh Claude/Gemini reviewer approval was not collected.
- Public benchmark language must remain limited to retrieval-proxy,
  fixture-safe, or owner-reviewed metrics-only evidence.

## Next Trail Item

Keep PR #5 and issue #6 as the active public trail. The next unblocker is a
strict real-container canary packet that passes returned-packet intake, plus an
environment that can run localhost Brain UI smoke and GitHub live sync, followed
by owner approval for any merge, visibility change, release note, or public
live update.

This gate does not authorize public launch.
