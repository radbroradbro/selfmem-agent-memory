# Hosted Baseline Live Discovery Evidence

Date: 2026-05-23

Scope:

- Ran live hosted Supermemory discovery with `SUPERMEMORY_API_KEY` present in
  the local environment.
- Wrote the public-safe report to
  `reviews/overnight-20260522/hosted-baseline-live-discovery.json`.
- The report lists hashed container candidates, document counts, status counts,
  type counts, timestamps, and sample document hashes only.

Command:

```bash
RECALLWEAVE_BASELINE_LIVE=1 \
npm exec --yes pnpm@10.23.0 -- baseline:discover -- \
  --live \
  --output /tmp/recallweave-hosted-baseline-live-discovery.json
```

Observed result:

- `mode: hosted-baseline-discovery`
- `fixtureOnly: false`
- `callsHostedProvider: true`
- `publicSafe: true`
- `metricsOnly: true`
- `rawLabelsIncluded: false`
- `rawMemoryIncluded: false`
- `rawTranscriptIncluded: false`
- `rawPromptIncluded: false`
- `rawAnswerIncluded: false`
- `privacyLeakCount: 0`
- `redactionFailureCount: 0`
- `pagesRead: 2`
- `documentsSeen: 100`
- `containerCandidateCount: 4`
- `errors: []`

Boundary:

- This proves the hosted key can perform read-only metadata discovery.
- This does not choose or reveal the raw hosted container label.
- This does not collect a matched hosted baseline.
- This does not create a RecallWeave comparison result.
- This does not close the hosted-baseline blocker or authorize public
  benchmark claims.

Next required step:

Use the private-map flow outside the repository to select the raw container
label locally, prepare the source-locked query set, run hosted and RecallWeave
collectors with the same query set, then package the metrics-only evidence for
review.
