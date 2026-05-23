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
