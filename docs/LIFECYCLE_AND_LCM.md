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
- `agent_end` distills, deduplicates, and stores useful memory locally.
- compression checkpoint events record compact evidence when available.

## Codex

Codex uses local hook wiring rather than the Hermes provider lifecycle. The
current safe audit target is:

- `UserPromptSubmit` runs local recall before the prompt is finalized.
- `Stop` runs local flush after the turn and stores distilled durable
  candidates.
- an explicit local store/write command is available, so the agent can write a
  durable memory intentionally instead of relying only on automatic extraction.
- the lifecycle doctor reports duplicate/noise health before benchmark or
  release claims.
- Raw transcripts and any locally useful private or credential-bearing facts
  stay local; public reports print only counts, hashes, and policy flags.
- Hosted Supermemory write-back stays off unless the operator explicitly
  enables it.

The current Codex hook surface does not expose a native pre-compaction event in
the audited hook file. If Codex later exposes a pre-compact or pre-compress
hook, RecallWeave should record a lifecycle event before any summary replaces
the full session.

DeepSeek v4 flash, or any similar low-cost compression model, is allowed only
as an explicit offline LCM experiment. It must not run during prompt-time recall
by default, must require an operator opt-in, and must not count as benchmark
retrieval or scoring evidence.

## Recall Gate

The recall gate may run periodically or on explicit memory signals. Periodic
recall must still be relevance-gated: short prompts such as "go" or "???" use
the current task anchor, not the literal short text, so unrelated benchmark,
canary, or provider memories are not injected into ordinary turns.

## Write Gate

The write gate should prefer durable facts, preferences, decisions, procedures, bugs, fixes, and methodology notes. It should reject:

- duplicate content,
- status-only content,
- raw role markers,
- unbounded full-session dumps.

Local memory is allowed to preserve private paths, keys, tokens, and credential
facts when the operator intentionally gave them and they are useful for future
work. Those facts should only be recalled for matching key, token, provider, or
credential asks. Public and GitHub-facing artifacts remain leak-checked.

Full raw evidence may remain in a local raw-events file for audit, but prompt
recall should use distilled memory by default.

## Long-Agent Canary

A RecallWeave production-readiness loop must include at least one real
long-agent workflow canary. The actor should use the active memory plugin while
doing the work, not inspect memory only after the run. The canary should prove:

- the current agent runtime is loading the current RecallWeave/Selfmem bridge,
- recall runs before substantive task phases,
- the agent can intentionally store durable memories through an explicit
  memory write path,
- those memories can be retrieved after a session boundary or compaction
  surrogate,
- sub-agents or follow-up agents receive the same container contract when they
  are part of the workflow,
- post-run log health passes: low duplicate rate, no unrelated prompt-context
  injection, bounded transcript volume, and understandable write errors.

Component retrieval benchmarks can guide method choices, but they do not prove
this agent workflow by themselves.

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
