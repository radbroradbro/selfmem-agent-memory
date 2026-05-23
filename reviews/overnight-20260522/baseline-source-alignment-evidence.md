# Baseline Source-Alignment Evidence

Date: 2026-05-23

## Scope

Added `baseline:source-align`, a metrics-only gate for hosted Supermemory versus
local RecallWeave benchmark preparation. It separates two different claims:

- label alignment: the local container map points at the same hosted container
  label selected from the private hosted map.
- content alignment: the reviewed expected refs and hashes are collectable from
  the local RecallWeave source.

This prevents another full hosted/local benchmark run when the container label
matches but the actual local memory source is not the same benchmark source.

## Commands

```bash
node --check packages/bench/baseline-source-alignment.mjs
npm exec --yes pnpm@10.23.0 -- baseline:source-align
node packages/bench/baseline-source-alignment.mjs \
  --source-match /tmp/recallweave-baseline-openclaw-source-match.json \
  --local-map <local-container-map.json> \
  --private-map /tmp/recallweave-hosted-container-map-current.private.jsonl \
  --candidate-id c_0336c0cc3f6f0853 \
  --strict \
  --output /tmp/recallweave-baseline-openclaw-source-alignment.json
```

## Fixture Result

- Mode: `baseline-source-alignment`.
- Status: `READY_FOR_MATCHED_BASELINE_FIXTURE`.
- Metrics only: true.
- Public safe: true.
- Raw labels included: false.
- Raw memory included: false.
- Label aligned: true.
- Content source-match ready: true.
- Matched baseline run allowed: true.
- Public benchmark claims allowed: false.

## Real OpenClaw Source-Aligned Attempt

The controller ran a private, metrics-only source-alignment attempt using the
current hosted discovery/private map and the matching local OpenClaw container
map. No raw labels, raw queries, raw memories, transcripts, prompts, answers,
credentials, or private paths were written to the repository.

- Hosted discovery read 500 metadata-only documents.
- Hosted candidate count: 17.
- The local source label hash matched one hosted candidate hash.
- Selected hosted candidate document count: 3.
- Private hosted query set authoring produced 3 unique labeled queries.
- Query-set inspection passed with 3 unique labeled queries and 6 expected refs.
- Local source-match preflight failed safely.
- Source-alignment status: `BLOCKED_CONTENT_DIVERGENT`.
- Label aligned: true.
- Content source-match ready: false.
- Source-matched queries: 0 of 3.
- Collectable queries: 0 of 3.
- Matched baseline run allowed: false.
- Privacy leak count: 0.

## Interpretation

The result is high-signal. The hosted container label and local container map
refer to the same source label, but the local RecallWeave memory file does not
contain the hosted expected refs or content hashes. The next benchmark should
not run until the selected hosted source is mirrored into local RecallWeave, or
until a reviewed query set is rebuilt from the local source and then checked
against hosted read-through.

## Guardrails

- Private hosted maps must stay outside the repository and use `0600`.
- The command emits only hashes, counts, booleans, and status labels.
- `--strict` exits nonzero unless label and content alignment both pass.
- Public benchmark claims stay false even when source alignment passes.
- Private maps, local memories, raw queries, and private query sets are never
  attachable evidence.
