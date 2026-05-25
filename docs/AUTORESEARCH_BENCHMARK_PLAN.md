# Autoresearch Benchmark Plan

This plan is the next implementation gate after the current public-alpha
source-lock work. It does not claim RecallWeave is better than hosted memory
systems. It defines how RecallWeave is allowed to prove or disprove that claim.

## Primary Objective

The benchmark goal is not to keep spending hosted Supermemory credits. The
reason this repository exists is that hosted Supermemory writes can exhaust the
available plan before the agents finish their work. RecallWeave must therefore
prove itself against objective public memory benchmarks and reported leader
stats, not only against the user's hosted Supermemory account.

When hosted Supermemory is quota-locked, skip hosted write comparisons. Use the
public benchmark target lane in `docs/PUBLIC_BENCHMARK_TARGETS.md`: run
RecallWeave on a source-locked public benchmark slice, compare the result to
published leaderboard or provider-reported stats with matching metric
definitions, and iterate through autoresearch until the canary trend points
toward a win. Hosted Supermemory remains a read-through compatibility and
product-parity lane, not a required scoring dependency.

The autoresearch loop must not optimize a solo RecallWeave run in isolation.
Each iteration needs a comparator table on the same source-locked data:
BM25-lite as the lexical floor, the current hybrid arm, any approved
provider-backed arm, and a public target row or hosted parity run when
available. If BM25 wins, BM25 remains the fallback while the research loop
targets the largest hybrid or provider gap. If a hybrid or provider arm wins,
that arm still needs reviewer approval before it becomes an agent default.

Do not confuse the floor with the finish line. The goal is to beat other memory
systems or source-locked reported targets, not merely to beat BM25. BM25 exists
because a cheap transparent baseline catches false sophistication. A real
RecallWeave win needs two steps: first clear the lexical floor, then beat a
same-data external target or source-aligned hosted parity run under the same
metric definitions.

Solo runs are allowed only as wiring smoke tests. The benchmark runners reject a
single-arm report by default; an operator must pass `--allow-solo-smoke` to
label that run as smoke-only. A smoke-only run cannot support method promotion,
public score language, or any comparison to Supermemory, MemoryBench,
LongMemEval, LoCoMo, ConvoMem, BEAM, or reported leaderboard rows.

## Rule For Public Scores

Use a matched source-locked canary before any public score.

Do not publish a GitHub benchmark score unless RecallWeave beats the matched
baseline on a source-locked canary.

A publishable canary must use:

- the same dataset slice,
- the same memory set,
- the same queries,
- relevance-labeled queries, where every query includes at least one
  `expectedResultIds` or `expectedResultHashes` entry,
- a private hosted mirror or source-matched local RecallWeave source when the
  query labels were authored from hosted history,
- a source-match preflight proving the local RecallWeave source can collect at
  least one expected reference for every reviewed query,
- a source-alignment gate proving the hosted label and local container map point
  at the same source before hosted calls are spent,
- a source-gap plan proving the source reports either allow a matched baseline
  run or name the exact repair path,
- the same judge and answer model,
- the same scoring code,
- the same privacy rules,
- cost and latency accounting,
- zero redaction failures,
- two independent reviewer approvals recorded by `baseline:reviewer-intake`
  and bound to the exact metrics-only packet or run.

If RecallWeave does not win, write a private gap report and keep iterating. Do
not market the score.

## Public Leaderboard Target Lane

Use this lane when the hosted Supermemory key is unavailable, quota-locked, or
too expensive for the next run.

1. Source-lock the benchmark and target row. Record the source URL, checked
   date, benchmark variant, metric name, score, judge model, answer model,
   token budget if reported, and caveats.
   Start with `benchmark:source-lock -- --strict` to verify the checked-in
   MemoryBench source lock before authoring a target.
   Then run `benchmark:public-slice -- --live` for the current LongMemEval-S
   canary slice. The slice manifest records dataset, selected-id,
   answer-label, and scoring-code hashes without raw question or answer text.
   If the target file does not exist yet, create it with
   `benchmark:public-target:author` from explicit source-lock fields rather
   than by hand-editing JSON. Use `--claim-tier run-only` and `--strict-run`
   when the slice is ready for RecallWeave but no source-locked reported target
   row is attached yet. Then run
   `benchmark:public-target -- --target <target.json> --strict` only after a
   reported comparison row is attached, so the target cannot be confused with
   component-only evidence or a private fixture. Once the run-only target
   passes, run `benchmark:public-materialize -- --live --target <target.json>`.
   That command writes raw query and haystack inputs only to an
   operator-private directory and commits only hashes, counts, and command
   templates. Its collector-compatible query-set hash must match the
   RecallWeave result hash before the run counts as same-data evidence.
2. Freeze a small but real canary slice from MemoryBench, LongMemEval, LoCoMo,
   ConvoMem, BEAM, or another documented memory benchmark.
   Use the same public data, repository or dataset revision, split, labels,
   question ids where available, judge rule, and scoring script as the reported
   target. Do not replace this with a private synthetic memory set.
   The current starter slice is LongMemEval-S, six rows, one per source-locked
   question type, selected by deterministic first-per-type round-robin after
   sorting by `question_id`.
3. Run RecallWeave on that slice with a fixed provider arm.
   The first LongMemEval-S run is a retrieval-proxy baseline from the local
   RecallWeave response exporter, not official MemoryBench answer judging. The
   initial `jaccard` run scored 0.1089 quality on six source-locked rows with
   zero privacy failures. The first same-data strategy comparison found that
   `bm25-lite` improved retrieval-proxy quality to 0.4541 and P@1 to 0.8333,
   while keeping privacy failures at zero. The first same-data autoresearch
   loop then promoted the canonical checked-in run to `bm25-lite-b800-k5`.
   Treat that as the blind baseline for the next autoresearch arm, not as a
   win. The result must carry
   `retrievalProxyOnly: true`, `memoryBenchAnswerQuality: false`, and
   `publicBenchmarkClaimsAllowed: false`.
   The current local-only loop tests 72 arms across lexical, dense-proxy,
   temporal, graph-proxy, rerank-proxy, and query-expansion-proxy strategies,
   context budget, and candidate limit. It selected `bm25-lite-b800-k5`, which
   kept quality at 0.4541 while cutting average context tokens to 800. This
   becomes the current checked-in retrieval-proxy canary setting.
   This is a control floor, not the intended agent-memory default. The
   hybrid-family arms are deterministic proxies that prove ranking wiring. They
   do not yet prove learned embedding, hosted reranker, or Apple Silicon local
   model quality.
4. Compare quality, P@1, recall@5, recall@10, NDCG@10 where available,
   latency, context tokens, and cost against the reported target.
5. If the canary beats the reported target under matching metric definitions,
   label it `canary-trending-win`, not full SOTA.
6. If it loses, run the autoresearch loop against the largest gap until a
   canary trend beats the target or the stopping rule fires.

## Next Hybrid Benchmark Gate

Do not promote BM25-lite as the final memory strategy. Keep it as the cheap
control and fallback. The current local-only hybrid gate compares it against
hybrid-family proxy arms on the same source-locked data:

- `bm25-lite-b800-k5`: lexical control and emergency fallback.
- `dense-proxy`: local hashed-vector dense proxy. This proves benchmark wiring
  only; it is not a hosted or learned embedding result.
- `sparse-dense-rrf`: BM25 plus dense proxy with reciprocal-rank fusion.
- `sparse-dense-temporal`: sparse/dense fusion with recency, update, and
  supersession-style signals.
- `sparse-dense-graph-temporal`: topic/wiki graph proxy expansion plus
  temporal signals.
- `full-hybrid-rerank`: sparse, dense proxy, graph proxy, temporal, and
  deterministic rerank proxy.
- `query-expanded-full-hybrid-rerank`: the full proxy arm with deterministic
  query expansion. The original query remains the evaluation key.

The full hybrid arm only becomes the agent default if it beats BM25-lite on
quality, or ties quality while improving a meaningful operational metric on a
larger and more varied slice. That promotion is still an internal default
decision, not an external-memory-system win. Otherwise BM25-lite remains the
fallback, and the hybrid method needs more work.

Latest result:

```bash
npm exec --yes pnpm@10.23.0 -- benchmark:public-hybrid -- --live \
  --target reviews/overnight-20260522/public-longmemeval-run-target.json
```

The 2026-05-24 source-locked 6-query LongMemEval-S hybrid gate kept
`bm25-lite` as the control/fallback. `full-hybrid-rerank` and
`query-expanded-full-hybrid-rerank` tied BM25 quality but doubled p50 latency
from 16 ms to 33 ms. `dense-proxy` alone was faster but much lower quality.
That means the benchmark wiring is now present, but the local proxy hybrid has
not earned default status.

A larger 2026-05-24 source-locked 30-query LongMemEval-S stress gate then ran
the same local-only hybrid-family arms over 1,420 haystack sessions and 92
expected references. `bm25-lite` again won the retrieval-proxy gate: quality
0.2506, P@1 0.4667, recall@5 0.1583, recall@10 0.1583, NDCG@10 0.2193, and
p50 latency 180 ms. The best local proxy hybrid was `full-hybrid-rerank` at
quality 0.2289 and p50 latency 417 ms. The next research iteration should
therefore test real provider-backed embedding and reranking arms instead of
promoting the deterministic proxy hybrid.

The expanded autoresearch sweep now repeats that comparison over the same
30-query target while varying context budget and candidate limit:
`reviews/overnight-20260522/public-longmemeval-expanded-autoresearch-loop.json`.
It tested 48 local-only arms. `bm25-lite-b800-k5` won with quality 0.2506,
P@1 0.4667, recall@5 0.1583, NDCG@10 0.2193, p50 latency 74 ms, and zero
privacy failures. The result keeps BM25 as the local default/fallback and
makes provider-backed embedding/reranking the next hypothesis to test.

## Provider-Backed Benchmark Gate

The provider-backed gate now exists as an opt-in harness:

```bash
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider -- --fixture
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider:preflight
RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1 \
RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1 \
VOYAGE_API_KEY=<env-only> \
GEMINI_API_KEY=<env-only-if-running-gemini-arm> \
NVIDIA_API_KEY=<env-only-if-running-nvidia-arm> \
SELFMEM_LOCAL_EMBED_BASE_URL=<env-only-if-running-local-apple-arm> \
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider -- --live \
  --target reviews/overnight-20260522/public-longmemeval-run-target.json
```

The gate compares `bm25-lite`, `full-hybrid-rerank`,
`cloud-voyage-rerank-only`, `cloud-voyage4-voyage`,
`cloud-gemini-embed-rerank-proxy`, `cloud-gemini-voyage-rerank`,
`cloud-nvidia-retriever-500m`, `cloud-nvidia-nemotron-1b`,
`cloud-nvidia-e5-mistral`, and `local-apple-qwen3-0_6b`. Fixture mode uses
deterministic provider mocks and makes zero hosted calls. Live mode fails
closed unless provider calls, public-data transfer, and the selected provider
readiness are explicitly enabled. Treat a live provider result as
retrieval-proxy evidence until it is converted into MemoryBench answer-quality
or another end-to-end memory score.

Run the preflight before any live provider spend. It checks the source-locked
LongMemEval target, selected strategy list, consent flags, and env-only
readiness without calling Voyage, Gemini, NVIDIA, the local Apple server, or
any other provider. A
`BLOCKED_PROVIDER_ENV` preflight means no live provider benchmark has been run.
For a cheap first live test, run one provider family at a time with explicit
`--strategies`. The checked-in single-provider expanded preflights are:

- `reviews/overnight-20260522/public-longmemeval-expanded-provider-live-preflight-voyage.json`
  for `bm25-lite`, `full-hybrid-rerank`, and `cloud-voyage4-voyage`.
- `reviews/overnight-20260522/public-longmemeval-expanded-provider-live-preflight-nvidia.json`
  for `bm25-lite`, `full-hybrid-rerank`, and
  `cloud-nvidia-nemotron-1b`.

Those single-arm preflights still block without public-data consent,
provider-call consent, and the matching env-only credential, but their live
command templates name only the provider being tested. A provider credential
can also come from a private key-file env var such as `VOYAGE_API_KEYS_FILE` or
`NVIDIA_API_KEYS_FILE`; the file must live outside the repository and is never
printed. They are the preferred path for rate-limit-safe iteration before the
full multi-provider matrix.
For the stronger 30-question slice, use
`reviews/overnight-20260522/public-longmemeval-expanded-run-target.json`; its
checked-in provider preflight is
`reviews/overnight-20260522/public-longmemeval-expanded-provider-live-preflight.json`
and currently blocks for missing consent flags and env-only provider
credentials.

Allowed wording after a small-slice win:

> RecallWeave beat the source-locked reported target on this canary slice. This
> is not a full benchmark run, but the canary is trending toward a win and
> justifies expanding the slice.

Disallowed wording:

> RecallWeave is SOTA.

That wording needs full comparable benchmark runs, reviewer approval, and
reproducible artifacts across the relevant benchmark suite.

Embedding and reranker leaderboards are allowed only as component evidence.
MTEB, MMTEB, BEIR, MIRACL, MS MARCO, and reranker task scores can justify why
Gemini Embedding 2, Voyage, NVIDIA, Qwen, Jina, BGE, GTE, or a local Apple
Silicon arm enters the matrix. They do not replace MemoryBench, LongMemEval,
LoCoMo, ConvoMem, BEAM, or another end-to-end memory/retrieval benchmark for
RecallWeave quality claims.

## End-To-End Answer-Quality Gate

Retrieval-proxy wins are useful for method selection, but they do not close the
full memory benchmark gate. A strategy becomes end-to-end memory evidence only
after the same private materialized benchmark inputs are answered and judged by
the answer-quality harness.

First prove parser and safety wiring without model calls:

```bash
npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:arms
npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:preflight
npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality -- --fixture
```

For a live run, materialize the source-locked target into an operator-private
directory outside the repository, export one RecallWeave response file per arm,
then score all arms with the same query set, memory set, answer labels, answer
model, judge model, and target hash:

```bash
RECALLWEAVE_SOTA_OUTPUT_DIR=<private-output-dir-outside-repo>

npm exec --yes pnpm@10.23.0 -- benchmark:public-materialize -- --live \
  --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json \
  --private-output-dir "$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized" \
  --output "$RECALLWEAVE_SOTA_OUTPUT_DIR/materialize-report.json"

RECALLWEAVE_BASELINE_LIVE=1 \
RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 \
RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1 \
RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1 \
npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:arms -- --execute \
  --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json \
  --queryset "$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized/longmemeval-queryset.private.json" \
  --memories "$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized/longmemeval-memories.private.jsonl" \
  --private-output-dir "$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms" \
  --strategies bm25-lite,full-hybrid-rerank,query-expanded-full-hybrid-rerank,<provider-or-local-arm> \
  --context-token-budget 800 \
  --limit 5 \
  --output "$RECALLWEAVE_SOTA_OUTPUT_DIR/answer-quality-arm-export.json"

RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS=1 \
RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA=1 \
RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT=1 \
RECALLWEAVE_MEMORYBENCH_BASE_URL=<openai-compatible-base-url> \
RECALLWEAVE_MEMORYBENCH_API_KEY=<env-only-if-cloud-endpoint> \
RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL=<answer-model> \
RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL=<judge-model> \
npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:preflight -- --require-ready \
  --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json \
  --queryset "$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized/longmemeval-queryset.private.json" \
  --memories "$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized/longmemeval-memories.private.jsonl" \
  --answer-labels "$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized/longmemeval-answer-labels.private.json" \
  --arm bm25-lite="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/bm25-lite-responses.private.json" \
  --arm full-hybrid-rerank="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/full-hybrid-rerank-responses.private.json" \
  --arm query-expanded-full-hybrid-rerank="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/query-expanded-full-hybrid-rerank-responses.private.json" \
  --arm <provider-or-local-arm>="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/<provider-or-local-arm>-responses.private.json" \
  --output "$RECALLWEAVE_SOTA_OUTPUT_DIR/answer-quality-preflight.json"

npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality -- --live \
  --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json \
  --queryset "$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized/longmemeval-queryset.private.json" \
  --memories "$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized/longmemeval-memories.private.jsonl" \
  --answer-labels "$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized/longmemeval-answer-labels.private.json" \
  --arm bm25-lite="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/bm25-lite-responses.private.json" \
  --arm full-hybrid-rerank="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/full-hybrid-rerank-responses.private.json" \
  --arm query-expanded-full-hybrid-rerank="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/query-expanded-full-hybrid-rerank-responses.private.json" \
  --arm <provider-or-local-arm>="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/<provider-or-local-arm>-responses.private.json" \
  --output "$RECALLWEAVE_SOTA_OUTPUT_DIR/end-to-end-memory-score.json" \
  --markdown-output "$RECALLWEAVE_SOTA_OUTPUT_DIR/end-to-end-memory-score.md"

npm exec --yes pnpm@10.23.0 -- benchmark:memory-score:result-gate -- --require-ready \
  --result "$RECALLWEAVE_SOTA_OUTPUT_DIR/end-to-end-memory-score.json"
```

The answer-quality report is still metrics-only. It may contain strategy names,
hashes, aggregate answer quality, judge-correct rate, latency, context-token
counts, provider endpoint labels, and privacy counters. It must not contain raw
questions, gold answers, candidate answers, memory text, transcripts, prompts,
private local paths, or keys.

The gate is allowed to use one clearly labeled cloud substep, such as cloud
query expansion or cloud answer judging, when local hardware is the bottleneck.
That arm must be named as mixed or cloud-assisted, costed separately, and never
described as pure local evidence.

## Hosted Supermemory Parity Lane

Run the hosted baseline preflight before any live comparison:

```bash
npm exec --yes pnpm@10.23.0 -- baseline:preflight
npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --print-template
npm exec --yes pnpm@10.23.0 -- baseline:discover
npm exec --yes pnpm@10.23.0 -- baseline:select-container
npm exec --yes pnpm@10.23.0 -- baseline:author-queryset
npm exec --yes pnpm@10.23.0 -- baseline:queryset
npm exec --yes pnpm@10.23.0 -- baseline:mirror-hosted
npm exec --yes pnpm@10.23.0 -- baseline:source-match
npm exec --yes pnpm@10.23.0 -- baseline:source-align
npm exec --yes pnpm@10.23.0 -- baseline:source-gap
npm exec --yes pnpm@10.23.0 -- baseline:collect -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:export:recallweave -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:collect:recallweave -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:reviewer-intake
npm exec --yes pnpm@10.23.0 -- baseline:compare -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:next-run
```

The preflight is offline by default. It must report `callsHostedProvider:
false`, `metricsOnly: true`, and `benchmarkClaimsAllowed: false` unless a
fresh sanitized hosted-baseline result is supplied with `--result`. A live run
needs explicit environment opt-in, `RECALLWEAVE_BASELINE_NO_RAW_TEXT=1`, and a
metrics-only output file. The output may include run ids, source commits, model
ids, aggregate scores, cost, latency, and hashes. It must not include raw
memories, raw transcripts, private prompts, private answers, credentials,
cookies, or bearer tokens.

Before collection, `baseline:discover -- --live` may be used as a safe metadata
step when the source container is unknown. A public discovery report may show
hashed candidate ids and counts only. It does not count as a hosted baseline
and does not support benchmark language. If a raw hosted label is needed, use
the private-map discovery flow outside the repository, then run
`baseline:select-container` to write the selected label into a 0600 private env
file without printing it. The private map and env file are local operator
material only.

If a new query set is needed, run `baseline:author-queryset` after container
selection. It may draft a private, review-required query set from the selected
hosted container, but the draft itself is not benchmark evidence. It must be
reviewed locally, then checked with `baseline:queryset --strict`, before hosted
or RecallWeave collection starts. Attach only the public author report and the
strict query-set inspection report.
If the canary uses hosted history as its source, run `baseline:mirror-hosted`
next. It reads hosted Supermemory in read-only mode, writes a redacted local
RecallWeave-compatible mirror outside the repository, and emits a public-safe
metrics report. The mirror's `memories.jsonl` and `container-map.json` are
private local inputs, not reviewer attachments.

The fixture path proves that the result shape is parseable. It must never count
as hosted baseline evidence, even if all metrics fields are present. Use
`--print-template` before live collection so the agent writes only aggregate
fields and source-lock hashes.

Use `baseline:queryset -- --queryset <path> --strict --output <report>` on the
frozen query file before either collector runs. The report must be metrics-only
and public-safe: hashes, counts, readiness flags, and no raw query text or
expected-result identifiers.

Then run `baseline:source-match -- --live --queryset <path> --container-dir
<hosted-mirror-or-source-matched-container> --preserve-ids --strict --output
<report>` before hosted collection when using the private hosted mirror. Omit
`--preserve-ids` only when the local source intentionally emits hashed ids and
the query set uses content hashes. This report must also be metrics-only and
public-safe. It blocks the run if the local RecallWeave source cannot satisfy
the reviewed labels, which prevents another source-mismatched 0-0 comparison.

Then run `baseline:source-align -- --source-match <report> --local-map
<local-container-map.json> --private-map <private-hosted-map.jsonl> --strict
--output <alignment-report>`. This report must stay metrics-only and
public-safe. It blocks the run if a label match is not enough to prove matching
content. Keep the private hosted map local and attach only the alignment report.

Then run `baseline:source-gap -- --source-match <report> --source-alignment
<alignment-report> --output <gap-report>`. The report is also public-safe. It
must say `READY_FOR_MATCHED_BASELINE` before a hosted collection run can be
treated as source-matched. If it reports a blocked state, follow its repair path
instead of spending more hosted calls.

After both result files exist, run the matched comparison gate:

Use the exporter's `--output` flag for the RecallWeave response file. Do not
redirect the package-manager command's stdout into the JSON file, because
wrapper banners can corrupt the evidence file before the collector reads it.

```bash
RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 \
RECALLWEAVE_BASELINE_CONTEXT_TOKEN_BUDGET=1600 \
npm exec --yes pnpm@10.23.0 -- baseline:export:recallweave \
  -- --live --container-dir <hosted-mirror-or-source-matched-container> \
  --preserve-ids \
  --context-token-budget 1600 \
  --output /tmp/recallweave-search-responses.json

RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 \
npm exec --yes pnpm@10.23.0 -- baseline:collect:recallweave \
  -- --live --responses /tmp/recallweave-search-responses.json \
  --output /tmp/recallweave-result.json

npm exec --yes pnpm@10.23.0 -- baseline:compare \
  -- --hosted /tmp/recallweave-hosted-baseline-result.json \
  --recallweave /tmp/recallweave-result.json
```

The comparison gate is also metrics-only. It must report the same dataset
slice, query-set hash, scoring-code hash, judge model, answer model, and
harness flags before it can count as comparison evidence. `--fixture` always
blocks public claims, even if the loaded files look real.

The hosted and RecallWeave collectors reject unlabeled query sets before they
produce aggregate metrics. A live run with natural questions but no expected
ids or content hashes is useful for debugging search shape only; it is not
benchmark evidence and must not feed public comparison language.

`baseline:export:recallweave` creates the local search-response export from a
local `memories.jsonl` container. It emits ids or hashed ids, content hashes,
scores, timings, token estimates, privacy counters, and no raw memory text. The
RecallWeave collector accepts that export and rejects raw response text by
default so a local run cannot quietly become a raw memory attachment.

`baseline:next-run` is the state-aware planner for this lane. Use it when an
agent has partial evidence and needs the next safe step. It inspects hosted,
RecallWeave, preflight, and comparison state when available, then prints the
exact source-locked run sequence. It never calls a hosted provider, never
authorizes public claims, and keeps fixtures useful only for parser validation.
It prints `baseline:source-match --strict` as a required step before the
hosted/local run chain when a reviewed query set is present, then prints
`baseline:source-gap` so operators can tell whether the source gate is ready or
still blocked.
Use `baseline:next-run -- --require-ready` after the hosted, RecallWeave,
preflight, and comparison files are available. It must fail for fixtures,
partial evidence, privacy failures, harness mismatches, missing reviewer
approval, or a RecallWeave loss. A passing result means the evidence is ready
for owner review, not public launch.

Allowed public wording after a win:

> On this source-locked canary, RecallWeave beat the matched baseline with the
> same judge, answer model, queries, and scoring code. This is not a full
> benchmark proof, but it suggests the method may surpass available cloud memory
> systems on this workload and justifies a full benchmark.

## Controlled Matrix

Run one method at a time unless independent workers run isolated arms with the
same frozen harness.

| Arm | Purpose |
|---|---|
| `cloud-voyage4-voyage` | First cloud quality proof. |
| `cloud-gemini-embed-rerank-proxy` | Gemini embedding challenger without hosted reranker effects. |
| `cloud-gemini-voyage-rerank` | Gemini embedding challenger with Voyage rerank held constant. |
| `cloud-nvidia-retriever-500m` | Hosted latency challenger. |
| `cloud-nvidia-nemotron-1b` | Current NVIDIA text retrieval challenger. |
| `cloud-nvidia-nemotron-vl-1b` | Multimodal NVIDIA retrieval challenger. |
| `cloud-nvidia-e5-mistral` | Hosted QA retrieval challenger. |
| `local-apple-qwen3-0_6b` | Default local Apple Silicon proof. |
| `local-apple-qwen3-0_6b-local-rerank` | First local method challenger with an env-only reranker sidecar. |
| `local-apple-qwen3-4b` | Optional local quality challenger. |

The local lane matters because many users will not want hosted embedding and
rerank bills. The first local target is 24GB Apple Silicon, not a large GPU
server.

Local runs must start from a clean runtime state. The harness should detect
stale local model servers, record which ports and process ids are active, and
stop only RecallWeave-owned stale processes before measuring. If ownership is
unclear, block the run instead of killing unrelated user work.

Use Hugging Face or source-locked Apple Silicon artifacts for local models.
Avoid quantization heroics in the default lane. Qwen, Gemma, local Nemotron
variants, MLX, llama.cpp, Ollama, or other Apple-friendly routes may enter the
matrix, but each variant needs its own label, source, latency, memory, and
quality result.

The first local method change after the 0.6B and 4B embedding runs is
`local-apple-qwen3-0_6b-local-rerank`. It keeps the 0.6B embedding lane fixed
and swaps only the final reranker from the deterministic proxy to an env-only
local sidecar. Preflight must block unless both `SELFMEM_LOCAL_EMBED_BASE_URL`
and `SELFMEM_LOCAL_RERANK_ENDPOINT` or `SELFMEM_LOCAL_RERANK_BASE_URL` are
present.

## Research Loop

1. Source-lock current provider docs, model cards, benchmark papers, and
   project references.
2. Freeze a canary benchmark slice from MemoryBench, LongMemEval, LoCoMo,
   ConvoMem, or a documented real benchmark subset.
3. Run the matched baseline and one RecallWeave arm.
4. Record accuracy, P@1, recall@5, recall@10, NDCG@10 where available, p50 and
   p95 latency, context tokens, context-budget settings, ingest cost, query
   cost, and failures.
5. Convert retrieval-proxy results into an end-to-end answer-quality result
   before any public benchmark claim or SOTA wording.
6. Pick the largest quality gap. If quality is tied, pick the largest latency
   or cost gap.
7. Propose exactly one methodology change.
8. Require two independent reviewers to approve the setup before coding. Store
   their metrics-only approvals through `baseline:reviewer-intake` before any
   public comparison language moves to owner review.
9. Implement only the approved change.
10. Rerun the affected canary first.
11. Keep the change only if quality improves without a serious regression, or
    quality holds while latency or cost improves materially.

Reviewer packets must include commands, dataset slice, run id, source commit,
provider arm, model ids, judge, answer model, latency/cost summary, and a
privacy scan result.

Backend confidence comes first. Do not spend the UI pass polishing a methodology
that has not passed the setup gate, privacy gate, and at least one controlled
canary run. Once the backend evidence is credible, the Brain UI should show the
same source lineage, topic graph, provider arm, trace, and reviewer decision so
users can understand why the system chose a memory path.

## Reviewers

Preferred reviewer route:

- Implementer: Codex GPT-5.5 high or the active Codex goal.
- Reviewer A: Claude Opus 4.7 through Claude CLI. This approval is required
  before autoresearch changes become implementation work.
- Reviewer B: Codex GPT-5.5 in a separate cold review context. Gemini CLI may
  add coverage, but it does not replace the Opus plus 5.5 setup gate unless
  the owner explicitly accepts the substitution.

If a reviewer route is unavailable, write a blocked-review file. Do not count
that route as approval.

For non-UI benchmark packet review, an OpenAI-compatible route such as DeepSeek
may serve as a reviewer when the operator keeps the API key in the local
environment and converts the model decision into the
`baseline:reviewer-intake -- --template` JSON shape. The committed repository
must contain only the sanitized approval artifact or blocked-review note, not
the key, raw prompt, raw memory text, or private paths.

## Query Expansion Gate

Query expansion is off by default. It can enter the matrix only as a single
methodology change.

The query expansion canary must check:

- exact identifiers,
- temporal facts,
- contradicted facts,
- short natural queries,
- noisy user phrasing,
- private-tag redaction,
- p50 and p95 added latency.

The expansion provider may be NVIDIA, Gemini, OpenRouter, or a small local
OpenAI-compatible model. The provider receives only the current query. It never
receives stored memories, raw transcripts, private text, or credentials.

The expansion arm must stay within free-tier or approved budget limits where
possible. If a provider rate limit appears, the run should pause or narrow the
slice instead of quietly changing models or mixing providers inside one arm.

## Pruning Gate

Pruning is a review queue, not automatic deletion.

RecallWeave may surface:

- duplicate candidates,
- stale open bugs,
- resolved tasks,
- contradicted facts,
- low-salience noise,
- memories that never retrieve,
- memories that retrieve but never help answers.

The default action is "review." A user or maintainer approves suppress, merge,
or delete. Backups are recommended before destructive actions. A risky
`--yolo` mode may exist later, but it must be disabled by default and clearly
marked as unsafe for normal users.

## UI Gate

After backend canary evidence is clean, run the Brain UI pass:

- dashboard health,
- topic clusters,
- graph paths,
- editable documents,
- source lineage,
- benchmark evidence,
- provider status,
- lifecycle frequency,
- pruning review queue.

Visual reviewers should inspect screenshots or screen recordings using fixture
data. Public UI evidence must not contain real agent memory, private paths,
keys, or raw diagnostics.
