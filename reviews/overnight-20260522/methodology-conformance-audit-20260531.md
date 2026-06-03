# Methodology Conformance Audit

- Status: METHODOLOGY_GAP_PATCHED_FOR_NEXT_RUN
- Counts as benchmark score: false
- Counts as SOTA evidence: false
- Public safe: true
- Raw benchmark text included: false
- Provider calls made: false

## Finding

The prior LongMemEval materializer was mostly a session-level memory feed:
one haystack session became one searchable memory record. The response exporter
then ranked those records, while answer-quality scoring rehydrated the memory
content by id. It also did not enforce the per-result token budget estimated by
the response exporter when rehydrating those records. That is useful as a
control, but it is not close enough to the published Supermemory-style pattern
of ranking high-signal contextual or atomic memories and then injecting the
linked original source chunk.

This can plausibly explain a large score gap without blaming the reader model.
If a relevant fact is late in a long session, a whole-session record can rank
correctly and still give the answer model too much or poorly focused context.

## Patch

`packages/bench/public-benchmark-materialize-run.mjs` now supports:

- `--memory-method session-v1`: existing whole-session control.
- `--memory-method contextual-source-chunk-v1`: private contextual source
  chunks with parent session id, chunk index, document date, event date, topic,
  subtopic, source-retention metadata, and a contextual title.

Raw rows and selected source rows remain private. Public reports include only
hashes, counts, strategy names, and method labels.

`packages/bench/public-benchmark-answer-quality.mjs` now truncates rehydrated
memory content according to the response export result budget before building
the answer prompt. That makes the answer-quality lane measure the actual
retrieved context budget more closely.

## Smoke Evidence

Fixture materialization passed for both methods.

The contextual fixture produced:

- Memory method: `contextual-source-chunk-v1`
- Haystack sessions: 3
- Contextual source chunks: 3
- Retrieval export responses: 2
- Fixture answer-quality smoke: OK

## Next Run

Rerun the same answer-quality shard with at least:

- `session-v1` plus `bm25-lite`, `full-hybrid-rerank`, and provider/local arms.
- `contextual-source-chunk-v1` plus the same arms.
- `metadata-aware-full-hybrid-rerank` and wiki/subtopic arms as diagnostic
  challengers on the contextual input.

Only promote the contextual method if it wins on answer-quality shards, not on
fixtures.
