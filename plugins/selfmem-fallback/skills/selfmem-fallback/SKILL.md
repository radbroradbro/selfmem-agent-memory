---
name: selfmem-fallback
description: Operate the selfmem fallback kit when hosted Supermemory is degraded, when exporting existing Supermemory data, or when running selfmem shadow-memory benchmarks.
---

# Selfmem Fallback

Use this skill when memory writes are blocked, hosted Supermemory is credit-limited, or the user wants a selfmem alternative/fallback lane.

## Operating Rules

- Do not write provider keys to files.
- Do not print provider keys.
- Do not save exported raw memories into another service until the export has been reviewed.
- Keep Supermemory and selfmem benchmark lanes separate.
- Redact `<private>...</private>` and common key shapes before creating reports, traces, wiki pages, or screenshots.
- Preserve full sessions as raw evidence, but inject/search distilled memories first. Raw full-session recall is an audit fallback, not the default.
- Set up per-agent containers only for the target runtime named by the user or operator. Do not touch unrelated agents or machines.
- After a target agent passes canary, make selfmem the native/default memory lane for that agent.
- Search should merge local selfmem plus mapped Supermemory read-through. Dedupe only true copies and keep relevant unique memories from both systems.
- Write new memories locally. Treat hosted Supermemory as read-only history unless the user separately approves a sync-back job.
- Read keys only from environment variables. `VOYAGE_API_KEY` or `SELFMEM_VOYAGE_API_KEY` enables local semantic search/rerank. `SUPERMEMORY_API_KEY` or `SELFMEM_SUPERMEMORY_READ_KEY` enables old hosted Supermemory read-through.

## Triage

1. Run `node plugins/selfmem-fallback/scripts/doctor.mjs`.
2. If Supermemory writes fail but document listing works, export a metadata-only archive first:

```bash
SUPERMEMORY_API_KEY=... node plugins/selfmem-fallback/scripts/supermemory-export.mjs --out ~/Downloads/supermemory-export-redacted
```

3. Export redacted content only when the operator explicitly approves it, then keep the archive out of git:

```bash
SUPERMEMORY_API_KEY=... node plugins/selfmem-fallback/scripts/supermemory-export.mjs --include-content true --out ~/Downloads/supermemory-export-redacted
```

4. Distill the raw/export cache before using it as recall context:

```bash
node plugins/selfmem-fallback/scripts/distill.mjs --out ~/.codex/selfmem-bridge/store/distilled-memories.jsonl
```

5. If a Hermes canary is needed, use `packages/adapters/hermes/selfmem_canary` first. Make it native/default only after its trace shows distilled recall, hybrid search coverage, and clean redaction.
6. For Hermes, identify the current Supermemory container before canary install:

```bash
HERMES_HOME=~/.hermes plugins/selfmem-fallback/scripts/hermes-detect-container.py
```

7. Install the canary provider without editing config:

```bash
HERMES_REPO=/path/to/hermes-agent plugins/selfmem-fallback/scripts/install-hermes-canary.sh
```

8. For per-agent setup, prefer:

```bash
python3 plugins/selfmem-fallback/scripts/setup-agent-memory.py --host hermes --agent AGENT_NAME --supermemory-container EXISTING_CONTAINER --home ~/.hermes --run-canary
python3 plugins/selfmem-fallback/scripts/setup-agent-memory.py --host openclaw --agent AGENT_NAME --supermemory-container EXISTING_CONTAINER --home ~/.openclaw --run-canary
```

9. Run the Hermes lifecycle smoke and confirm LCM/pre-compress, turn sync, memory-write mirroring, session end, prefetch traces, and hybrid read-through coverage before making it native.
10. For benchmark proof, run MemoryBench with identical judge, answer model, dataset slice, and scoring code.

## Current Evidence

- Hosted memory writes may fail while read/list/search paths still work. Treat this as a reason to use local writes plus read-through history.
- Export and benchmark reports must contain metrics only unless an operator explicitly approves local redacted content export.
- Public benchmark claims remain bounded until the same dataset, judge, answer model, and scoring code run cleanly for both selfmem and the baseline system.
- The live Codex bridge has a distilled-memory cache path and should avoid injecting raw export blobs by default.
- The Hermes canary should expose both `selfmem_*` tools and `supermemory_*` compatibility aliases.

## Default Recommendation

Use selfmem as the default/native memory lane for any target agent that passes canary. Use hosted Supermemory as read/export history when configured. Do not switch unrelated agents.
