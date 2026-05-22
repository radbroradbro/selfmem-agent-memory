# Session Compaction Benchmark

RecallWeave needs a local-only way to test whether recent Codex, Claude, Hermes,
or OpenClaw sessions compress into useful durable memory without dragging noise
into production recall.

The first harness is deterministic and fixture-safe:

```bash
pnpm compaction:smoke
pnpm compaction:benchmark
```

It uses `packages/bench/fixtures/session-compaction.fixture.json`, not real
local session history.

The benchmark suite uses
`packages/bench/fixtures/session-compaction-benchmark.fixture.json`. It runs
multiple synthetic session shapes and fails if local compaction loses required
kinds, exact identifiers, stale/privacy suppression, dedupe behavior, or minimum
noise reduction.

## What It Measures

- input event count,
- redaction count,
- fully private skips,
- noise skips,
- output candidate count,
- chronological order,
- noise reduction ratio,
- stale background handling.

The multi-scenario benchmark also measures:

- required kind coverage,
- required term coverage,
- exact identifier accuracy,
- merged source-event coverage for duplicates,
- privacy leak count,
- aggregate pass/fail counts.

## Candidate Rules

The compactor keeps:

- decisions,
- preferences,
- procedures,
- bugs,
- fixes,
- methodology notes,
- source/research notes.

It skips:

- fully private text,
- short status chatter,
- heartbeat/status-only messages,
- low-value acknowledgements,
- raw key-shaped content after redaction.

## Stale Context Rules

Stale context should become high-level background only. The default fixture
shows completed academic-term material, but callers may pass `staleRules` to
define their own archived project, semester, case, or client-history patterns.
The compactor may preserve compact profile context, but it should not
bulk-ingest old notes, outlines, or archival material into every future recall.

## Private Local Runs

Future private runs may point this same harness at local Codex or Claude session
exports, but those outputs must stay out of git unless reduced to:

- aggregate metrics,
- synthetic examples,
- redacted fixture text,
- methodology notes.

No raw session history, private memory text, private paths, credentials, or
personal diagnostics belong in public benchmark artifacts.

## Production Gate

Production readiness should require this benchmark to show:

- chronological output,
- zero privacy leaks,
- meaningful noise reduction,
- durable candidates that cover decisions, fixes, methodology, and procedures,
- exact identifiers preserved when the source session uses them,
- repeated durable statements merged into one memory with multiple source
  events,
- no bulk stale school-note retention.
