# Benchmark SOTA Readiness Evidence - 2026-05-25

## Purpose

This note captures the current benchmark-readiness state after the supervisor
loop was corrected away from a narrow production-canary wait and back toward
the intended method-quality gate: same-data benchmark arms, local-model runs,
provider comparisons, autoresearch iteration, external review, UI verification,
and docs/release notes before any production or SOTA-style claim.

## Commands Rerun

```bash
npm exec --yes pnpm@10.23.0 -- benchmark:public-target
npm exec --yes pnpm@10.23.0 -- benchmark:public-materialize
npm exec --yes pnpm@10.23.0 -- benchmark:public-strategy
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider:preflight
npm exec --yes pnpm@10.23.0 -- benchmark:public-autoresearch
npm exec --yes pnpm@10.23.0 -- goal:audit
```

Supermemory recall was also attempted and returned no matches, which is
consistent with the hosted Supermemory usage/depletion context. The benchmark
decision below therefore relies on the local-first bridge context plus live
repository evidence.

## Current Findings

- The default public target check is fixture-only and explicitly reports
  `publicBenchmarkClaimsAllowed: false`, `publicSliceRunReady: false`, and
  `targetReadyForCanary: false`. It is structurally useful, but it cannot
  support a public score.
- The default materialization run is fixture-only and says the next real step
  is `--live` against the source-locked target while keeping private query and
  memory files outside the repository.
- The default strategy comparison is fixture-only, retrieval-proxy-only, and
  explicitly keeps `publicBenchmarkClaimsAllowed: false`. BM25-lite is present
  as a lexical floor, not as the intended final system.
- The default autoresearch loop is fixture-only, retrieval-proxy-only, and
  explicitly keeps `publicBenchmarkClaimsAllowed: false`. It proves the loop
  executes and enforces a same-data contract; it does not prove SOTA or
  end-to-end memory quality.
- The provider preflight reaches the real source-locked LongMemEval target, but
  status is `BLOCKED_PROVIDER_ENV` because provider-call consent,
  public-data-transfer consent, and the env-only provider or local Apple
  endpoint readiness are absent in this shell.
- Existing docs and evidence already record the stronger live retrieval-proxy
  state: BM25-lite remains the local fallback on the 30-query LongMemEval-S
  stress slice, Voyage-backed arms trend better but slower, Apple 0.6B and 4B
  local embedding arms did not beat BM25 on quality, and the next local method
  challenger is the local Apple embedding lane plus a local reranker sidecar.

## Component Benchmark Research Checked Live

Component leaderboards should decide which embedding and reranker arms enter
the matrix. They must not replace the full memory benchmark.

- MTEB is an embedding benchmark family, not a complete agent-memory benchmark.
  The MTEB paper describes eight embedding task families across many datasets
  and languages, and notes that no one embedding method dominates all tasks.
  This is useful model-selection evidence, not a RecallWeave memory score.
  Source: https://arxiv.org/abs/2210.07316
- The public MTEB/Hugging Face surface remains active and large, with current
  MTEB leaderboards and datasets updated in 2026. Source:
  https://huggingface.co/mteb
- Qwen's official Qwen3-Embedding repository reports MTEB English v2 scores
  that make local Qwen larger-model testing reasonable: Qwen3-Embedding-0.6B
  at 70.70 mean task, Qwen3-Embedding-4B at 74.60, and Qwen3-Embedding-8B at
  75.22. It also reports reranker retrieval-subset scores such as
  Qwen3-Reranker-0.6B at 65.80 and Qwen3-Reranker-4B at 69.76. Source:
  https://github.com/QwenLM/Qwen3-Embedding
- Voyage's model documentation positions `voyage-4-large` as the best
  general-purpose and multilingual retrieval-quality model in the Voyage 4
  series, with `rerank-2.5` as the highest-accuracy reranker and
  `rerank-2.5-lite` as the latency-oriented reranker. Source:
  https://www.mongodb.com/docs/voyageai/models/
- Supermemory's public research page reports LongMemEval-S memory-system
  numbers: 81.6% overall with gpt-4o judging, 84.6% with gpt-5, and 85.2%
  with gemini-3-pro. A later Supermemory blog reports an experimental,
  non-production agentic ASMR flow at roughly 99%, and explicitly labels it a
  parody/social experiment rather than their core production engine. Sources:
  https://supermemory.ai/research/ and
  https://supermemory.ai/blog/we-broke-the-frontier-in-agent-memory-introducing-99-sota-memory-system/

Implication: local model selection should start from Qwen3 4B/8B embedding and
Qwen3 reranker evidence where hardware allows, with the 0.6B lane kept as the
consumer-hardware floor. Cloud/provider challengers should include Voyage 4
plus Voyage Rerank 2.5 and the NVIDIA/Gemini arms already represented in the
provider matrix. The full score still has to come from RecallWeave running on a
source-locked memory benchmark such as LongMemEval-S, not from MTEB alone.

Query expansion is allowed as its own benchmark variable. The local benchmark
does not have to pretend every substep is local if the useful experiment is a
mixed arm. Preferred order:

1. Test a small current local instruction model through an env-only local
   OpenAI-compatible endpoint for bounded query rewrites.
2. If local context, latency, or quality is the bottleneck, test a clearly
   labeled cloud query-expansion arm, such as an NVIDIA-hosted model call, while
   keeping embeddings/rerank/local stages separate in the report.
3. Never label a mixed query-expansion run as pure local. It is still valid
   method evidence if the cloud substep is explicit, costed, and reviewed.

Live research checked on 2026-05-25 supports this ladder: NVIDIA NIM exposes
current retrieval and rerank endpoints; a 2026 WSDM Cup retrieval pipeline used
LLM-based query expansion before sparse retrieval, dense ranking, and Qwen3
reranking under limited compute; and current May 2026 local-model radar points
to Qwen 3.6 and Gemma 4 family models as plausible query-expansion candidates
that still need local measurement on this machine.

Follow-up implementation evidence on 2026-05-25:

- `query-expanded-full-hybrid-rerank` can now call a configured live
  query-expansion endpoint instead of only the deterministic proxy.
- The default remains fail-closed: with no local endpoint or explicit
  mixed-cloud consent, query expansion falls back to the deterministic proxy
  and the preflight reports `BLOCKED_QUERY_EXPANSION_ENV`.
- A pure-local fixture server smoke produced three local-expander calls,
  exported metrics only, and observed no stored-memory payload marker.
- This is wiring proof only. It is not a same-data quality result and does not
  satisfy the missing live LLM query-expansion benchmark row.
- `benchmark:answer-quality:preflight` now exists as a fail-closed live-run
  readiness check for the answer-quality harness. Evidence is checked in at
  `reviews/overnight-20260522/answer-quality-preflight-20260525.json` and
  currently blocks because the clean shell has no model-call consent,
  public-data consent, no-raw-output consent, private materialized inputs, or
  response arm exports.
- `benchmark:answer-quality:arms` now exists as the fail-closed response-arm
  export step before answer-quality scoring. Evidence is checked in at
  `reviews/overnight-20260522/answer-quality-arm-export-20260525.json`; it
  keeps the clean shell blocked, names the missing private input/export consent,
  and verifies the required BM25, full-hybrid, query-expansion, provider,
  local Apple, and local rerank arm plan.
- `benchmark:answer-quality` exists as the explicit conversion step from
  retrieval-proxy evidence to end-to-end answer-quality evidence. Fixture smoke
  evidence is checked in at
  `reviews/overnight-20260522/answer-quality-harness-smoke-20260525.json` and
  proves metrics-only output, strategy scoring shape, no provider calls, and
  fail-closed public-claim flags.
- The answer-quality harness is not complete benchmark proof until it is run
  with `--live` against private materialized LongMemEval inputs, private answer
  labels, and per-strategy response exports, then reviewed through
  `benchmark:memory-score:reviewer-intake` and passed through
  `benchmark:memory-score:result-gate --require-ready`.
- `benchmark:memory-score:reviewer-intake` now exists as the fail-closed
  reviewer-binding step for the exact metrics-only answer-quality packet.
  Evidence is checked in at
  `reviews/overnight-20260522/memory-score-reviewer-intake-20260525.json`;
  it currently blocks because the only local answer-quality result is a
  fixture smoke and there are no two independent bound approvals.
- The live answer-quality output may contain strategy names, hashes, aggregate
  answer-quality metrics, judge-correct rate, latency, context-token counts,
  provider endpoint labels, cost, and privacy counters. It must not contain raw
  questions, gold answers, candidate answers, memory text, prompts, transcripts,
  private paths, or keys.

Follow-up provider evidence on 2026-05-25:

- A scrubbed provider preflight passed for `cloud-voyage4-voyage` and
  `cloud-nvidia-nemotron-1b` on the source-locked LongMemEval target with
  provider-call consent, public-data consent, and env-only credentials present.
  Evidence:
  `reviews/overnight-20260522/public-longmemeval-expanded-provider-live-preflight-voyage-nvidia-20260525.json`.
- The full `cloud-voyage4-voyage` arm and the lower-call
  `cloud-voyage4-lite-voyage-lite` fallback both hit Voyage HTTP 429 after
  retry/backoff and provider pacing. Evidence:
  `reviews/overnight-20260522/voyage-provider-rate-limit-20260525.json`.
  This remains a hard SOTA-ladder blocker.
- The non-Voyage provider lane did run end-to-end on the same 30-query
  source-locked target. `cloud-nvidia-nemotron-1b` scored `43.1667`
  answerQuality with `0.4333` judge-correct rate, beating the local
  `local-apple-qwen3-0_6b-local-rerank` result of `36` on the current local
  answer-quality judge. Evidence:
  `reviews/overnight-20260522/end-to-end-memory-score-live-provider-20260525.json`.
- This is progress, not launch clearance. The current ladder still lacks a
  same-data Voyage answer-quality row, two independent reviewers, UI/docs
  refresh against the final result, and owner approval.

## Claim Boundary

Do not claim RecallWeave is SOTA, production-ready as a Supermemory
replacement, or generally better than hosted memory systems from the current
evidence.

Allowed claim shape:

- The benchmark harness exists and enforces same-data controls.
- BM25-lite is a lexical control and fallback, not the final design.
- Live provider/local arms are opt-in and fail closed without explicit public
  data consent plus env-only provider or local endpoint readiness.
- Existing provider and local Apple evidence is retrieval-proxy evidence, not a
  full MemoryBench or end-to-end memory score.

Blocked claim shape:

- Any broad public benchmark score.
- Any SOTA claim.
- Any statement that BM25-lite proves the intended hybrid memory system.
- Any production launch claim before returned production canary evidence and
  human approval.

## Next Benchmark Ladder

1. Run a live same-data expanded target comparison over at least:
   `bm25-lite`, vector or dense-only control, full hybrid, full hybrid plus
   rerank, the best Voyage 4 plus Voyage rerank arm, the selected NVIDIA or
   Gemini challenger arm, and the local Apple arm.
2. Add the local reranker sidecar challenger for the Apple lane before treating
   local-model benchmarking as complete.
3. Compare against source-supported reported target stats under matching metric
   definitions when hosted Supermemory usage is depleted.
4. Feed the losing gaps back into `benchmark:public-autoresearch` rather than
   promoting the current winner by default.
5. Package a metrics-only review packet and require independent Gemini/Claude
   or NVIDIA/DeepSeek-style review before any public performance claim.
6. Re-check the self-hosted brain UI, benchmark dashboard, docs, and release
   notes after the benchmark result changes.

## Goal State

`goal:audit` still reports `goalComplete: false` and
`mayCallUpdateGoalComplete: false`. This readiness note does not satisfy the
remaining launch gates; it records the benchmark methodology correction and
the next real work needed before a production/SOTA claim.
