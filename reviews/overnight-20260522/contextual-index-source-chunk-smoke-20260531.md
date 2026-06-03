# Contextual Index Source-Chunk Smoke

Date: 2026-05-31

This evidence adds a narrow method smoke for `contextual-index-source-chunk-v1`.
It is public-safe, metrics-only evidence. It does not include raw benchmark
questions, answers, memory text, transcripts, private paths, or credentials.

## What Changed

`contextual-index-source-chunk-v1` writes two private records per source chunk:

- `contextual_source_chunk`: the private source excerpt used for answer
  rehydration.
- `contextual_index`: the compact searchable record with deterministic title,
  topic, subtopic, dates, parent session, and source-chunk pointer.

The response exporter skips source-only records during ranking, ranks the
compact index records, and emits source-chunk IDs plus source content hashes so
answer-quality scoring can rehydrate the original chunk.

## Smoke Results

Fixture checks passed:

- Source chunks: 3
- Index records: 3
- Source-only records skipped from ranking: 3
- Response result IDs: source chunks
- Expected result IDs: source chunks
- Expected result hashes: 0, to avoid double-counting the same chunk by ID and
  hash
- Collector accepted the resulting query set and responses

Live 3-query materialization against the source-locked LongMemEval target also
passed:

- Query count: 3 / 500
- Haystack sessions: 146
- Total memory records: 2,128
- Contextual source chunks: 1,064
- Contextual index records: 1,064
- Raw session memories: 0
- Expected result refs: 61
- Key-shaped redactions: 0
- Private-tag redactions: 0

## Claim Boundary

This is method plumbing evidence only. It does not show better retrieval,
answer-quality, or SOTA performance yet. The next gate is a same-shard
comparison against `session-v1`, `contextual-source-chunk-v1`, BM25-lite,
provider-backed arms, and answer-quality scoring.
