# Full-Shard Private Input Doctor

- Status: READY_FULL_SHARD_PRIVATE_INPUTS
- Ready for shard run: true
- Counts as full memory SOTA evidence: false
- Query count: 500
- Shard count: 20
- Max memory bytes: 300000000
- Private directory present: true
- Private directory inside repository: false
- Raw sources retained privately: true

## Files
- queryset: present=true, hashMatched=true, sizeBytes=278725, mode=0600
- memories: present=true, hashMatched=true, sizeBytes=203831507, mode=0600
- answer-labels: present=true, hashMatched=true, sizeBytes=105250, mode=0600
- raw-dataset: present=true, hashMatched=true, sizeBytes=277383468, mode=0600
- selected-raw-rows: present=true, hashMatched=true, sizeBytes=267784372, mode=0600
- source-manifest: present=true, hashMatched=true, sizeBytes=1426, mode=0600

## Checks
- privateInputDirProvided: true
- privateInputDirPresent: true
- privateInputDirOutsideRepository: true
- privateInputDirNotPrinted: true
- planReadyForShardRun: true
- materializeTargetMatchesPlan: true
- materializeCollectorQuerySetMatchesPlan: true
- materializeHashMatchesPlan: true
- fullQueryCountPresent: true
- fullShardCountPresent: true
- maxMemoryBytesCoversPrivateMemories: true
- responseArmTemplateCarriesMemoryLimit: true
- allPrivateFilesPresent: true
- allPrivateFilesOutsideRepository: true
- allPrivateFilesHashMatched: true
- allPrivateFilesNonEmpty: true
- allPrivateFilesMode0600: true
- rawSourceRetentionPrivate: true

## Blockers
- none

## Next Actions
- Run benchmark:answer-quality:arms shard-by-shard with the checked-in plan template.
- Run benchmark:answer-quality:preflight for each shard before model-scored answer quality.
- Keep private input and response files outside the repository; commit only metrics-only shard outputs.
