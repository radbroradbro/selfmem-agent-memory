# Hosted Baseline Live Prep Evidence

Date: 2026-05-23

Status: live hosted prep advanced. This does not close the hosted-baseline
blocker.

## Scope

Ran the private-map hosted baseline prep flow with the local Supermemory key
present in the environment. The flow kept raw hosted labels and raw query text
outside the repository under 0600 files in `/tmp`, then copied only public-safe
metrics and hashes into this review folder.

Public-safe reports:

- `reviews/overnight-20260522/hosted-baseline-live-discovery.json`
- `reviews/overnight-20260522/hosted-baseline-live-queryset-author.json`
- `reviews/overnight-20260522/hosted-baseline-live-queryset-report.json`

Private local-only files created during the run:

- hosted container map: 0600, not committed
- selected container env: 0600, not committed
- hosted query set: 0600, not committed

## Live Results

- Hosted discovery called the hosted provider: yes.
- Hosted discovery documents seen: 200.
- Hosted discovery hashed candidate containers: 14.
- Hosted discovery raw labels included: no.
- Hosted discovery raw memory included: no.
- Query-set author called the hosted provider: yes.
- Query-set author text-bearing documents: 47.
- Query-set author drafted queries: 8.
- Unique drafted query count: 8.
- Duplicate drafted query count: 0.
- Query-set hash: `sha256:52a7f54511631b079585accde83aa7817704f253abd990ced9d64dbcd31fc97a`.
- Strict query-set inspection: passed.
- Privacy leak count: 0.
- Redaction failure count: 0.
- Errors: none.

## Fix Applied

The first live draft exposed a benchmark-quality bug: all eight drafted queries
shared one query hash. The gate now rejects duplicate query text, and the
author now searches for distinct phrase windows across hosted documents before
writing a private query set.

Verification after the fix:

- fixture author emits 3 unique queries and passes strict inspection.
- duplicate-query fixture fails strict inspection with `unique-query-text`.
- live author emits 8 unique queries and passes strict inspection.

## Boundary

This proves that hosted discovery, private container selection, private query
authoring, and strict labeled-query validation can run without public leakage.
It still is not a hosted baseline result, a RecallWeave comparison, or a public
benchmark claim. The next valid step is to review the private query set locally,
prove the local RecallWeave container matches the selected hosted source, then
run `baseline:run -- --live --reviewed-queryset` to collect both sides.
