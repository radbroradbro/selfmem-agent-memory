# Hosted Baseline Next-Run Evidence

Date: 2026-05-23

Scope:

- Added `packages/bench/hosted-baseline-next-run.mjs`.
- Added `baseline:next-run` as a package script and smoke step.
- Wired the planner into clean-consumer smoke, release readiness, goal audit,
  public docs, and release-state surfaces.
- The planner turns current hosted, RecallWeave, preflight, and comparison
  state into one state-aware next-run packet.
- The planner now includes the same safe hosted-container discovery and
  private-map opt-in flow as the operator packet.
- The planner now includes `validate-query-set`, which runs
  `baseline:queryset --strict` and writes a metrics-only query-set report before
  hosted or local collection.
- It calls no hosted provider, writes no files, and never authorizes public
  benchmark claims or public launch.

Commands:

```bash
node --check packages/bench/hosted-baseline-next-run.mjs
node packages/bench/hosted-baseline-next-run.mjs
node packages/bench/hosted-baseline-next-run.mjs --format markdown
node packages/bench/consumer-install-smoke.mjs
```

Observed fixture-plan output:

```json
{
  "status": "FIXTURE_PLAN_ONLY",
  "mode": "hosted-baseline-next-run",
  "publicLaunchAllowed": false,
  "plannerAuthorizesPublicClaims": false,
  "commandCount": 10,
  "privacyLeakCount": 0,
  "sameQuerySet": true
}
```

Expected behavior:

- JSON mode reports `mode: hosted-baseline-next-run`.
- Markdown mode prints a paste-ready hosted-baseline next-run plan.
- `writesRealFiles` is false.
- `callsHostedProvider` is false.
- `metricsOnly` is true.
- Fixture hosted and RecallWeave results remain `FIXTURE_PLAN_ONLY`.
- Fixture evidence can validate parser behavior but cannot close the hosted
  baseline blocker.
- The command plan includes hosted container discovery, optional local-only
  private map creation, query-set validation, hosted collection, hosted
  validation, RecallWeave export, RecallWeave aggregate collection, matched
  comparison, and strict-real evidence packaging.
- Acceptance criteria require every query to have at least one expected result
  id or expected content hash, with `querySetEvidence.publicBenchmarkReady`
  true for both result files.
- It forbids provider keys, raw hosted memories, raw local memories,
  transcripts, prompts, answers, cookies, bearer tokens, private local paths,
  private container maps, unredacted diagnostics, and raw RecallWeave exports
  containing memory text.
- Clean-consumer smoke now runs the planner from a packaged checkout without
  `.git` metadata and reports zero forbidden runtime files and zero secret
  hits.

Boundary:

- This planner does not run a live hosted baseline.
- This planner does not close the hosted-baseline blocker.
- Public comparison claims still require non-fixture hosted and RecallWeave
  results, matching query-set and scoring-code hashes, labeled query sets, a
  RecallWeave win, and two independent reviewer approvals.
