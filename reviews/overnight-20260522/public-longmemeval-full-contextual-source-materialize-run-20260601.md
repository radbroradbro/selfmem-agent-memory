# Public Benchmark Materialize Run

- OK: true
- Fixture only: false
- Benchmark: longmemeval
- Claim tier: run-only
- Dataset hash: sha256:d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442
- Memory method: contextual-source-chunk-v1
- Materialization shard: full
- Query count: 500
- Haystack session count: 19195
- Memory record count: 142029
- Contextual source chunk count: 142029
- Contextual index memory count: 0
- Atomic memory count: 0
- Atomic lifecycle: 0 superseded, 0 supersede links, stable content IDs true
- Raw session memory count: 0
- Expected result ref count: 9495
- Query set hash: sha256:8834438786d3e50b0455e1fcd1ab6651f6bb7b303184ec8e150f7b4ee4c6d092
- Collector-compatible query set hash: sha256:f6289bfe2c68d4370234ce8194ea2b32fd71f3e93cde984d16f88d2081cec22f
- Memories file hash: sha256:4a40c9a79b07b452e1f40475226f720cb1d73bd7bb00b78eb3995aca66cfd5f5
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
- Raw sources retained privately: true

## Source Retention

- Raw dataset retained privately: true
- Selected raw rows retained privately: true
- Source manifest retained privately: true
- Raw dataset hash: sha256:5d926efba3ef31632a7867dcd4c1ff9f24b5cd9aeccaecf14b4821da07e2d79a
- Selected raw rows hash: sha256:88e90c6866901d0cdca617eba083544de8338040c131c2e2eacef60bcf4f86eb
- Source manifest hash: sha256:cdd801581e4f37ae3024c53f99ec1ab31da6ce5bd0d83a4493f4f456a592c811
- Public raw text included: false

## Private Outputs

- queryset: longmemeval-queryset.private.json (sha256:bec1d55c1febae95297afed31e954f2be76eb976fab911188db0ca66c40141f3)
- memories: longmemeval-memories.private.jsonl (sha256:3f7985e9a5d913d2bf611f747fe37a1bf58e782fe88dfdb1e107b6b527c70ec8)
- answer-labels: longmemeval-answer-labels.private.json (sha256:3a2e910e59c555f4ba6f18bad1f026ac786cb938ad3856f3d76ae31a34db2b32)
- raw-dataset: longmemeval-raw-dataset.private.json (sha256:5d926efba3ef31632a7867dcd4c1ff9f24b5cd9aeccaecf14b4821da07e2d79a)
- selected-raw-rows: longmemeval-selected-raw-rows.private.json (sha256:88e90c6866901d0cdca617eba083544de8338040c131c2e2eacef60bcf4f86eb)
- source-manifest: longmemeval-source-manifest.private.json (sha256:cdd801581e4f37ae3024c53f99ec1ab31da6ce5bd0d83a4493f4f456a592c811)
- readme: README.private.txt (sha256:0d10f2e4b805d3a77452661922107387c3a0829fdc6ae6591ccb287aa4202ec5)

## Next Actions

- Run the RecallWeave response exporter against the private query set and memories file.
- Run the RecallWeave baseline collector against the private query set and exported responses.
- Attach only the metrics-only result file before moving this target beyond run-only.
