# Public Benchmark Targets

This file defines the benchmark lane to use when hosted Supermemory write quota
is exhausted. RecallWeave does not need hosted Supermemory writes to evaluate
memory quality. The main objective is to run RecallWeave on a real public
benchmark slice, compare the result to source-locked published targets, then
iterate through autoresearch until the canary trend beats those targets.

## Rule

Use public benchmark data first.

Hosted Supermemory is useful for product parity and read-through behavior, but
it is not the only baseline. When hosted quota is locked, do not block the
benchmark loop on hosted writes. Run RecallWeave against a source-locked slice
from MemoryBench, LongMemEval, LoCoMo, ConvoMem, BEAM, or another documented
memory benchmark, then compare the metrics to published leaderboard or provider
reports.

Same data means same public benchmark source, repository or dataset revision,
split, question ids where available, answer labels, judge rule, and scoring
script. A custom memory set can be useful for product QA, but it is not the
benchmark lane unless it is clearly labeled as a private canary.

Run the target validator before starting a public canary:

```bash
npm exec --yes pnpm@10.23.0 -- benchmark:source-lock -- --strict
npm exec --yes pnpm@10.23.0 -- benchmark:public-slice -- --live \
  --output reviews/overnight-20260522/public-longmemeval-slice-evidence.json \
  --markdown-output reviews/overnight-20260522/public-longmemeval-slice-evidence.md
npm exec --yes pnpm@10.23.0 -- benchmark:public-target:author -- \
  --slice-manifest reviews/overnight-20260522/public-longmemeval-slice-evidence.json \
  --claim-tier run-only \
  --judge-model gpt-4o \
  --answer-model gpt-4o \
  --judge-rule <source-locked-judge-rule> \
  --output reviews/overnight-20260522/public-longmemeval-run-target.json
npm exec --yes pnpm@10.23.0 -- benchmark:public-target -- \
  --target reviews/overnight-20260522/public-longmemeval-run-target.json \
  --strict-run
npm exec --yes pnpm@10.23.0 -- benchmark:public-materialize -- --live \
  --target reviews/overnight-20260522/public-longmemeval-run-target.json \
  --output reviews/overnight-20260522/public-longmemeval-materialize-run.json \
  --markdown-output reviews/overnight-20260522/public-longmemeval-materialize-run-evidence.md
npm exec --yes pnpm@10.23.0 -- benchmark:public-strategy -- --live \
  --target reviews/overnight-20260522/public-longmemeval-run-target.json \
  --output reviews/overnight-20260522/public-longmemeval-strategy-compare.json \
  --markdown-output reviews/overnight-20260522/public-longmemeval-strategy-compare-evidence.md
npm exec --yes pnpm@10.23.0 -- benchmark:public-autoresearch -- --live \
  --target reviews/overnight-20260522/public-longmemeval-run-target.json \
  --output reviews/overnight-20260522/public-longmemeval-autoresearch-loop.json \
  --markdown-output reviews/overnight-20260522/public-longmemeval-autoresearch-loop-evidence.md
npm exec --yes pnpm@10.23.0 -- benchmark:public-target -- --target <target.json> --strict
```

Use the target author when a benchmark slice has been source-locked but the
target JSON does not exist yet:

```bash
npm exec --yes pnpm@10.23.0 -- benchmark:public-target:author -- \
  --benchmark longmemeval \
  --source-url https://github.com/supermemoryai/memorybench \
  --dataset-revision <source-locked-commit-or-dataset-version> \
  --split <public-split-or-canary-slice> \
  --question-ids-file <public-question-ids.txt> \
  --answer-labels-ref <public-label-file-or-dataset-ref> \
  --answer-labels-hash sha256:<label-hash> \
  --judge-model <same-judge-model> \
  --answer-model <same-answer-model> \
  --source-lock-note <why-this-is-the-same-data-and-scorer> \
  --judge-rule <source-locked-judge-rule> \
  --scoring-script-ref <official-or-memorybench-scorer-ref> \
  --scoring-code-hash sha256:<scorer-hash> \
  --reported-source-name <leader-or-provider-row> \
  --reported-source-url <reported-row-url> \
  --reported-metric-name <matching-metric> \
  --reported-score <score> \
  --reported-caveat <why-this-row-is-comparable-or-limited> \
  --output <target.json>
```

The validator is metrics-only. It prints hashes and counts, not raw labels,
question text, memory text, transcripts, private paths, or credentials.

## Claim Tiers

| Tier | Evidence | Allowed wording |
| --- | --- | --- |
| Fixture | Parser or UI fixture only. | "The harness shape works." |
| Run only | A real source-locked benchmark slice is ready to run, but no reported comparison row is attached yet. | "RecallWeave can now run on the same public benchmark slice." |
| Canary trend | RecallWeave beats a reported target on a small source-locked slice with matching metric definitions. | "The canary is trending toward a win against reported leaders." |
| Public benchmark | Full or officially comparable benchmark run with source lock, metric parity, reviewer approval, and privacy scan. | "RecallWeave beat the reported target on this benchmark setup." |
| Broad SOTA | Multiple full comparable benchmarks, same metric definitions, reviewer approval, and reproducible artifacts. | "RecallWeave is stronger across the tested benchmark suite." |

Do not call a canary trend a full benchmark win. Do not compare RecallWeave
accuracy to a reported provider score unless the dataset variant, metric, judge,
answer model, token budget, and scoring code are stated.

## Component Benchmarks

MTEB, MMTEB, BEIR, MIRACL, MS MARCO, and reranker leaderboards are component
benchmarks. Use them to choose embedding and reranking arms, including Gemini
Embedding 2, Voyage, NVIDIA, Qwen, Jina, BGE, GTE, and local Apple Silicon
options. They do not prove full memory-system quality by themselves.

Report component scores separately from memory scores:

- `embeddingBenchmark`: MTEB/MMTEB/BEIR/MIRACL-style score,
- `rerankerBenchmark`: reranker task score,
- `memoryBenchmark`: MemoryBench, LongMemEval, LoCoMo, ConvoMem, BEAM, or
  another end-to-end memory benchmark,
- `productionCanary`: one-agent real runtime reliability and latency evidence.

An embedding arm can win MTEB and still lose RecallWeave memory quality if
chunking, query expansion, temporal handling, graph traversal, or prompt budget
is wrong. The autoresearch loop should let the full memory benchmark decide.

## Seed Targets

These are targets for planning, not proof that the cited systems used the same
harness we will use.

| Source | Benchmark | Reported metric | Target | Caveat |
| --- | --- | --- | ---: | --- |
| Supermemory README | LongMemEval | result | 81.6% | Reported as #1 by provider; match metric before using. |
| Supermemory README | LoCoMo | rank | #1 | No numeric score in the checked README lines. |
| Supermemory README | ConvoMem | rank | #1 | No numeric score in the checked README lines. |
| Mem0 state report | LoCoMo | score | 92.5 | Reported provider result with average tokens per query. |
| Mem0 state report | LongMemEval | score | 94.4 | Reported provider result with average tokens per query. |
| Mem0 state report | BEAM 1M | score | 64.1 | Use only when the BEAM slice and context depth match. |
| Mem0 state report | BEAM 10M | score | 48.6 | Use only when the BEAM slice and context depth match. |

## Source Lock Notes

- MemoryBench is the preferred harness because it exposes provider, benchmark,
  judge, answer model, run id, question limits, and checkpointed
  ingest-index-search-answer-evaluate-report phases. Its documented benchmark
  names are `locomo`, `longmemeval`, and `convomem`.
- Current MemoryBench source lock: `supermemoryai/memorybench` `main` at
  `118209a746d97d0d85e5a7234267f0b6962857e9`, checked on 2026-05-23.
  The source-lock artifact records the benchmark contract, provider contract,
  dataset source URLs, and key file hashes without raw questions or labels. For
  independent verification, run the source-lock checker with
  `--repo-checkout <memorybench-checkout>` against a local MemoryBench clone.
- MemoryBench's MemScore is a triple: quality, latency, and context tokens. Do
  not collapse that into one score.
- Current LongMemEval-S public slice manifest: dataset hash
  `sha256:d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`,
  500 public dataset rows, 6 selected canary rows, one row per source-locked
  question type, selected-id hash
  `sha256:686da163b61d343549768cdccd890a46ce775b653414932bdd07aec2ccdd3a23`,
  answer-label hash
  `sha256:423098446f2953b45fe049fbd9da0b8d806050d4aed6cdec2a349f167ce1fa3e`,
  and scoring-code hash
  `sha256:f9d889e173f83b68e64d7221121f51bb3cf289bb921aacf36d95080d4b0a9518`.
  The manifest does not commit raw question ids, question text, answers,
  memories, or transcripts.
- Current LongMemEval-S run target:
  `reviews/overnight-20260522/public-longmemeval-run-target.json`. It is
  generated from the slice manifest with `claimTier: run-only`; it passes
  `benchmark:public-target -- --strict-run` and keeps comparison claims blocked
  until a source-locked reported target row passes `--strict`.
- Current LongMemEval-S private materialization:
  `reviews/overnight-20260522/public-longmemeval-materialize-run.json`. It
  confirms the same dataset hash and deterministic selected-id hash, writes the
  raw query set and haystack sessions only to an operator-private directory,
  and commits only counts, hashes, and command templates. The materialized
  slice has 6 queries, 287 haystack sessions, and 18 expected references. It
  also emits the collector-compatible query-set hash so the release gate can
  prove the checked-in RecallWeave result came from the materialized same-data
  query set. Its command template now names `bm25-lite`, an 800-token context
  budget, and top-5 retrieval as the current canary setting.
- Current RecallWeave retrieval-proxy run:
  `reviews/overnight-20260522/public-longmemeval-recallweave-run-result.json`.
  It uses the source-locked LongMemEval-S canary data with the local
  RecallWeave response exporter and the repository's retrieval metrics. It
  uses `bm25-lite-b800-k5` and reports quality 0.4541, P@1 0.8333, recall@5
  0.2917, recall@10 0.2917, NDCG@10 0.3996, p50 latency 73 ms, p95 latency
  78 ms, average context tokens 800, zero cost, and zero redaction failures.
  This is a retrieval-proxy
  baseline, not a MemoryBench answer-quality win and not a public benchmark
  claim. The result JSON carries explicit `retrievalProxyOnly: true`,
  `memoryBenchAnswerQuality: false`, and `publicBenchmarkClaimsAllowed: false`
  flags so it cannot be separated from that caveat.
- Current LongMemEval-S retrieval strategy comparison:
  `reviews/overnight-20260522/public-longmemeval-strategy-compare.json`. It
  runs `jaccard`, `bm25-lite`, and `hybrid-v1` on the same materialized query
  set. The initial `jaccard` baseline scored quality 0.1089 and P@1 0.1667.
  `bm25-lite` won the retrieval-proxy canary with quality 0.4541, P@1
  0.8333, recall@5 0.2917, recall@10 0.2917, NDCG@10 0.3996, p50 latency
  84 ms, p95 latency 92 ms, and zero privacy or redaction failures.
  `hybrid-v1` tied quality but was slower. This is a methodology signal for
  autoresearch, not MemoryBench answer-quality proof.
- Current LongMemEval-S autoresearch loop:
  `reviews/overnight-20260522/public-longmemeval-autoresearch-loop.json`. It
  runs 24 retrieval-proxy arms over strategy, context budget, and candidate
  limit on the same materialized query set. The winning arm is
  `bm25-lite-b800-k5`, which keeps quality 0.4541 and P@1 0.8333 while cutting
  average context tokens to 800. This is a local-only methodology result, not
  official MemoryBench answer-quality proof.
- LongMemEval is a strong target because it uses 500 human-curated questions and
  tests information extraction, multi-session reasoning, knowledge update,
  temporal reasoning, and abstention.
- LongMemEval-V2 is a May 2026 watch target for agent-work memory because it
  focuses on state recall, dynamic state tracking, workflow knowledge,
  environment gotchas, and premise awareness. Treat it as a custom-benchmark
  candidate until its data, scoring code, and comparable target rows are
  source-locked.
- Reported provider scores are useful objective targets, but they are weaker
  than same-harness head-to-head runs. Every target row must keep its source URL
  and date checked.

## Sources Checked

- https://github.com/supermemoryai/memorybench
- https://supermemory.ai/docs/memorybench/integrations
- https://github.com/supermemoryai/supermemory/blob/main/README.md
- https://mem0.ai/blog/state-of-ai-agent-memory-2026
- https://openreview.net/pdf?id=wIonk5yTDq
- https://ai.google.dev/gemini-api/docs/models/gemini-embedding-2
- https://huggingface.co/Qwen/Qwen3-Embedding-0.6B
- https://huggingface.co/mteb
- https://arxiv.org/abs/2210.07316
- https://arxiv.org/abs/2605.12493
