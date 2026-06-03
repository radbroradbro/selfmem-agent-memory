# Runtime Context Provenance Bridge - 2026-05-31

## Scope

This note records a runtime parity hardening step after the GPT-5.5 Pro review packet and the follow-up reviewer route. It is public-safe methodology evidence only. It does not authorize production launch, public SOTA language, or Supermemory superiority claims.

## Changes

- `searchHybrid` now passes a sanitized allow-list of retrieval metadata into the context compiler instead of dropping atomic/source provenance.
- The compiled context evidence header now includes safe provenance cues: date, event date, memory kind, retrieval role, title, topic, source, parent session, and rehydrate id.
- Metadata values are redacted, private-path filtered, and truncated before they can enter the compiled context.
- Safe `metadata.sourceId` values are preserved when the candidate lacks a top-level `sourceId`, preventing atomic/source ids from being erased during runtime assembly.
- Atomic/index hits now rehydrate their linked source chunk into compiled context when the source chunk is present in the normalized candidate pool, while keeping the atomic id as the ranked result and citation.
- Runtime trace now reports context rehydration counts so missing source chunks can be spotted as methodology/runtime drift instead of being mistaken for model quality.
- The release readiness post-baseline guard now explicitly recognizes the runtime context/provenance files and the focused hybrid regression test while public launch remains blocked.

## Reviewer Route

- Claude Opus CLI review was attempted with a bounded non-interactive prompt and timed out after 240 seconds without a usable critique.
- DeepSeek V4 Pro was used as the fallback reviewer route with a public-safe summary and no secrets or raw benchmark data.
- DeepSeek's useful partial verdict was `ship-blocked`, with remaining risks focused on provenance stripping, production/benchmark parity, provider/canary coverage, rerank validation, and query expansion tuning.

## Verification

- `npm exec --yes pnpm@10.23.0 -- build`
- `npm exec --yes pnpm@10.23.0 -- test -- tests/hybrid/hybrid-search.test.ts --runInBand`
  - Passed 8 files / 42 tests after the source-rehydration regression cases.
- `npm exec --yes pnpm@10.23.0 -- typecheck`
- `node packages/bench/release-readiness-check.mjs`
- `node packages/bench/goal-completion-audit.mjs`
- `node packages/bench/release-blocker-doctor.mjs`

## Claim Boundary

Allowed claim:

- The runtime context path now preserves sanitized atomic/source provenance for answer assembly, so benchmark materialization evidence is less likely to be lost before the answer model sees it.
- Atomic/index retrieval can now use concise searchable memories for ranking while rehydrating the linked source chunk for answer context when that source chunk is available locally.

Disallowed claims:

- RecallWeave beats Supermemory.
- The current harness is production-ready.
- Atomic memory is promoted to the default based on this wiring patch alone.
