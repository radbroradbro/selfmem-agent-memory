# @recallweave/core

Core TypeScript utilities for RecallWeave:

- private-tag and key-shape redaction,
- hybrid local search helpers,
- dedupe and distillation helpers,
- query-expansion boundary helpers,
- context compilation,
- Nucleus Index contracts for the brain UI, LLM-wiki sync, lifecycle events,
  and retrieval traces.

Build before publishing:

```bash
npm exec --yes pnpm@10.23.0 -- --filter @recallweave/core build
```

The public runtime adapters still use the legacy `selfmem_canary` id for Hermes
and OpenClaw compatibility.
