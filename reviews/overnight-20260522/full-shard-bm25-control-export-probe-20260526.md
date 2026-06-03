# Full-Shard BM25 Control Export Probe

- Status: READY_FULL_SHARD_BM25_CONTROL_EXPORT_PROBE
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false
- Strategy: bm25-lite
- Shard: shard-001 (0-25)
- Response count: 25
- Candidates: 19195
- Feature profile: lexical-only bm25/jaccard profile
- Timing ms: min=1065, p50=1118, avg=1118, max=1182
- Observed wall seconds: 36
- Privacy leaks: 0
- Redaction failures: 0
- Private response file committed: false

## Feature Profile
- metadata: false
- tokens: true
- tokenSet: true
- bigramSet: false
- semanticVector: false
- topicTermSet: false
- roleCoverage: false
- dateMs: false

## Next Actions
- Run the remaining shard-001 response arms with provider/local endpoints configured.
- Run answer-quality preflight and scoring only after every private response arm exists for the shard.
- Do not combine or claim SOTA until all twenty shard outputs pass intake and reviewer/result gates.
