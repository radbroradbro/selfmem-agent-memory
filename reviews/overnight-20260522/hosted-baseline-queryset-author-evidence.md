# Hosted Baseline Query-Set Author Evidence

Date: 2026-05-23

## Scope

Added `baseline:author-queryset` as the private bridge between hosted container
selection and strict hosted-baseline query-set inspection.

The author reads:

- a public `baseline:discover` report with hashed container candidates,
- a local-only private raw-label map written with 0600 permissions.

It writes:

- a private source-locked query set outside the repository with 0600
  permissions,
- a public-safe author report with counts and hashes only.

It prints no raw hosted label, memory text, raw query, raw expected id, raw
expected content hash, private path, or credential value.

## Fixture Verification

Commands run:

```bash
node --check packages/bench/hosted-baseline-queryset-author.mjs
node packages/bench/hosted-baseline-queryset-author.mjs --fixture --queryset-output <tmp-private-query-set> --output <tmp-public-author-report>
node packages/bench/baseline-queryset-inspect.mjs --queryset <tmp-private-query-set> --strict --output <tmp-public-queryset-report>
npm exec --yes pnpm@10.23.0 -- baseline:author-queryset
```

Result:

- Mode: `hosted-baseline-queryset-author`
- Public safe: yes
- Metrics only: yes
- Calls hosted provider in fixture mode: no
- Raw queries included in public output: no
- Raw expected ids included in public output: no
- Raw expected hashes included in public output: no
- Private query set mode: `0600`
- Private query set attachable to public evidence: no
- Query count: 3
- Minimum expected refs per query: 2
- Strict query-set inspection: passed
- Counts as benchmark evidence: no
- Human review required before collection: yes

The release gate also rejects a private query-set output path inside the
repository.

## Live Smoke

A bounded live smoke used the existing hosted credentials in the environment and
deleted all private temp files after the run.

Result:

- Hosted discovery: non-fixture, 50 documents seen, 3 hashed container
  candidates, raw labels included: no, raw memory included: no, errors: none.
- Query-set author: non-fixture, hosted provider called, raw queries included:
  no, raw expected ids included: no, raw expected hashes included: no.
- Private query set mode: `0600`
- Authored query count: 8
- Minimum expected refs per query: 2
- Text-bearing documents used: 8
- Strict query-set inspection: publicBenchmarkReady true, unlabeled query count
  0.

The live smoke does not close the hosted-baseline blocker. It proves only that
the private query-set author can draft a review-required query set from the
selected hosted container without public leakage.

## Integration

The author is now included in:

- `package.json` as `baseline:author-queryset`,
- clean consumer smoke,
- `hosted-baseline-operator-packet`,
- `hosted-baseline-next-run`,
- `release-blocker-doctor`,
- release readiness checks,
- public docs for the hosted-baseline lane.

This does not authorize public benchmark claims. A fresh non-fixture hosted
result, matched RecallWeave result, preflight, comparison, metrics-only evidence
packet, and reviewer approvals are still required.
