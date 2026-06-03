# Public Benchmark Materialize Run

- OK: true
- Fixture only: false
- Benchmark: longmemeval
- Claim tier: run-only
- Dataset hash: sha256:d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442
- Query count: 30
- Haystack session count: 1420
- Expected result ref count: 92
- Query set hash: sha256:72b5833ff75dec92c804fb76b57c0da4e5ac284e5d72f36c3530947f69419ae1
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

- queryset: longmemeval-queryset.private.json (sha256:d3758e0719fae64d09caf612bee16ef3952f30df1ad99046858836015d019164)
- memories: longmemeval-memories.private.jsonl (sha256:6dc310a098e00e424bea17babecd4bd5b23c5a03b8214557388d7a0f5bcadf25)
- answer-labels: longmemeval-answer-labels.private.json (sha256:0d9710ac102bd24cd6690d97312cdcb4867b3683576131521ab3b51a7fac3637)
- readme: README.private.txt (sha256:c10118c9a418153dd2783a98042b216f212b492ff7a5a508abcd87f483a37d7b)

## Next Actions

- Run the RecallWeave response exporter against the private query set and memories file.
- Run the RecallWeave baseline collector against the private query set and exported responses.
- Attach only the metrics-only result file before moving this target beyond run-only.
