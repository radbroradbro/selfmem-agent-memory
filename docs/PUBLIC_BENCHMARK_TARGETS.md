# Public Benchmark Targets

This file defines the benchmark lane to use when hosted Supermemory write quota
is exhausted. RecallWeave does not need hosted Supermemory writes to evaluate
memory quality. The main objective is to run RecallWeave on a real public
benchmark slice, compare the result to source-locked published targets, then
iterate through autoresearch until the canary trend beats those targets.

## Rule

Use public benchmark data first.

Do not test RecallWeave alone for quality. A solo run is a smoke test, not a
comparison. Every quality report must name the same-data comparators and the
claim tier it supports.

Minimum same-data matrix:

- lexical control: BM25-lite or another transparent sparse floor,
- current RecallWeave hybrid arm: sparse, dense, graph/topic, temporal, and
  rerank/query-expansion channels where available. In local-only mode these may
  be deterministic proxies; in provider mode they must be real embedding and
  reranking calls,
- provider-backed hybrid arm: Voyage, Gemini, NVIDIA, or local Apple Silicon
  embeddings/rerankers only after the provider preflight allows the run,
- public target row: source-locked reported score or leaderboard row with the
  same benchmark variant and metric definition,
- hosted Supermemory parity: read-only product-parity baseline when quota and
  source alignment allow it.

The acceptance ladder is one-way. Beating BM25 only proves that the retrieval
stack clears the lexical floor. It does not prove RecallWeave beats other
memory systems. To support that stronger claim, a run must also beat or match a
source-locked external target row under comparable metric definitions, or beat a
same-data hosted parity run that passed source alignment and reviewer intake.
If BM25 beats the hybrid arm, treat that as a failed methodology iteration and
optimize the hybrid stack rather than promoting BM25 as the product goal.

Hosted Supermemory is useful for product parity and read-through behavior, but
it is not the only baseline. When hosted quota is locked, do not block the
benchmark loop on hosted writes. Run RecallWeave against a source-locked slice
from MemoryBench, LongMemEval, LoCoMo, ConvoMem, BEAM, or another documented
memory benchmark, then compare the metrics to published leaderboard or provider
reports.

Same data means same public benchmark source, repository or dataset revision,
split, question ids where available, answer labels, judge rule, and scoring
script. The exact answer model and judge model are part of that contract: a
result must report the actual models used during scoring, and
`benchmark:memory-score:result-gate` fails closed when they do not match the
target. `benchmark:answer-quality:preflight` and the live answer-quality runner
also enforce this before scoring starts. A custom memory set can be useful for
product QA, but it is not the benchmark lane unless it is clearly labeled as a
private canary.

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
npm exec --yes pnpm@10.23.0 -- benchmark:public-hybrid -- --live \
  --target reviews/overnight-20260522/public-longmemeval-run-target.json \
  --output reviews/overnight-20260522/public-longmemeval-hybrid-gate.json \
  --markdown-output reviews/overnight-20260522/public-longmemeval-hybrid-gate-evidence.md
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
| Lexical floor | RecallWeave beats BM25-lite on the same source-locked slice, with zero privacy failures. | "The retrieval stack clears the lexical floor on this canary." |
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

For local model selection, prefer source-backed MTEB v2 or reranker evidence
before spending Apple Silicon time. Current source-backed candidate ordering is:

- quality-first local embedding challenger: Qwen3 Embedding 4B or 8B where
  memory and latency allow,
- consumer-hardware floor: Qwen3 Embedding 0.6B or EmbeddingGemma-class small
  local embeddings,
- local rerank challenger: Qwen3 Reranker 0.6B first, then 4B or 8B only when
  latency and memory pressure are measured,
- cloud quality challenger: Voyage 4 plus Voyage Rerank 2.5,
- hosted retriever challenger: NVIDIA NeMo/Nemotron embedding and rerank arms.

The local quality winner is whichever arm wins the same-data memory benchmark.
MTEB v2 chooses the candidate list; it does not override a RecallWeave
LongMemEval or MemoryBench loss.

## Full Benchmark Gate

The current 30-query LongMemEval-S run is a canary. It is enough to find method
gaps and rate-limit issues, but it is not broad SOTA evidence. Broad SOTA or
production-replacement wording requires a full benchmark run or an explicitly
official comparable target. For the current LongMemEval-S source lock, that
means the full 500-row public set or a target artifact whose claim tier is
`public-benchmark`, `full-benchmark`, `officially-comparable`, or
`broad-sota`.

The full LongMemEval-S run-only target is now authored at
`reviews/overnight-20260522/public-longmemeval-full-run-target.json`. Its
materialization report covers 500 public rows, 19,195 haystack sessions, and
1,896 expected references while keeping raw questions, answers, and haystack
text outside the repository. This is a ready target, not a completed score:
the SOTA ladder still stays blocked until the 500-query answer-quality result,
same-data provider/local arms, reviewer intake, and release gates pass.
Use `benchmark:sota-doctor` for the one-page state check before and after full
shard runs. It reports the full target, raw-source retention, BM25-as-control
contract, shard coverage, current canary score, reported-target delta, reviewer
state, UI/docs state, and remaining launch blockers without provider calls or
raw benchmark text.
The answer-quality runner now supports full-target scoring in deterministic
query shards via `--query-offset` and `--max-queries`; the shard combiner must
merge only complete, non-overlapping coverage with the same target, query set,
materializer, answer-label, answer-model, judge-model, and strategy set.
Use `benchmark:answer-quality:local-shard-plan` for the no-spend/local full
benchmark path. That plan uses the same 500-query target and raw-source-retaining
private materialization but accepts BM25, full hybrid, model-backed query
expansion, local Apple embedding, and local rerank as the local strategy set.
It also uses an explicit local diagnostic scoring policy: local answer and
judge model names may differ from the target only when the scoring endpoint is
local, and the resulting packet is barred from SOTA or public superiority
claims. The full-SOTA lane still requires the exact target answer and judge
model contract.
It is a full local benchmark lane, not a SOTA lane: it can show whether the
local method is limited by model size or missing cloud arms, but broad SOTA and
public superiority wording still require the provider/SOTA comparison lane,
reviewers, UI/docs refresh, owner approval, and real canary.
Use `benchmark:answer-quality:local-shard-workorder` and
`benchmark:answer-quality:local-shard-intake` for local-full tracking so the
local plan is selected by default. The checked-in local intake artifact is
blocked with all twenty shards missing; it is a combine gate, not a score.
Use `benchmark:answer-quality:local-accepted-lane-doctor` before launching the
first local-full shard. The checked-in doctor at
`reviews/overnight-20260522/local-full-accepted-lane-launch-doctor-20260526.json`
keeps private inputs and raw-source retention visible as public-safe metadata,
names the missing local embedding/rerank/query-expansion/answer-quality
readiness, and confirms the lane has no Voyage/NVIDIA or public-SOTA blockers.
Run `benchmark:local-embedding:runtime-doctor -- --require-ready` before the
durability smoke. The current checked-in runtime report at
`reviews/overnight-20260522/local-embedding-runtime-doctor-20260526.json`
now reports `READY_LOCAL_EMBEDDING_RUNTIME` for a dedicated Qwen3 Embedding
0.6B GGUF local endpoint. The current checked-in durability report at
`reviews/overnight-20260522/local-embedding-durability-smoke-20260526.json`
now reports `READY_LOCAL_EMBEDDING_DURABILITY` and stays synthetic-only, so it
clears only the embedding preflight and does not count as local-full evidence.
`benchmark:memory-score:result-gate --require-ready` now also checks the
source-locked reported memory-system target directly. It leaves
`fullSotaBlockers` non-empty until the result is full or officially comparable,
uses the same benchmark and judge semantics, and meets or beats the selected
reported target score.
Keep raw benchmark and memory sources outside the repository but reachable to
the operator through source manifests, hashes, and private materialized paths.
The materializer now writes a private raw dataset copy, selected raw rows, and
a source-retention manifest for every materialized run; the public evidence
keeps only hashes, counts, roles, and file names.
The UI and default retrieval path may use compressed memories, but benchmark
and audit review must retain a way to challenge the compression against the raw
source.

Canary trend language may say the method is improving on the frozen slice.
Release language must wait until the full benchmark gate, same-data model
comparability, reviewer intake, UI evidence, docs, release notes, owner
approval, and real production canary are all current.

## Seed Targets

These are targets for planning, not proof that the cited systems used the same
harness we will use.

The machine-readable source-lock artifact for these rows is
`reviews/overnight-20260522/reported-memory-targets-20260525.json`, with a
public-safe rendered report at
`reviews/overnight-20260522/reported-memory-targets-20260525.md`. Validate it
with:

```bash
npm exec --yes pnpm@10.23.0 -- benchmark:reported-targets
```

The SOTA ladder consumes that artifact instead of accepting loose hardcoded
score rows. If hosted Supermemory usage is unavailable, those reported rows can
still act as comparison targets, but only after their source URL, checked date,
benchmark variant, score, judge, caveat, and comparability conditions validate.
Component rows in the same artifact remain model-selection evidence only.
The artifact was refreshed on 2026-05-26 and now mechanically requires source
coverage for the Qwen3 local embedding/reranker ladder, EmbeddingGemma, Voyage
4 with `rerank-2.5`, Gemini Embedding 2, NVIDIA retrieval NIM, and the
MemoryBench harness route. MemoryBench coverage is harness-source-only; it does
not count as a RecallWeave score.

| Source | Benchmark | Reported metric | Target | Caveat |
| --- | --- | --- | ---: | --- |
| Supermemory research | LongMemEval-S | overall, gpt-4o judge | 81.6% | Reported provider result; match dataset, scoring, judge, answer model, and session ingestion semantics before claiming a win. |
| Supermemory research | LongMemEval-S | overall, gpt-5 judge | 84.6% | Reported provider result; use as a target row, not as live Supermemory usage. |
| Supermemory research | LongMemEval-S | overall, gemini-3-pro judge | 85.2% | Current primary reported production/research target for the SOTA ladder. |
| Supermemory ASMR blog | LongMemEval-S | experimental agentic flow | 98.6% | Ceiling reference only. The source labels it experimental and not the core production Supermemory engine. |
| Qwen3 official repo | MTEB English v2 | embedding mean task | 70.70 | Qwen3 Embedding 0.6B component score; default zero-spend Apple-local floor only. |
| Qwen3 official repo | MTEB English v2 | embedding mean task | 75.22 | Qwen3 Embedding 8B component score; choose local challenger arms only. |
| Qwen3 official repo | MTEB English v2 | embedding mean task | 74.60 | Qwen3 Embedding 4B component score; plausible quality-first Apple/local challenger. |
| Qwen3 official repo | MTEB-R | reranker score | 65.80 | Qwen3 Reranker 0.6B component score; first local reranker sidecar to test. |
| Qwen3 official repo | MTEB-R | reranker score | 69.76 | Qwen3 Reranker 4B component score; test only if local latency and memory fit. |
| Qwen3 official repo | MTEB-R | reranker score | 69.02 | Qwen3 Reranker 8B component score; optional quality challenger only. |
| Google EmbeddingGemma docs | MTEB multilingual v2 | small local embedding class | n/a | Small on-device baseline; lower hardware cost does not imply full memory quality. |
| Voyage model docs | Retrieval/rerank model card | model recommendation | n/a | Use Voyage 4 and rerank-2.5 as provider challengers; same-data answer-quality run still required. |
| Google Gemini API docs | Embedding model card | multimodal endpoint availability | n/a | Use Gemini Embedding 2 as a provider challenger; same-data answer-quality run still required. |
| NVIDIA model docs | Rerank model card | model recommendation | n/a | Use Nemotron/NVIDIA NIM as hosted challenger; same-data answer-quality run still required. |
| Supermemory MemoryBench repo | locomo, longmemeval, convomem | harness route | n/a | Harness-source-only. It chooses the full comparison route, not a score. |
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
- The reported-target artifact separately source-locks the public MemoryBench
  harness route on 2026-05-26 so the SOTA ladder can require a real full
  benchmark route even when hosted Supermemory quota is unavailable.
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
- Current full LongMemEval-S target:
  `reviews/overnight-20260522/public-longmemeval-full-run-target.json`.
  It uses the same dataset hash with `selection=full-dataset`, 500 selected
  rows, selected-id hash
  `sha256:702287feda46afbb122e7d61f8fb1530e6b571b8172e248376c4f887d0527f42`,
  answer-label hash
  `sha256:50a91736969984d01a67dfc20daf3f1e62ecfcd658b8f5bafb2513f1e60b6388`,
  and run-only claim tier. The materialization report
  `reviews/overnight-20260522/public-longmemeval-full-materialize-run.json`
  confirms 500 private queries, 19,195 haystack sessions, 1,896 expected
  references, and four redacted key-shaped tokens from the public dataset.
  This is the required next target for broad SOTA evaluation; it is not itself
  answer-quality evidence.
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
  query set. The materializer also writes `longmemeval-answer-labels.private.json`
  outside the repository for the answer-quality harness. Its command template
  now names `bm25-lite`, an 800-token context budget, top-5 retrieval, and the
  metrics-only `benchmark:answer-quality` follow-up as the current canary
  setting.
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
- Current LongMemEval-S hybrid gate:
  `reviews/overnight-20260522/public-longmemeval-hybrid-gate.json`. It runs
  `bm25-lite` against local-only dense, sparse+dense, temporal, graph, rerank,
  and query-expansion proxy arms on the same materialized query set.
  `full-hybrid-rerank` and `query-expanded-full-hybrid-rerank` tied BM25
  quality, but p50 latency was 33 ms versus BM25 at 16 ms. The gate therefore
  keeps BM25 as the fallback/control and does not promote hybrid as the agent
  default.
- Current expanded LongMemEval-S hybrid stress gate:
  `reviews/overnight-20260522/public-longmemeval-expanded-hybrid-gate.json`.
  It uses the same source-locked dataset hash with a deterministic 30-question
  slice, 92 expected references, and 1,420 haystack sessions. BM25 remains the
  control winner at quality 0.2506, P@1 0.4667, recall@5 0.1583, recall@10
  0.1583, NDCG@10 0.2193, and p50 latency 180 ms. `full-hybrid-rerank` is the
  best local proxy hybrid, but it trails at quality 0.2289 and p50 latency
  417 ms. This is stronger evidence that the deterministic proxy hybrid should
  not be promoted before live embedding/reranker arms are tested.
- Current expanded LongMemEval-S autoresearch sweep:
  `reviews/overnight-20260522/public-longmemeval-expanded-autoresearch-loop.json`.
  It tests 48 local-only arms on the same 30-question target while varying
  context budget and candidate limit. `bm25-lite-b800-k5` wins with quality
  0.2506, P@1 0.4667, recall@5 0.1583, NDCG@10 0.2193, p50 latency 74 ms,
  and zero privacy failures. The result keeps BM25 as the local default/fallback
  and sends the next real quality question to the provider-backed benchmark
  lane.
- Current provider-backed gate scaffold:
  `reviews/overnight-20260522/public-longmemeval-provider-gate-fixture.json`.
  It adds `cloud-voyage-rerank-only`, `cloud-voyage4-voyage`,
  `cloud-gemini-embed-rerank-proxy`, `cloud-gemini-voyage-rerank`,
  `cloud-nvidia-retriever-500m`, `cloud-nvidia-nemotron-1b`,
  `cloud-nvidia-e5-mistral`, and `local-apple-qwen3-0_6b` to the same
  public-safe comparison path. Fixture mode makes no hosted calls; live runs
  require `RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1`,
  `RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1`, and env-only readiness for
  the selected provider arm.
- Current live provider preflight:
  `reviews/overnight-20260522/public-longmemeval-provider-live-preflight.json`.
  It calls no provider APIs, sends no benchmark text, and currently reports
  `BLOCKED_PROVIDER_ENV` because the clean controller environment has no
  provider-call consent flags or env-only Gemini/Voyage/NVIDIA/local-Apple
  readiness. Treat this as the required gate before spending calls on
  provider-backed arms.
- Expanded live provider preflight:
  `reviews/overnight-20260522/public-longmemeval-expanded-provider-live-preflight.json`.
  It checks the same provider arms against the 30-question expanded target and
  binds the live command template to
  `reviews/overnight-20260522/public-longmemeval-expanded-run-target.json`.
  This is the preferred next cloud-provider run because it compares against the
  stronger slice where deterministic hybrid still failed to beat BM25.
- Current answer-quality harness smoke:
  `reviews/overnight-20260522/answer-quality-arm-export-20260525.json`,
  `reviews/overnight-20260522/answer-quality-preflight-20260525.json`, and
  `reviews/overnight-20260522/memory-score-reviewer-intake-20260525.json`,
  plus
  `reviews/overnight-20260522/answer-quality-harness-smoke-20260525.json`.
  The arm-export preflight proves the clean controller shell has the required
  BM25, full-hybrid, query-expansion, provider, local Apple, and local rerank
  response-arm plan, but remains blocked until private materialized inputs and
  live export consent exist. The scoring preflight remains blocked until
  model-call consent, public-data consent, no-raw-output consent, private
  materialized inputs, and response arm exports are present. The fixture smoke
  proves the parser, safety flags, strategy table, and metrics-only output for
  `benchmark:answer-quality` without provider calls. These files do not count
  as a MemoryBench or LongMemEval answer-quality result. A live result must use
  the private materialized query set, memories, answer labels, and per-strategy
  response exports from `benchmark:answer-quality:arms -- --execute`, collect
  two reviewer approvals through `benchmark:memory-score:reviewer-intake`, then
  pass `benchmark:memory-score:result-gate --require-ready` before it can enter
  any SOTA evidence packet.
- Current live-local answer-quality evidence:
  `reviews/overnight-20260522/end-to-end-memory-score-live-local-20260525.json`
  and
  `reviews/overnight-20260522/end-to-end-memory-score-gate-20260525.json`.
  The 30-query local run is real same-data answer-quality evidence; the best
  local arm is `local-apple-qwen3-0_6b-local-rerank` at `36` answer-quality /
  `0.3667` correct rate. It is not SOTA proof and does not authorize public
  comparison language by itself.
- Current combined answer-quality evidence:
  `reviews/overnight-20260522/end-to-end-memory-score-combined-20260525.json`.
  This adds the NVIDIA `cloud-nvidia-nemotron-1b` same-data provider arm and
  two independent memory-score reviewer approvals in
  `reviews/overnight-20260522/memory-score-reviewer-intake-20260525.json`.
  Public comparison and SOTA wording remain blocked because
  `reviews/overnight-20260522/voyage-provider-rate-limit-20260525.json` records
  a missing same-data Voyage answer-quality arm after HTTP 429, and because the
  end-to-end gate now records full-SOTA blockers for the 30-query slice, the
  below-target score, and the judge mismatch with the primary reported target.
- Current SOTA operator packet:
  `reviews/overnight-20260522/sota-ladder-operator-packet-20260525.json`.
  Its minimum Voyage answer-quality retry flow reruns only the required BM25,
  full-hybrid, and `cloud-voyage4-lite-voyage-lite` rows after the rate limit
  clears, then combines the new metrics-only result with the existing local,
  query-expansion, local-rerank, and NVIDIA answer-quality reports before
  rerunning the provider-challenger, memory-score, and SOTA-ladder gates.
  It also includes a full LongMemEval-S answer-quality shard flow. The current
  checked-in shard plan,
  `reviews/overnight-20260522/answer-quality-full-shard-plan-20260525.json`,
  uses twenty 25-query chunks, includes BM25, full hybrid, query expansion,
  Voyage, NVIDIA, local Apple, and local rerank arms, and requires a
  shard-aware answer-quality preflight before scoring each chunk. The preflight
  rejects response-arm files that do not cover the selected query range. It
  now separates the run into explicit execution lanes:
  `deterministic-control-proxy`, `local-apple-no-spend`,
  `voyage-minimum-challenger`, `nvidia-minimum-challenger`, and
  `full-sota-accepted-shards`. Only `full-sota-accepted-shards` is accepted by
  the full-shard intake; the other lanes are diagnostic/comparison evidence.
  Query expansion is tiered by lane: deterministic fallback is allowed only for
  diagnostic run-path proof, the local no-spend lane can report local-model
  expansion separately when configured, and the full accepted lane stays blocked
  until local or cloud model-backed expansion is ready.
  It merges with `combineMode=query-shard-answer-quality-union`; that merged packet still needs
  live execution, reviewer intake, result gate, SOTA ladder, UI evidence, docs,
  owner approval, and real production canary before any broad claim.
- Full-shard private-input doctor:
  `reviews/overnight-20260522/full-shard-private-input-doctor-current.json`
  is the checked-in public-safe readiness proof for the regenerated private
  full-run inputs. It verifies the private files are outside the repository,
  hash-matched, mode `0600`, and that the response-arm template carries
  `--max-memory-bytes 300000000` for the 203,831,507-byte memories file. It
  does not count as full-memory SOTA evidence and does not permit public
  benchmark claims.
  `release:check` now protects that private benchmark lane by cleaning up only
  stale `recallweave-release-check-root-*` directories. It must not delete
  `recallweave-sota-full-*` materialization roots or current-path pointer files.
- Full-shard BM25 control export probe:
  `reviews/overnight-20260522/full-shard-bm25-control-export-probe-20260526.json`
  proves only that `shard-001` can export the 25-query `bm25-lite` lexical
  control arm against the regenerated private full inputs. It uses a
  strategy-specific lexical feature profile, commits no private response file,
  and leaves answer-quality scoring, provider/local arms, reviewer gates, and
  SOTA claims blocked.
- Full-shard deterministic control/proxy export probe:
  `reviews/overnight-20260522/full-shard-control-export-probe-20260526.json`
  proves the same `shard-001` response export path for `bm25-lite`,
  `full-hybrid-rerank`, and `query-expanded-full-hybrid-rerank`. The private
  response files stay outside the repo at mode `0600`, provider calls remain
  zero, and the query-expanded arm uses deterministic fallbacks. This is still
  not answer-quality scoring, provider/local model evidence, reviewer approval,
  or SOTA support.
- Full-shard deterministic control answer-quality preflight:
  `reviews/overnight-20260522/full-shard-control-answer-quality-preflight-20260526.json`
  proves those three private shard response arms are parseable, hash-aligned,
  complete for the same 25 selected `shard-001` queries, with
  selected-query-id hash matching on every arm. It stays
  `BLOCKED_ANSWER_QUALITY_ENV` until model-call consent, public-data consent,
  no-raw-output consent, and an answer/judge endpoint are configured. It is
  same-data scoring readiness only, not a scored answer-quality result or SOTA
  support.
- Full-shard workorder:
  `reviews/overnight-20260522/answer-quality-full-shard-workorder-20260525.json`
  is the checked-in public-safe run tracker for the twenty shard jobs. Re-run
  `benchmark:answer-quality:shard-workorder` as shard-result JSONs return; it
  should reach shard-intake readiness before the stricter intake command runs.
  It also mirrors the execution-lane split so local-only, provider-minimum, and
  deterministic diagnostic outputs cannot be mistaken for the full accepted
  shard set. The workorder now includes a no-call readiness check for each lane;
  the checked-in full-SOTA lane remains blocked until live-export consent,
  no-raw-text consent, answer-quality consent, local Apple/local rerank endpoints,
  Voyage/NVIDIA credentials, answer and judge model configuration, a scoring
  endpoint, exact target model matching, and query-expansion readiness are all
  present. The local-full workorder permits local diagnostic scoring only under
  `claimScope=local-full`, and the result gate rejects a local-full packet when
  it is submitted to the full-SOTA gate. The local-full response export
  commands include explicit local embedding and local rerank endpoint
  placeholders plus the local embedding durability report and required
  durability flag, so the checked-in workorder documents the sidecar
  requirements without exposing private URLs. It also accepts the shard 002
  runtime-blocker report as public-safe resume metadata and emits a
  missing-arm-only retry command for the two local Apple arms while keeping
  answer-quality scoring and intake blocked until all shard arms exist.
- Local-full shard resume packet:
  `reviews/overnight-20260522/local-full-shard-002-resume-packet-20260526.json`
  packages the shard 002 retry as an operator-ready, metrics-only handoff. It
  verifies the local embedding runtime doctor and durability smoke are ready,
  lists only hashes/counts/labels for the completed private arms, and names the
  private command materializer as the safe operator path. The missing-arm
  export, preflight, answer-quality, and local-intake commands stay as
  placeholder templates in public evidence and are materialized only into an
  outside-repository private script. It is not local-full benchmark evidence
  until shard 002 is accepted, and it is never full-SOTA evidence by itself.
- Local-full shard resume environment doctor:
  `reviews/overnight-20260522/local-full-shard-002-resume-env-doctor-20260526.json`
  checks whether the current shell has the private outside-repository source
  directory plus the local embedding, local rerank, safety, and answer-quality
  environment needed to execute the resume packet. The checked-in report is
  blocked for this shell and prints no environment values or private paths. It
  also checks the private raw-source audit contract from the full materialize
  report, so compressed/default retrieval may be used while raw dataset,
  selected-row, and source-manifest files remain required outside the
  repository for local-full continuation. It also requires the checked local
  embedding durability smoke to be fresher than the shard 002 socket-close
  blocker and to include the required long synthetic probe before local Apple
  resume commands are treated as runnable. Its `--fixture` mode now proves the
  full green path with temporary synthetic private inputs, while keeping
  `fixtureOnly: true`, provider calls off, hosted Supermemory off, and all
  public benchmark-claim flags false. The report also exposes
  `readyForCommandMaterialization` and `resumePacketCommandsRunnableAsPrinted`
  so public evidence can prove required placeholders are satisfiable without
  printing private paths, endpoint values, or runnable commands.
- Local-full shard resume command materializer:
  `reviews/overnight-20260522/local-full-shard-002-resume-command-materializer-20260526.json`
  is the public-safe companion to the env doctor. It fails closed until an
  outside-repository private command output path and required local env values
  exist. When ready, it writes concrete commands only to that private script and
  reports public hashes/counts/status without printing the commands, private
  paths, or env values.
- Local-full shard resume result doctor:
  `reviews/overnight-20260522/local-full-shard-002-resume-result-doctor-20260526.json`
  is the post-script public result checker. It remains blocked until the safe
  materializer path has produced a private command file and the shard 002
  public answer-quality result exists. When ready, it validates shard 002
  against the local-full plan and points to local shard intake while keeping raw
  source text, private paths, endpoint values, and materialized commands out of
  public evidence.
- Full-shard accepted-lane launch doctor:
  `reviews/overnight-20260522/full-shard-accepted-lane-launch-doctor-20260526.json`
  is the no-call go/no-go packet for the only lane accepted by full-shard
  intake. It confirms private inputs are ready, then keeps
  `full-sota-accepted-shards` blocked until response export, answer-quality
  scoring, provider/local arms, exact target model matching, and model-backed
  query expansion are configured. It is operator readiness evidence only, not a
  scored result or SOTA support.
- Local-full accepted-lane launch doctor:
  `reviews/overnight-20260522/local-full-accepted-lane-launch-doctor-20260526.json`
  now consumes the checked-in local progress intake, records shard 001 as
  accepted, and emits shard 002 retry commands as the next pending local-full
  work. This keeps local-full continuation aligned with actual shard progress
  while remaining non-SOTA evidence.
- Full-shard return intake:
  `reviews/overnight-20260522/answer-quality-full-shard-intake-20260525.json`
  is the checked-in blocked state for the full answer-quality shard set. It
  reports zero accepted shards, twenty missing shards, and no public-claim
  permission. Re-run `benchmark:answer-quality:shard-intake` with all returned
  shard-result JSONs before combine; it is a coverage and safety gate, not a
  SOTA result.
- Single-provider expanded preflights:
  `reviews/overnight-20260522/public-longmemeval-expanded-provider-live-preflight-voyage.json`
  and
  `reviews/overnight-20260522/public-longmemeval-expanded-provider-live-preflight-nvidia.json`.
  These are the first live-run candidates when the operator wants to spend only
  one provider family. They keep `bm25-lite` and `full-hybrid-rerank` in the
  same comparison table, but they require only the selected provider's env-only
  credential.
- Current LongMemEval-S autoresearch loop:
  `reviews/overnight-20260522/public-longmemeval-autoresearch-loop.json`. It
  runs 72 retrieval-proxy arms across lexical, dense-proxy, temporal,
  graph-proxy, rerank-proxy, and query-expansion-proxy strategies on the same
  materialized query set. The winning arm is
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
- https://supermemory.ai/research/
- https://supermemory.ai/blog/we-broke-the-frontier-in-agent-memory-introducing-99-sota-memory-system/
- https://mem0.ai/blog/state-of-ai-agent-memory-2026
- https://openreview.net/pdf?id=wIonk5yTDq
- https://ai.google.dev/gemini-api/docs/models/gemini-embedding-2
- https://ai.google.dev/gemma/docs/embeddinggemma
- https://github.com/QwenLM/Qwen3-Embedding
- https://huggingface.co/Qwen/Qwen3-Embedding-0.6B
- https://www.mongodb.com/docs/voyageai/models/
- https://docs.nvidia.com/nemo/retriever/
- https://build.nvidia.com/nvidia/llama-nemotron-rerank-1b-v2/modelcard
- https://huggingface.co/mteb
- https://arxiv.org/abs/2210.07316
- https://arxiv.org/abs/2605.12493
