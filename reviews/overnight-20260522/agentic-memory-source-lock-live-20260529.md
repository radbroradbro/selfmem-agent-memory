# Agentic Memory Source Lock Check

- OK: true
- Target: LongMemEval-V2
- Source-lock ready for materialization: true
- Counts as benchmark score: false
- Public benchmark claims allowed: false
- Missing proof fields: none

## Required Proof

- repoCommit: provided (git-commit)
- datasetRevision: provided (revision-id)
- leaderboardTier: provided (enum:small|medium)
- questionIdsHash: provided (sha256)
- answerLabelsHash: provided (sha256)
- scoringCodeHash: provided (sha256)
- leaderboardRowHash: provided (sha256)
- trajectoryIngestContractHash: provided (sha256)
- readerModel: provided (model-id)
- judgeModel: provided (model-id)

## Next Actions

- Materialize LongMemEval-V2 through an operator-private run directory.
- Export RecallWeave arms with raw rows retained outside the repository.
- Run the same reader and judge model declared in this source-lock report.
- Compare only against the same leaderboard tier and scoring contract.
