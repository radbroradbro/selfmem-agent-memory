# Product Roadmap

This roadmap tracks useful user-facing features without mixing them into the current release claim. The current release is a safe local write lane, hybrid recall, lifecycle logging, and update workflow. The items below are planned or experimental unless marked current.

## Current

- Hermes and OpenClaw native memory adapters.
- Local writes with optional hosted Supermemory read-through.
- Compatibility aliases for `supermemory_*` tool names.
- Voyage embedding and rerank when local credentials are present.
- Maintenance/status recall skip gate.
- Lifecycle traces for recall, writes, compression checkpoints, provider errors, and privacy counts.
- `selfmem_update` for dry-run updates and safer agent patching.
- Fixture-safe Nucleus-to-wiki compiler and explicit disk-sync helper with
  reviewed-page conflict protection.
- Fixture-safe Brain UI panels for graph/editor, container health, Nucleus
  snapshot, research lineage, compiled vault preview, and dry-run sync report.
- Read-only local-container audit preflight that returns counts and health
  reasons without exposing raw memory content or private paths.

## Brain UI

Goal: a self-hosted view of each agent's memory container that is easy to inspect without Obsidian.

The first UI should show:

- local container name,
- mapped Supermemory container,
- memory counts by type,
- newest writes,
- duplicate clusters,
- lifecycle event health,
- redaction count,
- provider mode,
- search preview with no raw private text unless explicitly opened locally.

The UI should read local RecallWeave stores directly and should not upload memories to a hosted service.

## LLM Wiki And Obsidian View

Karpathy-style LLM wiki tools use a simple pattern: immutable raw sources, generated markdown wiki pages, a schema/rules file, `index.md`, and `log.md`. Current public implementations also emphasize wikilinks, provenance, linting, contradiction checks, manual edit protection, and provider flexibility.

For RecallWeave, this should become an optional view layer:

- `sources/` stores immutable redacted source copies or source references.
- `wiki/` stores generated pages for people, projects, workflows, bugs, decisions, and concepts.
- `index.md` gives the agent a compact map of memory.
- `log.md` records ingest and maintenance operations.
- `schema.md` or `AGENTS.md` defines citation, tagging, and lint rules.
- Obsidian can open the folder, but Obsidian is optional.
- The Brain UI should read the same wiki graph for users who do not want Obsidian.
- Current sync writes compiled, lint-clean files only after an explicit apply
  call. If a page is marked `reviewed: true`, sync writes a conflict note rather
  than overwriting it.

References for the design direction:

- https://github.com/Ar9av/obsidian-wiki
- https://github.com/green-dalii/obsidian-llm-wiki
- https://github.com/kytmanov/obsidian-llm-wiki-local
- https://robincartier.com/wiki/wiki-concepts/llm-knowledge-bases/

## Central Store Option

Goal: let several agents share a central memory store without forcing every agent to keep large local files.

Candidate modes:

- local-only default for lowest latency and simplest privacy,
- local primary plus periodic central backup,
- central read-through with local write buffer,
- central primary only for agents with stable network and small disk.

The central store should expose the same container mapping model as local RecallWeave. It should never pool unrelated agents into one global namespace unless a user deliberately creates a shared team container.

Open design questions:

- SQLite over sync is risky. Prefer a real service boundary for shared writes.
- Postgres plus `pgvector` is a practical central option.
- Qdrant or another vector service can be useful, but it should not replace the raw local/audit substrate.
- Network latency means prompt-time recall should keep a small local cache.

## Self-Hosted Models

Cloud Voyage remains the current default cloud-quality arm. Future self-hosted modes should support:

- local embedding service,
- local reranker,
- local query expansion,
- local distillation,
- OpenAI-compatible endpoint routing.

Self-hosted models should be benchmark arms, not silent fallbacks. Changing embedding models changes the vector space, so the index must be rebuilt or kept separate.

## Lifecycle Policy Controls

Goal: make memory behavior editable by users instead of buried in code.

Current controls:

- `SELFMEM_RECALL_EVERY_TURN=1` forces recall on every prompt.
- `SELFMEM_RERANK_CANDIDATE_LIMIT` changes how many candidates enter rerank.
- `SELFMEM_RERANK_TOKEN_BUDGET` caps rerank token use.
- Explicit `selfmem_store` writes force a durable memory write.
- Explicit `selfmem_search` forces a memory search.

Planned controls:

- per-event enable/disable settings,
- force-write rules for LCM/pre-compress events,
- skip rules for diagnostics and heartbeat traffic,
- max writes per session,
- minimum importance threshold,
- review queue for low-confidence writes,
- UI toggles for recall frequency and write aggressiveness.

See `configs/lifecycle-policy.example.yaml` for the target shape.
