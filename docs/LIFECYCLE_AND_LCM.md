# Lifecycle And LCM

RecallWeave should behave like a native memory provider. It should recall before useful turns, write durable memories after useful turns, and avoid turning status checks into memory noise.

## Hermes

The Hermes provider implements the memory-provider surface:

- `is_available`
- `initialize`
- `get_tool_schemas`
- `handle_tool_call`
- `get_config_schema`
- `save_config`
- `system_prompt_block`
- `prefetch`
- `queue_prefetch`
- `sync_turn`
- `on_pre_compress`
- `on_memory_write`
- `on_session_end`
- `shutdown`

Expected behavior:

- `prefetch` and `queue_prefetch` prepare recall context.
- `sync_turn` records completed turns after redaction and distillation.
- `on_pre_compress` preserves compact evidence before context compression when Hermes exposes that event.
- `on_memory_write` mirrors explicit memory-tool writes into local RecallWeave.
- `on_session_end` closes the turn and records a summary when appropriate.

If Hermes LCM is unavailable, Hermes may fall back to its built-in compressor. RecallWeave should continue to write local distilled memory, but it does not install or repair the LCM engine.

## OpenClaw

The OpenClaw adapter covers:

- `session_start`
- `before_prompt_build`
- `agent_end`
- optional compression checkpoint events when the runtime exposes them
- memory tools and compatibility aliases

Expected behavior:

- `session_start` activates the agent's local container mapping.
- `before_prompt_build` searches local RecallWeave plus optional hosted Supermemory history, then injects bounded context.
- `agent_end` redacts, distills, deduplicates, and stores useful memory locally.
- compression checkpoint events record compact evidence when available.

## Recall Gate

The recall gate should skip maintenance traffic unless there is clear memory intent. Examples include status checks, diagnostics, heartbeat output, and update logs. This reduces provider spend and keeps prompt context cleaner.

## Write Gate

The write gate should prefer durable facts, preferences, decisions, procedures, bugs, fixes, and methodology notes. It should reject:

- fully private content,
- key-shaped content,
- duplicate content,
- status-only content,
- raw role markers,
- unbounded full-session dumps.

Full raw evidence may remain in a local redacted raw-events file for audit, but prompt recall should use distilled memory by default.

## Sleep Cycle

Hermes already has sleep/compression-style lifecycle behavior. RecallWeave
should use that rhythm when Hermes exposes it, not install a competing agent
runtime.

Target cycle phases:

- signal detection,
- pre-compression preservation,
- distillation,
- dedupe,
- relinking,
- contradiction repair,
- salience scoring,
- wiki sync,
- eval replay,
- compacting,
- archiving.

The cycle should be visible in the Nucleus Index as lifecycle nodes and edges.
Protected phases that can burn paid model calls must require explicit policy and
cost caps.

## Logging

The runtime should keep local logs such as:

- `trace.jsonl` for event counts, errors, lifecycle coverage, search counts, and redaction counts.
- `raw_events.jsonl` for redacted turn evidence.
- `memories.jsonl` for local distilled memories.

Do not publish these files. Share sanitized summaries only.

## User Controls

Current controls:

- Set `SELFMEM_RECALL_EVERY_TURN=1` to force recall before every prompt.
- Set `SELFMEM_RERANK_CANDIDATE_LIMIT` to change the rerank candidate count.
- Set `SELFMEM_RERANK_TOKEN_BUDGET` to cap rerank token use.
- Use `selfmem_store` to force a durable memory write.
- Use `selfmem_search` to force an immediate memory search.

Current lifecycle events:

| Runtime | Event | Purpose |
|---|---|---|
| Hermes | `prefetch` | Prepare recall context. |
| Hermes | `queue_prefetch` | Record queued recall work. |
| Hermes | `sync_turn` | Store useful completed turns. |
| Hermes | `on_pre_compress` | Preserve compact evidence before compression. |
| Hermes | `on_memory_write` | Mirror explicit memory writes. |
| Hermes | `on_session_end` | Close out session memory. |
| OpenClaw | `session_start` | Activate the mapped local container. |
| OpenClaw | `before_prompt_build` | Search and inject relevant context. |
| OpenClaw | `agent_end` | Store useful turn output. |
| OpenClaw | compression checkpoint events | Record LCM/compression evidence if exposed. |

The target user-editable policy shape is in `configs/lifecycle-policy.example.yaml`. The current adapters support the environment variables and explicit tools above; full policy-file loading is a roadmap item.
