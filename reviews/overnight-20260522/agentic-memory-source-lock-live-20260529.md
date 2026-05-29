# Agentic Memory Source Lock Check

- OK: true
- Target: LongMemEval-V2
- Source-lock ready for materialization: false
- Counts as benchmark score: false
- Public benchmark claims allowed: false
- Missing proof fields: missing-leaderboardTier, missing-questionIdsHash, missing-answerLabelsHash, missing-scoringCodeHash, missing-leaderboardRowHash, missing-readerModel, missing-judgeModel

## Required Proof

- repoCommit: provided (git-commit)
- datasetRevision: provided (revision-id)
- leaderboardTier: missing (enum:small|medium)
- questionIdsHash: missing (sha256)
- answerLabelsHash: missing (sha256)
- scoringCodeHash: missing (sha256)
- leaderboardRowHash: missing (sha256)
- trajectoryIngestContractHash: provided (sha256)
- readerModel: missing (model-id)
- judgeModel: missing (model-id)

## Next Actions

- Fill the remaining missing proof fields with hashes and model ids, not raw rows.
- Regenerate this report, then materialize only from a source-lock-ready report.
