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

## Local Session Audit

Use the local audit when you want to test real Codex, Claude, Hermes, or
OpenClaw session exports without printing candidate memory text:

```bash
node packages/bench/session-compaction-local-audit.mjs \
  --input /private/path/to/session-events.jsonl \
  --source codex \
  --session-id private-run-001
```

The audit is metrics-only by default. It emits:

- event count,
- redaction count,
- output candidate count,
- chronological status,
- noise reduction ratio,
- kind counts,
- stale candidate count,
- exact-identifier candidate count,
- average salience,
- candidate fingerprints.

It does not emit candidate memory text, raw source text, local paths, or session
IDs. The input path is reduced to a redacted `.../filename` label, and the
session id is hashed.

The public smoke fixture runs:

```bash
pnpm compaction:local-audit
```

That smoke uses
`packages/bench/fixtures/session-compaction-local-audit.fixture.jsonl` and
requires chronological output, at least two redactions, exact-identifier
coverage, and zero privacy leaks.

## Batch Local Session Audit

Use the batch audit when you want to inspect a folder of recent private Codex,
Claude, Hermes, or OpenClaw exports without exposing session text or local
paths:

```bash
node packages/bench/session-compaction-local-batch-audit.mjs \
  --input-dir /private/path/to/session-exports \
  --limit 25 \
  --output /private/path/to/recallweave-batch-audit.json
```

The report stays metrics-only. It emits source counts, aggregate event and
candidate counts, average noise reduction, chronological failures, privacy
counts, exact-identifier coverage, and per-session candidate fingerprints. It
does not emit raw session text, candidate memory text, full local paths, or raw
session ids. Input files are represented by hashes and a redacted extension
label.

The fixture-safe public gate runs:

```bash
pnpm compaction:batch-audit
```

That gate covers Codex rollout-style JSONL, Claude transcript-style JSON, and
Hermes trace-style JSONL shapes. It requires multiple sources, chronological
output, exact-identifier coverage, useful noise reduction, and zero privacy
leaks.

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
- candidate fingerprints without text,
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
