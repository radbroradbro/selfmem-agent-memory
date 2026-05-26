# Local-Full Shard Resume Command Materializer

- Status: BLOCKED_LOCAL_FULL_RESUME_PRIVATE_COMMANDS
- Fixture only: false
- Ready for materialization: false
- Writes private command file: false
- Private command path printed: false
- Prints materialized commands: false
- Prints env values: false
- Prints private paths: false
- Command count: 8
- Materialized command count: 0
- Required placeholders ready: false
- Unresolved required placeholders: local-answer-model, local-embedding-base-url, local-embedding-model, local-judge-model, local-rerank-base-url, local-rerank-candidate-limit, local-rerank-model, openai-compatible-base-url, private-output-dir, safe-local-embedding-batch-token-limit
- Optional defaults applied: 1-when-cloud-query-expansion-runs, env-only-if-cloud-endpoint, local-query-expansion-base-url-if-used, query-expansion-model-if-used
- Counts as local-full benchmark evidence: false

## Command IDs
- resumeEnvDoctor
- rerunRuntimeDoctor
- rerunDurabilitySmoke
- missingArmResponseExport
- preflight
- answerQuality
- localShardIntake
- fullSotaDoctor

## Blockers
- private-dir-not-provided
- private-command-output-not-provided
- placeholder-unresolved:local-answer-model
- placeholder-unresolved:local-embedding-base-url
- placeholder-unresolved:local-embedding-model
- placeholder-unresolved:local-judge-model
- placeholder-unresolved:local-rerank-base-url
- placeholder-unresolved:local-rerank-candidate-limit
- placeholder-unresolved:local-rerank-model
- placeholder-unresolved:openai-compatible-base-url
- placeholder-unresolved:private-output-dir
- placeholder-unresolved:safe-local-embedding-batch-token-limit

## Next Actions
- Provide an outside-repository private input directory with --private-input-dir or RECALLWEAVE_FULL_SHARD_PRIVATE_DIR.
- Provide an outside-repository private command output path with --private-command-output or RECALLWEAVE_LOCAL_FULL_RESUME_PRIVATE_COMMAND_OUTPUT.
- Set the required local embedding, local rerank, and answer-quality environment variables.
