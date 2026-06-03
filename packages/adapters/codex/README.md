# RecallWeave Codex Bridge

This adapter source mirrors the local Codex hook bridge used for RecallWeave
canaries. It is intentionally local-first:

- `UserPromptSubmit` can call `node selfmem-bridge.cjs recall`.
- `Stop` can call `node selfmem-bridge.cjs flush`.
- Explicit durable writes can call `node selfmem-bridge.cjs store`.
- Hosted Supermemory write-back is disabled by default.
- Short explicit writes are preserved whole so identifiers, names, and other
  details survive post-boundary recall.
- Local private paths and credential facts may be preserved in local memory when
  the operator intentionally gave them. GitHub/public evidence is still
  leak-checked separately.
- Prompt-time recall is periodic-or-signal, but periodic recall uses a recent
  meaningful task anchor for short turns so unrelated benchmark or canary
  memories are not injected into ordinary chat.

The bridge stores runtime state under the user's local Codex directory when
installed. Do not commit generated stores, transcripts, key files, or hook
state. Validate a live install with:

```bash
npm exec --yes pnpm@10.23.0 -- codex:live-agent-canary:local
```

When the bridge is in reset mode, keep automatic injection disabled and run the
local health gate first:

```bash
npm exec --yes pnpm@10.23.0 -- codex:memory-reset-health
```

`READY_FOR_CONTROLLED_DOGFOOD` means maintainers can use manual recall and
explicit writes in live work. It is not release approval and it is not a
benchmark score.

After automatic recall is rewired, keep running the same gate and inspect its
`dogfoodMonitor` block. The monitor tracks relevance, retrieval, direct lookup
usefulness, write outcomes, and quiet-prompt behavior without printing raw
memories or transcripts.

For periodic rewire monitoring:

```bash
npm exec --yes pnpm@10.23.0 -- codex:memory-dogfood-monitor:watch
```

Collect a 15-minute metrics-only runtime report for the strict-real canary
contract with:

```bash
npm exec --yes pnpm@10.23.0 -- codex:runtime-canary:local
```

Fixture mode is release-safe and does not write memory:

```bash
npm exec --yes pnpm@10.23.0 -- codex:live-agent-canary
npm exec --yes pnpm@10.23.0 -- codex:runtime-canary
```
