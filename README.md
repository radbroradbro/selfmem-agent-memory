# selfmem-agent-memory

Local-first memory adapters and utilities for agent runtimes. The repository contains generic source code only. It does not include provider keys, private memory exports, agent diagnostics, raw logs, or personal agent setup packets.

## What is here

- Hermes `selfmem_canary` memory provider.
- OpenClaw `selfmem_canary` memory plugin.
- Core redaction, hybrid search, dedupe, distillation, and sync helpers.
- Fallback setup and update scripts.
- Privacy and adapter smoke tests.

## Runtime model

New memories write locally. Hosted Supermemory, when configured, is read-only history for search/read-through. Provider credentials stay on each agent machine in local environment files such as `keys.env`; they are never committed.

## Quick verification

```bash
npm exec --yes pnpm@10.23.0 -- install
npm exec --yes pnpm@10.23.0 -- privacy:test
npm exec --yes pnpm@10.23.0 -- typecheck
npm exec --yes pnpm@10.23.0 -- smoke:openclaw
npm exec --yes pnpm@10.23.0 -- smoke:hermes
```

The standalone smokes use mocked provider calls. They prove code paths, lifecycle wiring, redaction, hybrid merge behavior, recall gating, and local cache behavior. They do not prove live provider billing.

## Agent update flow

Agents should branch from `main`, make a focused change, run the relevant smoke tests, and open a pull request. If a runtime issue cannot be fixed safely, open an issue with sanitized logs and no raw memory content.

Runtime updates should use the bundled updater. It is dry-run by default:

```bash
python3 plugins/selfmem-fallback/scripts/selfmem_update.py --host hermes --repo /path/to/hermes
python3 plugins/selfmem-fallback/scripts/selfmem_update.py --host hermes --repo /path/to/hermes --apply
```

## Safety

Do not commit keys, raw memories, raw transcripts, `.env`, auth files, browser state, or private diagnostics. Keep agent-specific container mappings local unless they have been sanitized into a generic fixture.

## Docs

- [User manual](docs/USER_MANUAL.md)
- [Lifecycle and LCM notes](docs/LIFECYCLE_AND_LCM.md)
- [System flows](docs/FLOWS.md)
- [Operations guide](docs/OPERATIONS.md)
- [Benchmark summary](docs/BENCHMARK_SUMMARY.md)
- [Product roadmap](docs/PRODUCT_ROADMAP.md)
