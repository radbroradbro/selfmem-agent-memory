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
- A same-data autoresearch follow-up tested
  `metadata-aware-full-hybrid-rerank` against `bm25-lite` and
  `full-hybrid-rerank` across the 30-query target. It failed to improve the
  retrieval-proxy score: BM25 stayed at 0.2506 quality, best full-hybrid stayed
  at 0.2351, and the metadata-aware candidate peaked at 0.1121. It is retained
  only as explicit negative-method evidence, not a promoted route.

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
  it is currently blocked because the previous approvals were bound to an
  older result hash and did not bind the actual answer and judge model. Future
  approvals must bind `resultHash`, `targetHash`, `querySetHash`,
  `scoringCodeHash`, `answerLabelsHash`, `answerModel`, `judgeModel`, and the
  strategy set before they count.
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
- The refreshed SOTA operator packet now includes a minimum Voyage
  answer-quality retry flow. It reruns only `bm25-lite`,
  `full-hybrid-rerank`, and `cloud-voyage4-lite-voyage-lite` after the rate
  limit clears, then combines that metrics-only result with the existing local,
  query-expansion, and NVIDIA answer-quality reports before rerunning the
  provider-challenger, memory-score, and SOTA-ladder gates. Evidence:
  `reviews/overnight-20260522/sota-ladder-operator-packet-20260525.json`.
- The release gate now also runs a negative combine test that mutates one
  answer-quality input's query-set hash and confirms
  `benchmark:answer-quality:combine` fails closed. This protects the future
  Voyage retry from being accidentally combined with a different target or
  materialization.
- The answer-quality combiner now also requires every input report to use the
  same answer model and judge model, and the release gate exercises both
  mismatch paths. A future Voyage retry can change the retrieval arm, but not
  silently change the answer-quality judge contract.
- The answer-quality runner now supports deterministic full-target query
  shards with `--query-offset` and `--max-queries`. The combiner's
  `--combine-mode shards` path rejects target/model mismatches, strategy-set
  mismatches, shard overlaps, and shard gaps before it emits a
  `query-shard-answer-quality-union` report. The SOTA operator packet includes
  a ten-shard 500-query LongMemEval-S flow.
- The SOTA ladder now also distinguishes a 30-query canary from a full or
  officially comparable benchmark. The current LongMemEval-S answer-quality
  packet has 30 scored queries, so even a future canary win must remain blocked
  for broad SOTA or production-replacement wording until the full 500-row
  LongMemEval-S set or another official comparable target passes.
- The non-Voyage provider lane did run end-to-end on the same 30-query
  source-locked target. `cloud-nvidia-nemotron-1b` scored `43.1667`
  answerQuality with `0.4333` judge-correct rate, beating the local
  `local-apple-qwen3-0_6b-local-rerank` result of `36` on the current local
  answer-quality judge. Evidence:
  `reviews/overnight-20260522/end-to-end-memory-score-live-provider-20260525.json`.
- The previous two memory-score reviewer approvals no longer count for the
  current combined metrics-only packet because the stricter intake now requires
  exact result-hash and answer/judge-model binding. Evidence:
  `reviews/overnight-20260522/memory-score-reviewer-intake-20260525.json`.
- The query-expansion and local-rerank component gates now recognize the live
  same-data answer-quality evidence while keeping broad SOTA claims disabled.
  Evidence:
  `reviews/overnight-20260522/query-expansion-result-gate-20260525.json` and
  `reviews/overnight-20260522/local-rerank-result-gate-20260525.json`.
- The SOTA ladder now compares the best full-memory answer-quality row against
  the selected reported Supermemory target instead of merely listing reported
  targets. Current best is `cloud-nvidia-nemotron-1b` at `43.1667`; selected
  target is Supermemory's reported LongMemEval-S `85.2%` Gemini 3 Pro row;
  delta is `-42.0333`, so the ladder adds
  `best-end-to-end-score-below-reported-supermemory-target`.
- The end-to-end memory score gate now repeats that comparison in its own
  `fullSotaBlockers` list. The current gate is blocked for the judge mismatch
  with the primary reported target, the missing full or officially comparable
  run, and the below-target score, so `benchmark:memory-score:result-gate
  --require-ready` cannot pass on the 30-query canary.
- The reported target rows now have their own public-safe source-lock artifact:
  `reviews/overnight-20260522/reported-memory-targets-20260525.json`, rendered
  at `reviews/overnight-20260522/reported-memory-targets-20260525.md` and
  validated by `benchmark:reported-targets`. This keeps direct hosted
  Supermemory usage optional when quota is blocked, while still requiring
  source URL, checked date, score, judge, caveat, and comparability conditions
  before the SOTA ladder uses a reported target. Qwen, EmbeddingGemma, Voyage,
  and NVIDIA rows in that artifact remain component/model-selection evidence
  only.
- The end-to-end memory score gate now also checks that the actual answer and
  judge models used by a result match the target contract. The current canary
  result was answered and judged by `qwen36-a3b-main-q8kv-8192` while the
  target contract names `gpt-4o`, so it is explicitly blocked as a harness
  mismatch instead of being allowed to masquerade as a same-judge comparison.
- The answer-quality preflight and live runner now enforce the same model
  contract before scoring starts. This blocks an expensive full benchmark run
  when `RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL` or
  `RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL` differ from the source-locked target.
- This is progress, not launch clearance. The current ladder still lacks a
  same-data Voyage answer-quality row, an at-or-above-target full-memory score,
  final UI/docs refresh after any changed result hash, real rollout evidence,
  and owner approval.

## Claim Boundary

Do not claim RecallWeave is SOTA, production-ready as a Supermemory
replacement, or generally better than hosted memory systems from the current
evidence.

Allowed claim shape:

- The benchmark harness exists and enforces same-data controls.
- BM25-lite is a lexical control and fallback, not the final design.
- Live provider/local arms are opt-in and fail closed without explicit public
  data consent plus env-only provider or local endpoint readiness.
- Existing local Apple, query-expansion, and non-Voyage provider rows include
  same-data answer-quality evidence. They still do not authorize public SOTA or
  Supermemory-replacement wording because the Voyage arm, real rollout, and
  owner approval gates remain open.

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
