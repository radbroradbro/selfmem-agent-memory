# Public Benchmark Materialize Run

- OK: true
- Fixture only: false
- Benchmark: longmemeval
- Claim tier: run-only
- Dataset hash: sha256:d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442
- Memory method: contextual-source-chunk-v1
- Materialization shard: 0-25
- Query count: 25
- Haystack session count: 1174
- Memory record count: 8707
- Contextual source chunk count: 8707
- Contextual index memory count: 0
- Atomic memory count: 0
- Atomic lifecycle: 0 superseded, 0 supersede links, stable content IDs true
- Raw session memory count: 0
- Expected result ref count: 479
- Query set hash: sha256:beb12ea48dce7ff6810ac1048f00a602ca83d7d92d267a4d678382ec3c8ee338
- Collector-compatible query set hash: sha256:5976d43baf5e89376aa498ba00eda130a0b7c0c14e97bd8445d365b93486e318
- Memories file hash: sha256:275241b668a4b15edd696bb60f99ff037b826d70ddcff103e4ac21832b937e35
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
- Selected raw rows hash: sha256:1f45a1d07770853bc71ccceefa7f2a889a5c33270120e7ffb501b86dd4d1965d
- Source manifest hash: sha256:9f623310ac0b4dea1e6c675aafe89f1de2df7e2e3d4eb502fc84a662210d4c72
- Public raw text included: false

## Private Outputs

- queryset: longmemeval-queryset.private.json (sha256:aa2a57379b706a61f7fe86e75a060a6e7347be4726589a96d5d18bdb1a4e51ac)
- memories: longmemeval-memories.private.jsonl (sha256:60b92291f4dc426b9c9dc65fccdfd6aeb6fea21df0219b5eb33e71929df371a2)
- answer-labels: longmemeval-answer-labels.private.json (sha256:b23fa5efe23e2ef161e10830acf77d5105e6a9095e43bbe1b6f125213312d57f)
- raw-dataset: longmemeval-raw-dataset.private.json (sha256:5d926efba3ef31632a7867dcd4c1ff9f24b5cd9aeccaecf14b4821da07e2d79a)
- selected-raw-rows: longmemeval-selected-raw-rows.private.json (sha256:1f45a1d07770853bc71ccceefa7f2a889a5c33270120e7ffb501b86dd4d1965d)
- source-manifest: longmemeval-source-manifest.private.json (sha256:9f623310ac0b4dea1e6c675aafe89f1de2df7e2e3d4eb502fc84a662210d4c72)
- readme: README.private.txt (sha256:0d10f2e4b805d3a77452661922107387c3a0829fdc6ae6591ccb287aa4202ec5)

## Next Actions

- Run the RecallWeave response exporter against the private query set and memories file.
- Run the RecallWeave baseline collector against the private query set and exported responses.
- Attach only the metrics-only result file before moving this target beyond run-only.
