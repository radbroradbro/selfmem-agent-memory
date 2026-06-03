# Baseline Query-Set Inspect Evidence

Date: 2026-05-23

Scope:

- Added `packages/bench/baseline-queryset-inspect.mjs`.
- Added `baseline:queryset` as a package script and smoke step.
- Wired the query-set inspector into the hosted baseline operator packet,
  hosted baseline next-run planner, clean-consumer smoke, and release readiness
  gate.
- The inspector proves a source-locked query set is relevance-labeled without
  printing raw query text, raw expected ids, raw expected hashes, provider keys,
  or private paths.

Commands:

```bash
node --check packages/bench/baseline-queryset-inspect.mjs
npm exec --yes pnpm@10.23.0 -- baseline:queryset
node packages/bench/baseline-queryset-inspect.mjs --queryset packages/bench/fixtures/hosted-baseline-queryset.fixture.json --strict --output /tmp/recallweave-hosted-baseline-queryset-report.json
```

Negative check:

```bash
node packages/bench/baseline-queryset-inspect.mjs --queryset <unlabeled-queryset> --strict
```

Expected behavior:

- `mode: baseline-queryset-inspect`
- `metricsOnly: true`
- `publicSafe: true`
- `rawQueryIncluded: false`
- `rawExpectedIdsIncluded: false`
- `rawExpectedHashesIncluded: false`
- `querySetEvidence.publicBenchmarkReady: true` for the fixture query set.
- `querySetEvidence.unlabeledQueryCount: 0` for the fixture query set.
- strict mode exits nonzero for an unlabeled query set.
- Output includes query hashes and label counts only.

Boundary:

- This command does not call hosted Supermemory.
- This command does not close the hosted-baseline blocker.
- This command does not authorize public benchmark claims.
- The raw query-set file remains local operator material unless separately
  approved for release.
