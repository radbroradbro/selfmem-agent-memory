# Agentic Memory Ingest Contract

- OK: true
- Contract hash: sha256:ce1cae11c2d74764c165a0bd4308120492c153be3ba0e67ee142bcd335f41ee9
- Ready for source-lock proof: true
- Counts as benchmark score: false
- Public benchmark claims allowed: false
- Raw trajectory included: false

## Contract Shape

- Session unit: one benchmark trajectory becomes one RecallWeave session
- Topic root: Benchmarks / LongMemEval-V2 / {domain}
- Subtopic path: {ability-family} / {task-entity-fingerprint} / {temporal-state-phase}
- Wiki raw text: false
- Vector visibility: operator-private
- Pre-compact checkpoint: true

## Next Actions

- Feed sourceLockProof.proofValue into benchmark:agentic-source-lock when regenerating the LongMemEval-V2 source-lock packet.
- Use this contract when materializing LongMemEval-V2 rows into private sessions and public wiki/topic evidence.
- Keep title, subtopic, and summary-session amplification gated until answer-quality shards prove a win.
