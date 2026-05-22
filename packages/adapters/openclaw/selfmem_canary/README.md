# selfmem_canary OpenClaw Plugin

Local selfmem memory provider for OpenClaw. The package id remains `selfmem_canary` so existing setup scripts and OpenClaw slot mappings keep working.

It maps the current agent's Supermemory container to a local selfmem container, exposes `selfmem_*` tools plus `supermemory_*` aliases, and covers the OpenClaw memory lifecycle.

The adapter preserves OpenClaw profile safety:

- honors `OPENCLAW_STATE_DIR` before `OPENCLAW_HOME`,
- reads `profile-identity.json` as an identity pin fallback,
- suppresses writes in read-only mode when identity is unresolved,
- exports the real plugin loader entry point through `default.register`.

Search merges local selfmem with mapped Supermemory read-through. Voyage semantic search/rerank activates when a Voyage key is present.

Reliability logging:

- `trace.jsonl`: lifecycle, search, store, errors, optional compression checkpoints.
- `raw_events.jsonl`: redacted raw agent output and compression checkpoint evidence.
- `memories.jsonl`: distilled local memories.
- `$OPENCLAW_STATE_DIR/selfmem/audit.py`: local reliability audit.

- `session_start`
- `before_prompt_build`
- `agent_end`
- optional compression checkpoint events when the runtime exposes them
- memory tools

Use `plugins/selfmem-fallback/scripts/setup-agent-memory.py --host openclaw` before enabling it for a real agent.
