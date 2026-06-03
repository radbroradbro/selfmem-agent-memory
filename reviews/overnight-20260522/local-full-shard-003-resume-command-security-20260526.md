# Local-Full Resume Command Security Doctor

- Status: READY_LOCAL_FULL_RESUME_COMMAND_SECURITY
- Security ready: true
- Public safe: true
- Private script content printed: false
- Private command path printed: false
- Commands printed: false
- Fixture private command file written: true
- Fixture private command outside repository: true
- Fixture private command mode: 0700
- Fixture exports Supermemory search disable: true
- Fixture private script placeholder count: 0
- Fixture private script order ready: true
- Fixture first command: rerunRuntimeDoctor
- Fixture second command: rerunDurabilitySmoke
- Fixture third command: rerunLocalRerankDurabilitySmoke
- Fixture guarded command: missingArmResponseExport
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false

## Blockers
- none

## Next Actions
- Use the checked materializer flow only when a current accepted-lane resume packet is ready.
- Keep public reports limited to hashes, counts, labels, and booleans.
- Run the resume result doctor before accepting any resumed shard into local-full intake.
