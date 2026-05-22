# Nucleus Index

The Nucleus Index is RecallWeave's shared map for the brain UI, the LLM-wiki,
retrieval traces, lifecycle events, and native memory adapters.

It is not a second memory store. It is a public-safe index over local memory
objects and derived pages. Raw events, raw transcripts, credentials, and private
agent logs stay outside it.

## Nodes

Required node kinds live in `packages/core/src/nucleus/index.ts`:

- `memory`
- `source`
- `wiki_page`
- `derived_doc`
- `session_summary`
- `entity`
- `project`
- `decision`
- `contradiction`
- `research_query`
- `source_claim`
- `hypothesis`
- `lifecycle_event`
- `retrieval_trace`

The UI should treat nodes as inspectable records. Only derived docs and wiki
pages should be directly editable by default. Raw-source edits must go through a
separate import or redaction workflow.

## Edges

Required edge kinds:

- `derived_from`
- `cites`
- `mentions`
- `decides`
- `contradicts`
- `supports`
- `challenges`
- `answers`
- `tests`
- `informs`
- `supersedes`
- `related_to`
- `captured_by`
- `injected_into`
- `syncs_to`
- `edited_by`

The first UI milestone should show these relationships as a searchable graph and
as plain tables. Graph visuals are useful only when the user can still inspect
the underlying rows.

## Hybrid Retrieval Visibility

Every context packet should be able to produce a `retrieval_trace` node. The
trace must show:

- dense semantic candidates,
- sparse lexical candidates,
- graph candidates,
- temporal candidates,
- fusion rank changes,
- rerank rank changes,
- final injected context.

This matters because a memory can retrieve well in tests and still fail in
production if it never appears in prompt context.

## Native Memory Optimization

RecallWeave should not flatten every host into one generic hook model.

Hermes should use its native provider lifecycle, including prefetch,
`sync_turn`, `on_pre_compress`, `on_memory_write`, and `on_session_end` when
available. OpenClaw should use `session_start`, `before_prompt_build`, and
`agent_end`. Codex, Claude Code, OpenCode, and MCP should use their own native
recall/write surfaces.

The Nucleus Index makes those different host events comparable without forcing
the runtimes to behave identically.

## Sleep Cycle

Hermes already has sleep/compression-style lifecycle behavior. RecallWeave's
sleep-cycle work should plug into that rhythm instead of replacing the runtime.

Target phases:

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

The cycle must be cost-bounded and locally auditable. Agents may run it
overnight, but protected phases must require explicit policy if they call paid
LLMs or hosted providers.

## Public Evidence

Public screenshots, screen recordings, fixtures, and review packets may show the
Nucleus shape only with sanitized fixture data.

Forbidden in public evidence:

- raw memories,
- raw transcripts,
- private docs,
- credentials,
- private file paths,
- private agent logs,
- real user memory pages.

## Research Lineage

Research lineage is part of the Nucleus Index. Each important research pass
should produce nodes for the query, extracted claims, hypothesis, pros, cons,
tests, and decision. Edges should show whether a source supports, challenges,
answers, tests, or informs the hypothesis.

This lets RecallWeave improve its own architecture without losing why a decision
was made. See `docs/RESEARCH_LINEAGE.md`.
