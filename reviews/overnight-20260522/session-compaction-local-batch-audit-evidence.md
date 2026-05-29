# Local Session Batch Compaction Audit Evidence

Date: 2026-05-23

Command:

```bash
node packages/bench/session-compaction-local-batch-audit.mjs --strict
```

Result:

```json
{
  "ok": true,
  "mode": "local-session-compaction-batch-audit",
  "sessions": 3,
  "events": 12,
  "candidates": 9,
  "averageNoiseReductionRatio": 0.25,
  "privacyLeakCount": 0,
  "sourceCounts": {
    "claude": 1,
    "codex": 1,
    "hermes": 1
  },
  "exactIdentifierCandidateCount": 2
}
```

Scope:

- Adds a fixture-safe batch audit for local-only session compaction across
  Codex rollout-style JSONL, Claude transcript-style JSON, and Hermes
  trace-style JSONL.
- Outputs metrics only: source counts, aggregate event and candidate counts,
  noise reduction, chronological failures, privacy counts, exact-identifier
  coverage, and candidate fingerprints.
- Does not output raw session text, candidate memory text, raw local paths, or
  raw session ids. Input files are represented by hashes and redacted extension
  labels.

Public-safety notes:

- The fixture includes a private-tagged Claude line; the strict report has
  `privacyLeakCount: 0`.
- The report includes no provider credentials, raw memory files, raw
  transcripts, diagnostics bundles, or private local paths.

## 2026-05-29 Refresh: Lifecycle And Topic Map Batch Audit

The batch audit now aggregates session-map telemetry across Codex, Claude, and
Hermes-style fixture exports.

Refresh result:

```json
{
  "sessionCount": 3,
  "events": 12,
  "candidates": 9,
  "topicLinkCount": 9,
  "lifecycleEventCount": 18,
  "unlinkedCandidateCount": 0,
  "duplicateCandidateMerges": 0,
  "privacyLeakCount": 0,
  "lifecyclePhaseCounts": {
    "session_start": 3,
    "pre_compact": 3,
    "candidate_distilled": 3,
    "topic_linked": 3,
    "session_map_ready": 3,
    "session_end": 3
  }
}
```

Strict mode now verifies lifecycle coverage and zero unlinked session-map
candidates while preserving the metrics-only public-safety boundary.
