# RecallWeave

RecallWeave is a local-first memory layer for agent runtimes. It gives Hermes
and OpenClaw agents a native memory provider that can write new memories
locally, search old hosted Supermemory history as read-only context, and keep
auditable lifecycle logs without committing private data.

The repository contains generic source code only. It does not include provider
keys, private memory exports, agent diagnostics, raw logs, or personal agent
setup packets.

## Why It Exists

Hosted memory quota failures should not stop agents from remembering new work.
RecallWeave keeps the write lane local, lets each agent map to its own
container, and can merge local recall with read-only hosted history when a
Supermemory key and quota are available.

RecallWeave is not affiliated with Supermemory. Supermemory support is a bridge
for users who already have hosted memory history and want a safer migration or
fallback path.

## Current Status

RecallWeave is public alpha software.

- Current native adapters: Hermes and OpenClaw.
- Current runtime id: `selfmem_canary`, kept for compatibility with existing
  setup scripts and installed agents.
- Current cloud-quality path: Voyage embeddings plus Voyage rerank when local
  credentials are configured.
- Current fallback path: local lexical recall and metadata scoring.
- Current hosted bridge: read-only Supermemory search and export-cache search.

Do not treat this release as a proven Supermemory replacement. The included
benchmark notes are metrics-only engineering evidence. A fresh public benchmark
must run before making quality claims.

## Features

- Native Hermes memory provider surface.
- Native OpenClaw memory slot plugin.
- Local-only writes for new memories.
- Optional hosted Supermemory read-through for old history.
- Optional export-cache read-through when hosted quota is exhausted.
- Private-tag redaction before storage, provider calls, logs, and benchmark
  traces.
- Hybrid local search with semantic, lexical, dedupe, rerank, and context
  compilation helpers.
- Nucleus Index contracts for memory nodes, wiki pages, lifecycle events,
  retrieval traces, and editable derived docs.
- Research lineage contracts for source-backed hypotheses, pros, cons, tests,
  decisions, and follow-up questions.
- LLM-wiki compiler and explicit disk-sync rules for Obsidian-compatible vaults
  and the self-hosted brain UI.
- Fixture-safe session compaction benchmark for chronological durable memory
  extraction, exact identifier preservation, stale/private suppression, and
  duplicate merge behavior.
- Lifecycle logs for recall, writes, compression checkpoints, provider errors,
  and privacy counts.
- Dry-run update command for deployed agents.

## Quick Start

Install dependencies and run local verification:

```bash
npm exec --yes pnpm@10.23.0 -- install
npm exec --yes pnpm@10.23.0 -- smoke
```

The standalone smokes use mocked provider calls. They prove code paths,
lifecycle wiring, redaction, hybrid merge behavior, recall gating, and local
cache behavior. They do not prove live provider billing or hosted search
availability.

## Hermes Native Memory

Install the adapter into a Hermes checkout, then set the profile memory provider
to the compatibility id:

```yaml
memory:
  provider: selfmem_canary
```

Use the setup helper to create a local container mapping:

```bash
python3 plugins/selfmem-fallback/scripts/setup-agent-memory.py \
  --host hermes \
  --agent AGENT_NAME \
  --supermemory-container EXISTING_CONTAINER \
  --home ~/.hermes \
  --run-canary
```

## OpenClaw Native Memory

Install the adapter into an OpenClaw profile, then assign the memory slot:

```json
{
  "plugins": {
    "slots": {
      "memory": "selfmem_canary"
    }
  }
}
```

Use the setup helper for the agent mapping:

```bash
python3 plugins/selfmem-fallback/scripts/setup-agent-memory.py \
  --host openclaw \
  --agent AGENT_NAME \
  --supermemory-container EXISTING_CONTAINER \
  --home ~/.openclaw \
  --run-canary
```

## Provider Credentials

Keep credentials on each agent machine. Do not commit `keys.env`, `.env`, auth
files, raw memory files, or diagnostics bundles.

Runtime keys can enable:

- Voyage `voyage-4-large` embeddings.
- Voyage `rerank-2.5` reranking.
- Supermemory read-only history search.
- Optional query expansion through a configured provider.

The repository never ships bundled keys.

Use [.env.example](.env.example) as a template only. Keep real values in the
runtime's private config directory or process environment.

## Agent Update Flow

Runtime updates should use the bundled updater. It is dry-run by default:

```bash
python3 plugins/selfmem-fallback/scripts/selfmem_update.py --host hermes --repo /path/to/hermes
python3 plugins/selfmem-fallback/scripts/selfmem_update.py --host hermes --repo /path/to/hermes --apply
```

Agents should branch from `main`, make a focused change, run the relevant smoke
tests, and open a pull request. If a runtime issue cannot be fixed safely, open
an issue with sanitized logs and no raw memory content.

## Safety Rules

Do not commit keys, raw memories, raw transcripts, `.env`, auth files, browser
state, or private diagnostics. Keep agent-specific container mappings local
unless they have been sanitized into a generic fixture.

Share counts, event names, sanitized stack traces, and version info in issues.
Do not share memory text, raw transcripts, raw JSONL logs, environment files,
auth state, browser state, or provider keys.

## Docs

- [User manual](docs/USER_MANUAL.md)
- [Visual guide](docs/VISUAL_GUIDE.md)
- [Brain UI](docs/BRAIN_UI.md)
- [Compatibility notes](docs/COMPATIBILITY.md)
- [Nucleus Index](docs/NUCLEUS_INDEX.md)
- [Research lineage](docs/RESEARCH_LINEAGE.md)
- [LLM-wiki sync](docs/LLM_WIKI_SYNC.md)
- [Session compaction benchmark](docs/SESSION_COMPACTION_BENCHMARK.md)
- [Lifecycle and LCM notes](docs/LIFECYCLE_AND_LCM.md)
- [System flows](docs/FLOWS.md)
- [Operations guide](docs/OPERATIONS.md)
- [Agent live-build guide](docs/AGENT_LIVE_BUILD_GUIDE.md)
- [Maintainer review guide](docs/MAINTAINER_REVIEW_GUIDE.md)
- [GitHub rules](docs/GITHUB_RULES.md)
- [Security model](docs/SECURITY_MODEL.md)
- [Production readiness](docs/PRODUCTION_READINESS.md)
- [Benchmark summary](docs/BENCHMARK_SUMMARY.md)
- [Product roadmap](docs/PRODUCT_ROADMAP.md)
- [Public release checklist](docs/PUBLIC_RELEASE_CHECKLIST.md)

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
