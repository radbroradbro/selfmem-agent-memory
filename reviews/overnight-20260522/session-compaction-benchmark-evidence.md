# Session Compaction Benchmark Evidence

Date: 2026-05-22

Scope:

- Added a multi-scenario, fixture-only compaction benchmark.
- Added `pnpm compaction:benchmark` and included it in the full smoke chain.
- Tightened compaction classification so explicit `Fix:` statements can become
  fix candidates instead of being pulled into adjacent procedure or bug matches.

Public-safety boundary:

- Uses synthetic fixture sessions only.
- Does not read local Codex, Claude, Hermes, OpenClaw, or agent history.
- Does not write benchmark artifacts containing memory text to git.
- Fails if serialized output contains private tags, fixture secret text, or
  obvious key/token prefixes.

Scenarios:

- release-readiness decisions and procedures,
- exact identifier preservation for ticket-style IDs,
- stale academic-context suppression plus fully-private skips,
- dedupe of repeated decisions into one candidate with multiple source events.

Verification:

- `pnpm compaction:benchmark`: passed 5 of 5 scenarios.
- `pnpm test`: 18 tests passed.
- `pnpm typecheck`: passed.
- Aggregate exact identifier accuracy: 1.0.
- Aggregate kind coverage: 1.0.
- Aggregate required-term coverage: 1.0.
- Aggregate privacy leak count: 0.
- Average noise reduction ratio: 0.307.
- `pnpm smoke`: passed with compaction benchmark included.
- `pnpm release:check`: passed.
- Gemini cold review returned `CLEAN` with two hardening recommendations:
  centralize the benchmark privacy leak check with core redaction boundaries and
  preserve ticket-style identifiers even without bug/fix wording.
- Follow-up patch added `containsRedactionBoundaryText()`, a durable
  exact-identifier fact pattern, and tests for standalone ticket preservation.
- Gemini final re-review returned `CLEAN`.

Known limits:

- This is still a fixture benchmark, not a private-session import.
- It scores extraction quality and safety, not downstream retrieval answer
  quality.

## 2026-05-29 Refresh: Session Map Telemetry

Scope:

- Added session-map output to `compactSession`.
- Added lifecycle phases: `session_start`, `pre_compact`,
  `candidate_distilled`, `topic_linked`, `session_map_ready`, and
  `session_end`.
- Added topic/subtopic links from compacted candidates to support later wiki
  and RAG follow-up without requiring a wiki summary rewrite.
- Added metrics-only waste signals for review, including redaction-observed,
  low-noise-reduction, no-topic-links, unlinked-candidates, and high
  noise-skip-rate.

Verification:

- `pnpm typecheck`: passed.
- `pnpm test -- tests/compaction/session-compaction.test.ts tests/nucleus/nucleus-snapshot.test.ts`: passed.
- `node packages/bench/session-compaction-smoke.mjs`: passed.
- `node packages/bench/session-compaction-benchmark.mjs`: passed 5 of 5
  scenarios.
- Aggregate lifecycle coverage: 1.0.
- Aggregate unlinked candidate count: 0.
- Aggregate topic links: 10.
- Aggregate privacy leak count: 0.

Public-safety boundary:

- Public evidence contains counts, hashes, phase names, timestamps, and reason
  codes only.
- Raw session chunks remain private local material for future RAG/session
  retrieval.
