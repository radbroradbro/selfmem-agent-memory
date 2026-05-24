# Public Benchmark Materialize Run

- OK: true
- Fixture only: false
- Benchmark: longmemeval
- Claim tier: run-only
- Dataset hash: sha256:d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442
- Query count: 30
- Haystack session count: 1420
- Expected result ref count: 92
- Query set hash: sha256:e4d9d656f74ad843442ab7bcfebd9d2d5a38742ac646941acc311b008f526937
- Collector-compatible query set hash: sha256:4386f6fa3280951bffd59b5ae81f067905b1905be3575eff56e2b4168c0ccda7
- Memories file hash: sha256:378ef6eba5e7e45b9e612d524874182bb22365b12ac7e1b84dcb3bd85e36cbd1
- Retrieval strategy: bm25-lite
- Context token budget: 800
- Result limit: 5

## Safety

- Metrics only: true
- Public safe: true
- Raw question ids included: false
- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false
- Private output path included: false

## Private Outputs

- queryset: longmemeval-queryset.private.json (sha256:6b0d2d9c6dc864063106b975da5232eff1456b07ca3656fccf427e60e4c39772)
- memories: longmemeval-memories.private.jsonl (sha256:6dc310a098e00e424bea17babecd4bd5b23c5a03b8214557388d7a0f5bcadf25)
- readme: README.private.txt (sha256:c10118c9a418153dd2783a98042b216f212b492ff7a5a508abcd87f483a37d7b)

## Next Actions

- Run the RecallWeave response exporter against the private query set and memories file.
- Run the RecallWeave baseline collector against the private query set and exported responses.
- Attach only the metrics-only result file before moving this target beyond run-only.
