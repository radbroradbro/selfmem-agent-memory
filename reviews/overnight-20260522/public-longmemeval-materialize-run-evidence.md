# Public Benchmark Materialize Run

- OK: true
- Fixture only: false
- Benchmark: longmemeval
- Claim tier: run-only
- Dataset hash: sha256:d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442
- Query count: 6
- Haystack session count: 287
- Expected result ref count: 18
- Query set hash: sha256:cbe842779aead8c27f308100838a8022b6af4437c8328de6c8242b8616408111
- Collector-compatible query set hash: sha256:6a7b0da2db62f83beabb6e9cfc27910c47f122289bd7ece9a0d3c8ddfdcde24c
- Memories file hash: sha256:f8f6949f8106c1ea331b999ad66ee626cbda824f9814c0f193cba92f437705ab
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

- queryset: longmemeval-queryset.private.json (sha256:7b8a5f034c186abcfcd5171812b4630bff6239d71c09f4c3c48f1e7672ad6e73)
- memories: longmemeval-memories.private.jsonl (sha256:ab0d6a74b3cdf0c2659a0d3ff477fccb69641246cbbef204402f2a750fde54f6)
- readme: README.private.txt (sha256:c10118c9a418153dd2783a98042b216f212b492ff7a5a508abcd87f483a37d7b)

## Next Actions

- Run the RecallWeave response exporter against the private query set and memories file.
- Run the RecallWeave baseline collector against the private query set and exported responses.
- Attach only the metrics-only result file before moving this target beyond run-only.
