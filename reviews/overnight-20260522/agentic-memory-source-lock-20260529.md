# Agentic Memory Source Lock Check

- OK: true
- Target: LongMemEval-V2
- Source-lock ready for materialization: false
- Counts as benchmark score: false
- Public benchmark claims allowed: false
- Missing proof fields: missing-repoCommit, missing-datasetRevision, missing-leaderboardTier, missing-questionIdsHash, missing-answerLabelsHash, missing-scoringCodeHash, missing-leaderboardRowHash, missing-trajectoryIngestContractHash, missing-readerModel, missing-judgeModel

## Required Proof

- repoCommit: missing (git-commit)
- datasetRevision: missing (revision-id)
- leaderboardTier: missing (enum:small|medium)
- questionIdsHash: missing (sha256)
- answerLabelsHash: missing (sha256)
- scoringCodeHash: missing (sha256)
- leaderboardRowHash: missing (sha256)
- trajectoryIngestContractHash: missing (sha256)
- readerModel: missing (model-id)
- judgeModel: missing (model-id)

## Next Actions

- Fill the missing proof fields with hashes and model ids, not raw rows.
- Map trajectory history into the RecallWeave ingest/wiki-session contract before materialization.
- Regenerate this report, then materialize only from a source-lock-ready report.
