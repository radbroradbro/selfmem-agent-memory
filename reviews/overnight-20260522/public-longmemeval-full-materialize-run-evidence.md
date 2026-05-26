# Public Benchmark Materialize Run

- OK: true
- Fixture only: false
- Benchmark: longmemeval
- Claim tier: run-only
- Dataset hash: sha256:d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442
- Query count: 500
- Haystack session count: 19195
- Expected result ref count: 1896
- Query set hash: sha256:785c182b2f234933e0711edd6e6c6f5ee97900f62e6e73f7f207b7d39d2fa990
- Collector-compatible query set hash: sha256:04e10ea57d93b48fe6a7182b30920fe93676d597b91e19c6f7db4f29cbacfa95
- Memories file hash: sha256:722ded72893be2d451f8f4c6c98650dc8fe6a3f2fedf35e1d9ce1f906826babf
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
- Source manifest hash: sha256:3f827f2d756f8ca93c0bcddce5937f421ad4d5b7f141154cca8beae03679cbbe
- Public raw text included: false

## Private Outputs

- queryset: longmemeval-queryset.private.json (sha256:9cd221a53f8692f2035a87fc6d5f46495505c5c2571679fdfbdb2fe3f751d89b)
- memories: longmemeval-memories.private.jsonl (sha256:a4ee0d963c5bafa42a3a6da81568f90a84c80d6cd60a9f8eb055b870f014ef0a)
- answer-labels: longmemeval-answer-labels.private.json (sha256:302bf9ce65a7471a56fe65529177c9b4d82576096a67e2e345280fa3418c8402)
- raw-dataset: longmemeval-raw-dataset.private.json (sha256:5d926efba3ef31632a7867dcd4c1ff9f24b5cd9aeccaecf14b4821da07e2d79a)
- selected-raw-rows: longmemeval-selected-raw-rows.private.json (sha256:88e90c6866901d0cdca617eba083544de8338040c131c2e2eacef60bcf4f86eb)
- source-manifest: longmemeval-source-manifest.private.json (sha256:3f827f2d756f8ca93c0bcddce5937f421ad4d5b7f141154cca8beae03679cbbe)
- readme: README.private.txt (sha256:6e64245a856e59013ea576f493657b52f43cdc0a6b477d810993da70f25d6255)

## Next Actions

- Run the RecallWeave response exporter against the private query set and memories file.
- Run the RecallWeave baseline collector against the private query set and exported responses.
- Attach only the metrics-only result file before moving this target beyond run-only.
