# Agentic Memory Source Lock Check

- OK: true
- Target: LongMemEval-V2
- Source-lock ready for materialization: false
- Counts as benchmark score: false
- Public benchmark claims allowed: false
- Missing proof fields: missing-leaderboardTier, missing-leaderboardRowHash, missing-readerModel, missing-judgeModel

## Required Proof

- repoCommit: provided (git-commit)
- datasetRevision: provided (revision-id)
- leaderboardTier: missing (enum:small|medium)
- questionIdsHash: provided (sha256)
- answerLabelsHash: provided (sha256)
- scoringCodeHash: provided (sha256)
- leaderboardRowHash: missing (sha256)
- trajectoryIngestContractHash: provided (sha256)
- readerModel: missing (model-id)
- judgeModel: missing (model-id)

## Next Actions

- Fill the remaining missing proof fields with hashes and model ids, not raw rows.
- Regenerate this report, then materialize only from a source-lock-ready report.
