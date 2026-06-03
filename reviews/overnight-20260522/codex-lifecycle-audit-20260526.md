# Codex Lifecycle Audit

- Status: READY_CODEX_PROMPT_STOP_LIFECYCLE_AUDIT
- Fixture only: true
- Prompt/Stop lifecycle ready: true
- Explicit memory write ready: true
- User prompt recall hook: true
- Stop flush hook: true
- Explicit store mode available: true
- Codex pre-compact hook observed: false
- Codex pre-compact status: NOT_EXPOSED_BY_CURRENT_CODEX_HOOKS
- Hosted write-back disabled: true
- Distilled recall enabled: true
- Recall run count: 1
- Recall skip count: 1
- Stop count: 1
- Stored memory count: 3
- Duplicate memory rate: 0
- Duplicate text printed: false
- Distilled memory count: 1
- Transcript copy count: 1
- Transcript text printed: false
- DeepSeek v4 flash compression default enabled: false
- Modifies benchmark retrieval: false
- Counts as benchmark evidence: false
- Private leak count: 0

## Hook Events
- Stop
- UserPromptSubmit

## Lifecycle Event Types
- explicit-store: 1
- prompt: 1
- recall-run: 1
- recall-skip: 1
- stop: 1

## LCM Policy
- Raw session audit local only: true
- Default recall uses distilled memory: true
- Compression must be labeled as a separate benchmark arm: true
- DeepSeek v4 flash recommended use: optional-offline-distillation-arm-after-redaction

## Blockers
- none

## Next Actions
- Treat Codex pre-compaction capture as unsupported until Codex exposes a native compact/compress lifecycle event.
- Keep Codex LCM or DeepSeek v4 flash compression as an explicit, isolated experiment arm before using it in benchmark claims.
- Use this audit before and after Codex lifecycle changes to prove recall/write hooks remain local-first and metrics-only.
