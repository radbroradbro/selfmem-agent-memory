# P0 Provider Rerank And Query Expansion Corrections

Generated: 2026-05-31

## Scope

- Implemented the first high-ROI correctness fixes from the 2026-05-31 RecallWeave review plan.
- External review fallback used DeepSeek V4 Pro after the Claude CLI non-interactive review lane timed out.
- No raw provider keys, raw memories, raw transcripts, or private benchmark text are included here.

## Changes Verified

- Provider rerank outputs now use a rank-position cascade score so negative provider logits cannot be outranked by unranked zero-score tails.
- NVIDIA rerank parser has a synthetic negative-logit parser smoke.
- Query expansion is default-off via `RECALLWEAVE_QUERY_EXPANSION_MODE=off|planner|rewrites`.
- Query expansion rewrites now enter as an auxiliary lane instead of replacing the original query.
- DeepSeek direct query expansion is supported as an OpenAI-compatible provider with thinking disabled for short rewrite calls.
- Query-expansion preflight now recognizes DeepSeek and counts keys behind private key-file env vars without printing them.
- Provider promotion reporting now separates `bestProviderStrategy` from the full-hybrid control and includes paired bootstrap deltas.
- Core `searchHybrid` now accepts an injected ranker so benchmark-selected ranking logic can be wired into runtime without changing the lexical default.
- `atomic-memory-v1` materialization now builds source chunks plus atomic index memories with rehydrate pointers, source hashes, topic/subtopic metadata, and fact counts.
- Retrieval-proxy and answer-quality method ladders now include `atomic-memory-v1` by default and report atomic record counts.

## Evidence

- `node packages/bench/recallweave-response-export.mjs --provider-rerank-cascade-smoke`
  - Passed: provider-ranked docs outrank unranked tails even with negative raw scores.
- `node packages/bench/recallweave-response-export.mjs --nvidia-adapter-parser-smoke`
  - Passed: NVIDIA `rankings` plus `logit` shape preserves provider rank.
- `node packages/bench/recallweave-response-export.mjs --query-expansion-parser-smoke`
  - Passed: parser cases, default mode off, provider order including DeepSeek.
- `node packages/bench/public-benchmark-strategy-compare.mjs --promotion-gate-smoke`
  - Passed: provider winner and hybrid control are distinct; paired deltas and bootstrap CI are present.
- `node packages/bench/public-benchmark-query-expansion-preflight.mjs`
  - Passed implementation contract with query expansion still blocked by default when no provider env is loaded.
- Private-env preflight with explicit provider consent
  - Passed: mixed local/cloud query expansion ready; detected key-file counts for NVIDIA, Gemini, OpenRouter, and DeepSeek without printing values.
- DeepSeek guarded live smoke on synthetic fixture files
  - Passed: 3 query-expansion calls, 6 rewrites returned, 0 fallbacks, provider `deepseek-openai-compatible`, model `deepseek-v4-flash`, 0 privacy leaks, 0 redaction failures.
- `npm exec --yes pnpm@10.23.0 -- benchmark:public-method-ladder -- --fixture`
  - Passed fixture memory-method retrieval-proxy ladder across session, contextual source chunk, contextual index, and atomic-memory methods.
- `npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:method-ladder -- --fixture`
  - Passed response-arm export workorder across the same four memory methods; no answer-quality calls were made without execution consent.
- `node packages/bench/public-benchmark-materialize-run.mjs --fixture --memory-method atomic-memory-v1`
  - Passed: 3 source chunks and 3 atomic records for the fixture, with raw text excluded from the public report.
- `npm exec --yes pnpm@10.23.0 -- benchmark:public-provider -- --fixture`
  - Passed fixture provider gate with paired delta fields.
- `npm exec --yes pnpm@10.23.0 -- brain:smoke:built`
  - Passed benchmark dashboard and Brain UI smoke.
- `npm exec --yes pnpm@10.23.0 -- typecheck`
  - Passed.
- `npm exec --yes pnpm@10.23.0 -- test -- --runInBand`
  - Passed 7 files / 31 tests.

## Remaining Before Next Long Benchmark Wave

- Add cache-decontamination evidence for provider embeddings before promoting any provider default.
- Run a controlled same-data provider wave with explicit consent flags and key-scoped throttling.
- Keep Supermemory hosted search disabled for benchmark methodology runs.
