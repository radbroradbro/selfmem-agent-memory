import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const fixtureRequested = Boolean(args.fixture) || !args.live;
const format = String(args.format ?? "json").toLowerCase();
const targetPath = resolveInputPath(
  args.target ??
    args.targetFile ??
    process.env.RECALLWEAVE_PUBLIC_BENCHMARK_TARGET ??
    (fixtureRequested ? null : "reviews/overnight-20260522/public-longmemeval-run-target.json"),
);
const sourceLockPath = resolveInputPath(
  args.sourceLock ??
    args.sourceLockFile ??
    process.env.RECALLWEAVE_PUBLIC_BENCHMARK_SOURCE_LOCK ??
    "reviews/overnight-20260522/public-memorybench-source-lock.json",
);
const outputPath = args.output ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_MATERIALIZE_REPORT ?? null;
const markdownOutputPath = args.markdownOutput ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_MATERIALIZE_MARKDOWN ?? null;
const privateOutputDir = resolvePrivateOutputDir(args.privateOutputDir ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_PRIVATE_OUTPUT_DIR);
const contextTokenBudget = positiveInt(args.contextTokenBudget ?? process.env.RECALLWEAVE_BASELINE_CONTEXT_TOKEN_BUDGET ?? 800, "context token budget");
const limit = positiveInt(args.limit ?? process.env.RECALLWEAVE_BASELINE_LIMIT ?? 5, "limit");
const retrievalStrategy = normalizeRetrievalStrategy(
  args.strategy ?? process.env.RECALLWEAVE_BASELINE_RETRIEVAL_STRATEGY ?? "bm25-lite",
);

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const secretPatternGlobal = new RegExp(secretPattern.source, "g");
const privatePathPattern =
  /(\/Users\/[^/\s"]+|\/Volumes\/[^/\s"]+|\/private\/[^/\s"]+|\/var\/folders\/[^/\s"]+|\/tmp\/[^/\s"]+|\/home\/[^/\s"]+|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*|memories\.jsonl|raw_events\.jsonl|lossless_context\.jsonl)/i;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;

mkdirSync(privateOutputDir, { recursive: true, mode: 0o700 });
assertOutsideRepo(privateOutputDir, "private output directory");

const report = fixtureRequested ? fixtureMaterialize() : await liveMaterialize();
const serialized = format === "markdown" ? `${renderMarkdown(report)}\n` : `${JSON.stringify(report, null, 2)}\n`;
assertSafePublicText(serialized, "public benchmark materialize report");

if (outputPath) writePublicOutput(outputPath, `${JSON.stringify(report, null, 2)}\n`);
if (markdownOutputPath) writePublicOutput(markdownOutputPath, `${renderMarkdown(report)}\n`);
process.stdout.write(serialized);

async function liveMaterialize() {
  assert.ok(targetPath, "--target is required for live materialization");
  assert.ok(existsSync(targetPath), `target missing: ${displayPath(targetPath)}`);
  assert.ok(existsSync(sourceLockPath), `source lock missing: ${displayPath(sourceLockPath)}`);
  const targetRaw = readFileSync(targetPath, "utf8");
  const sourceLockRaw = readFileSync(sourceLockPath, "utf8");
  assertSafePublicText(targetRaw, displayPath(targetPath));
  assertSafePublicText(sourceLockRaw, displayPath(sourceLockPath));
  const target = JSON.parse(targetRaw);
  const sourceLock = JSON.parse(sourceLockRaw);
  assert.equal(target.fixtureOnly, false, "live target must not be fixture-only");
  assert.equal(target.claimTier, "run-only", "materializer consumes run-only targets before comparison claims");
  assert.equal(target.benchmarkType, "memory", "target must be a memory benchmark");
  assert.equal(normalizeBenchmarkName(target.benchmark?.family ?? target.benchmark?.name), "longmemeval", "only LongMemEval materialization is implemented");
  assert.ok(requiredSha256(target.benchmark?.answerLabelsHash), "target answerLabelsHash must be sha256");
  assert.ok(requiredSha256(target.benchmark?.scoringCodeHash), "target scoringCodeHash must be sha256");
  assert.ok(requiredString(target.benchmark?.questionIdPolicy), "target must use a deterministic questionIdPolicy");
  assert.equal(target.publicBenchmarkClaimsAllowed, undefined, "target file must not embed benchmark-claim allowance");

  const policy = parseQuestionIdPolicy(target.benchmark.questionIdPolicy);
  const datasetSource = sourceLock.datasetSources?.longmemeval ?? {};
  const datasetUrl = String(args.datasetUrl ?? datasetSource.datasetUrl ?? "");
  assert.ok(requiredHttpsUrl(datasetUrl) || args.datasetFile, "--dataset-url, --dataset-file, or source-lock dataset URL is required");
  const rawBuffer = await readDatasetBuffer(datasetUrl);
  const rawText = rawBuffer.toString("utf8");
  const datasetHash = `sha256:${stableHash(rawBuffer)}`;
  assert.equal(datasetHash, policy.datasetHash, "dataset hash must match questionIdPolicy");
  assert.match(String(target.benchmark.datasetRevision ?? ""), new RegExp(escapeRegExp(datasetHash)), "target datasetRevision must include dataset hash");
  const dataset = JSON.parse(rawText);
  assert.ok(Array.isArray(dataset), "LongMemEval dataset must be a JSON array");
  const selected = selectSlice(dataset, policy.types, { perType: policy.perType, limit: policy.limit, selection: policy.selection });
  const selectedIds = selected.map((item) => String(item.question_id));
  const selectedQuestionIdsHash = `sha256:${stableHash(selectedIds.join("\n"))}`;
  const labelPayload = selected.map((item) => ({
    questionId: String(item.question_id),
    questionType: String(item.question_type),
    answer: String(item.answer ?? ""),
  }));
  const answerLabelsHash = `sha256:${stableHash(canonicalJson(labelPayload))}`;
  assert.equal(selectedQuestionIdsHash, sourceLock.nextTargetRecommendation?.selectedQuestionIdsHash ?? selectedQuestionIdsHash);
  assert.equal(answerLabelsHash, target.benchmark.answerLabelsHash, "selected answer label hash must match target");

  const materialized = writePrivateBenchmarkInputs({
    fixtureOnly: false,
    datasetSlice: target.benchmark.split,
    judgeModel: target.benchmark.judgeModel,
    answerModel: target.benchmark.answerModel,
    selected,
    target,
    datasetHash,
    selectedQuestionIdsHash,
    answerLabelsHash,
    scoringCodeHash: target.benchmark.scoringCodeHash,
  });

  return {
    schemaVersion: 1,
    ok: true,
    mode: "public-benchmark-materialize-run",
    fixtureOnly: false,
    benchmark: "longmemeval",
    claimTier: "run-only",
    metricsOnly: true,
    publicSafe: true,
    writesPrivateFiles: true,
    rawQuestionIdsIncluded: false,
    rawQuestionsIncluded: false,
    rawAnswersIncluded: false,
    rawMemoryIncluded: false,
    rawTranscriptIncluded: false,
    rawPrivateOutputPathIncluded: false,
    generatedAt: new Date().toISOString(),
    source: {
      memoryBenchCommit: sourceLock.source?.commit,
      datasetHost: new URL(datasetUrl).host,
      datasetHash,
      datasetByteSize: rawBuffer.byteLength,
      datasetItemCount: dataset.length,
    },
    target: {
      targetIdHash: shortHash(target.targetId),
      targetFileHash: `sha256:${stableHash(targetRaw)}`,
      sourceLockHash: `sha256:${stableHash(sourceLockRaw)}`,
      splitHash: shortHash(target.benchmark.split),
      judgeModel: target.benchmark.judgeModel,
      answerModel: target.benchmark.answerModel,
      contextTokenBudget,
      limit,
      retrievalStrategy,
    },
    selection: materialized.selection,
    privateOutputs: materialized.privateOutputs,
    runCommands: runCommandTemplates(materialized.privateOutputs),
    safety: publicSafety(),
    nextActions: [
      "Run the RecallWeave response exporter against the private query set and memories file.",
      "Run the RecallWeave baseline collector against the private query set and exported responses.",
      "Attach only the metrics-only result file before moving this target beyond run-only.",
    ],
  };
}

function fixtureMaterialize() {
  const selected = [
    {
      question_id: "fixture-user",
      question_type: "single-session-user",
      question: "What is the write policy?",
      answer: "Writes stay local.",
      answer_session_ids: ["fixture-session-policy"],
      haystack_session_ids: ["fixture-session-policy", "fixture-session-noise"],
      haystack_dates: ["2026-05-22", "2026-05-22"],
      haystack_sessions: [
        [
          { role: "user", content: "How should memory writes work?" },
          { role: "assistant", content: "RecallWeave writes locally and keeps hosted memory read-through separate." },
        ],
        [
          { role: "user", content: "What color is the demo button?" },
          { role: "assistant", content: "The demo button is blue." },
        ],
      ],
    },
    {
      question_id: "fixture-temporal",
      question_type: "temporal-reasoning",
      question: "When did the canary become run-only?",
      answer: "After source lock.",
      answer_session_ids: ["fixture-session-run-only"],
      haystack_session_ids: ["fixture-session-run-only"],
      haystack_dates: ["2026-05-23"],
      haystack_sessions: [
        [
          { role: "user", content: "What benchmark state are we in?" },
          { role: "assistant", content: "The LongMemEval target is run-only until a reported comparison row is attached." },
        ],
      ],
    },
  ];
  const target = {
    targetId: "fixture-materialize-target",
    benchmark: {
      split: "fixture-longmemeval-materialize",
      judgeModel: "fixture-judge",
      answerModel: "fixture-answer",
      scoringCodeHash: "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    },
  };
  const selectedQuestionIdsHash = `sha256:${stableHash(selected.map((item) => item.question_id).join("\n"))}`;
  const answerLabelsHash = `sha256:${stableHash(canonicalJson(selected.map((item) => ({
    questionId: item.question_id,
    questionType: item.question_type,
    answer: item.answer,
  }))))}`;
  const materialized = writePrivateBenchmarkInputs({
    fixtureOnly: true,
    datasetSlice: target.benchmark.split,
    judgeModel: target.benchmark.judgeModel,
    answerModel: target.benchmark.answerModel,
    selected,
    target,
    datasetHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    selectedQuestionIdsHash,
    answerLabelsHash,
    scoringCodeHash: target.benchmark.scoringCodeHash,
  });
  return {
    schemaVersion: 1,
    ok: true,
    mode: "public-benchmark-materialize-run",
    fixtureOnly: true,
    benchmark: "longmemeval",
    claimTier: "fixture",
    metricsOnly: true,
    publicSafe: true,
    writesPrivateFiles: true,
    rawQuestionIdsIncluded: false,
    rawQuestionsIncluded: false,
    rawAnswersIncluded: false,
    rawMemoryIncluded: false,
    rawTranscriptIncluded: false,
    rawPrivateOutputPathIncluded: false,
    generatedAt: "2026-05-23T00:00:00.000Z",
    source: {
      memoryBenchCommit: "118209a746d97d0d85e5a7234267f0b6962857e9",
      datasetHost: "fixture",
      datasetHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      datasetByteSize: 1024,
      datasetItemCount: 2,
    },
    target: {
      targetIdHash: shortHash(target.targetId),
      targetFileHash: null,
      sourceLockHash: null,
      splitHash: shortHash(target.benchmark.split),
      judgeModel: target.benchmark.judgeModel,
      answerModel: target.benchmark.answerModel,
      contextTokenBudget,
      limit,
      retrievalStrategy,
    },
    selection: materialized.selection,
    privateOutputs: materialized.privateOutputs,
    runCommands: runCommandTemplates(materialized.privateOutputs),
    safety: publicSafety(),
    nextActions: [
      "Use --live with the source-locked target before benchmark claims.",
      "Keep private query and memory files outside the repository.",
    ],
  };
}

function writePrivateBenchmarkInputs(options) {
  const sessionMap = new Map();
  const answerContentHashesByQuery = new Map();
  const materializerHash = `sha256:${stableHash("public-benchmark-materialize-run:v1")}`;
  const redactionStats = {
    keyShapedTokenRedactionCount: 0,
    privateTagRedactionCount: 0,
  };
  for (const row of options.selected) {
    const sessionIds = asArray(row.haystack_session_ids).map((item) => String(item));
    const sessions = asArray(row.haystack_sessions);
    const dates = asArray(row.haystack_dates);
    sessionIds.forEach((sessionId, index) => {
      if (!requiredString(sessionId) || sessionMap.has(sessionId)) return;
      const content = formatSessionContent({
        sessionId,
        date: dates[index],
        messages: sessions[index],
        redactionStats,
      });
      sessionMap.set(sessionId, {
        id: sessionId,
        content,
        metadata: {
          benchmark: "longmemeval",
          questionType: String(row.question_type),
          source: "MemoryBench LongMemEval-S cleaned",
          date: requiredString(dates[index]) ? String(dates[index]) : null,
        },
      });
    });
    const hashes = asArray(row.answer_session_ids)
      .map((sessionId) => sessionMap.get(String(sessionId))?.content)
      .filter(Boolean)
      .map((content) => `sha256:${stableHash(normalizeText(content))}`);
    answerContentHashesByQuery.set(String(row.question_id), [...new Set(hashes)]);
  }

  const queries = options.selected.map((row) => {
    const answerSessionIds = asArray(row.answer_session_ids).map((item) => String(item)).filter(Boolean);
    return {
      id: queryIdFor(row),
      q: String(row.question),
      expectedResultIds: answerSessionIds,
      expectedResultHashes: answerContentHashesByQuery.get(String(row.question_id)) ?? [],
      metadata: {
        benchmark: "longmemeval",
        questionType: String(row.question_type),
      },
    };
  });
  assert.ok(queries.every((query) => query.expectedResultIds.length > 0 || query.expectedResultHashes.length > 0), "every materialized query must have an expected reference");

  const querySet = {
    schemaVersion: 1,
    fixtureOnly: options.fixtureOnly,
    datasetSlice: options.datasetSlice,
    judgeModel: options.judgeModel,
    answerModel: options.answerModel,
    authoring: {
      mode: "public-benchmark-private-materializer",
      publicSafeReportOnly: true,
      targetIdHash: shortHash(options.target.targetId),
      datasetHash: options.datasetHash,
      selectedQuestionIdsHash: options.selectedQuestionIdsHash,
      answerLabelsHash: options.answerLabelsHash,
      scoringCodeHash: options.scoringCodeHash,
      materializerHash,
    },
    queries,
  };
  const answerLabels = {
    schemaVersion: 1,
    fixtureOnly: options.fixtureOnly,
    benchmark: "longmemeval",
    datasetSlice: options.datasetSlice,
    answerLabelsHash: options.answerLabelsHash,
    scoringCodeHash: options.scoringCodeHash,
    labels: options.selected.map((row) => ({
      queryId: queryIdFor(row),
      questionId: String(row.question_id),
      questionType: String(row.question_type),
      answer: String(row.answer ?? ""),
    })),
  };
  const collectorQuerySetPayload = collectorQuerySetHashPayload(querySet);
  const memories = [...sessionMap.values()].sort((left, right) => left.id.localeCompare(right.id));
  const querySetPath = resolve(privateOutputDir, "longmemeval-queryset.private.json");
  const memoriesPath = resolve(privateOutputDir, "longmemeval-memories.private.jsonl");
  const answerLabelsPath = resolve(privateOutputDir, "longmemeval-answer-labels.private.json");
  const readmePath = resolve(privateOutputDir, "README.private.txt");
  assertOutsideRepo(querySetPath, "private query set");
  assertOutsideRepo(memoriesPath, "private memories file");
  assertOutsideRepo(answerLabelsPath, "private answer labels file");
  assertNoUnsafePrivateText(JSON.stringify(querySet), "private query set");
  assertNoUnsafePrivateText(memories.map((item) => JSON.stringify(item)).join("\n"), "private memories");
  assertNoUnsafePrivateText(JSON.stringify(answerLabels), "private answer labels");
  writePrivateFile(querySetPath, `${JSON.stringify(querySet, null, 2)}\n`);
  writePrivateFile(memoriesPath, `${memories.map((item) => JSON.stringify(item)).join("\n")}\n`);
  writePrivateFile(answerLabelsPath, `${JSON.stringify(answerLabels, null, 2)}\n`);
  writePrivateFile(
    readmePath,
    [
      "Private RecallWeave public-benchmark inputs.",
      "",
      "Do not commit these files. The public report contains only hashes and counts.",
      "Use the command templates in the public materialize report to run response export and scoring.",
      "",
    ].join("\n"),
  );

  const expectedRefs = queries.reduce((sum, query) => sum + query.expectedResultIds.length + query.expectedResultHashes.length, 0);
  return {
    selection: {
      selectedCount: options.selected.length,
      questionTypeCount: new Set(options.selected.map((item) => String(item.question_type))).size,
      selectedQuestionIdsHash: options.selectedQuestionIdsHash,
      answerLabelsHash: options.answerLabelsHash,
      materializerHash,
      queryCount: queries.length,
      haystackSessionCount: memories.length,
      expectedResultRefCount: expectedRefs,
      redactionStats,
      querySetHash: `sha256:${stableHash(canonicalJson(querySet))}`,
      collectorCompatibleQuerySetHash: `sha256:${stableHash(collectorQuerySetPayload)}`,
      memoriesFileHash: `sha256:${stableHash(memories.map((item) => JSON.stringify(item)).join("\n"))}`,
      answerLabelsFileHash: `sha256:${fileHash(answerLabelsPath)}`,
    },
    privateOutputs: {
      directoryLabel: "operator-private-output-dir",
      directoryInsideRepository: false,
      fileMode: "0600",
      directoryMode: "0700",
      files: [
        { role: "queryset", name: basename(querySetPath), hash: `sha256:${fileHash(querySetPath)}`, rawTextPrivate: true },
        { role: "memories", name: basename(memoriesPath), hash: `sha256:${fileHash(memoriesPath)}`, rawTextPrivate: true },
        { role: "answer-labels", name: basename(answerLabelsPath), hash: `sha256:${fileHash(answerLabelsPath)}`, rawTextPrivate: true },
        { role: "readme", name: basename(readmePath), hash: `sha256:${fileHash(readmePath)}`, rawTextPrivate: false },
      ],
    },
  };
}

function collectorQuerySetHashPayload(querySet) {
  return {
    schemaVersion: querySet.schemaVersion ?? 1,
    datasetSlice: querySet.datasetSlice ?? null,
    queries: querySet.queries.map((query) => ({
      id: query.id,
      q: query.q,
      expectedResultIds: query.expectedResultIds ?? [],
      expectedResultHashes: query.expectedResultHashes ?? [],
    })),
  };
}

async function readDatasetBuffer(datasetUrl) {
  if (args.datasetFile) {
    const file = resolveInputPath(args.datasetFile);
    assert.ok(existsSync(file), `dataset file missing: ${displayPath(file)}`);
    assert.ok(statSync(file).isFile(), `dataset file is not a file: ${displayPath(file)}`);
    assertOutsideRepo(file, "live raw benchmark dataset file");
    return readFileSync(file);
  }
  const response = await fetch(datasetUrl);
  assert.ok(response.ok, `dataset fetch failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function selectSlice(dataset, questionTypes, options) {
  if (options.selection === "full-dataset") {
    const wantedTypes = new Set(questionTypes.map((type) => String(type)));
    const selected = dataset
      .filter((item) => wantedTypes.has(String(item.question_type)) && requiredString(item.question_id) && answerPresent(item.answer))
      .sort((left, right) => String(left.question_id).localeCompare(String(right.question_id)));
    assert.equal(selected.length, options.limit, "full dataset selection did not match the target policy limit");
    return selected;
  }
  const selected = [];
  for (const type of questionTypes) {
    if (selected.length >= options.limit) break;
    const candidates = dataset
      .filter((item) => String(item.question_type) === type && requiredString(item.question_id) && answerPresent(item.answer))
      .sort((left, right) => String(left.question_id).localeCompare(String(right.question_id)));
    selected.push(...candidates.slice(0, Math.min(options.perType, options.limit - selected.length)));
  }
  assert.equal(selected.length, Math.min(options.limit, questionTypes.length * options.perType), "slice selection did not produce the expected count");
  return selected;
}

function parseQuestionIdPolicy(value) {
  const fields = Object.fromEntries(
    String(value)
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return index === -1 ? [part, ""] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
      }),
  );
  const datasetHash = fields.datasetHash;
  assert.ok(requiredSha256(datasetHash), "questionIdPolicy needs datasetHash=sha256:<hash>");
  const types = String(fields.types ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  assert.ok(types.length > 0, "questionIdPolicy needs types");
  const limit = positiveInt(fields.limit, "questionIdPolicy limit");
  assert.equal(fields.sort, "question_id-ascending", "questionIdPolicy sort must be question_id-ascending");
  const selection = String(fields.selection ?? "");
  assert.ok(["first-per-type-round-robin", "full-dataset"].includes(selection), "questionIdPolicy selection must be first-per-type-round-robin or full-dataset");
  const perType = selection === "full-dataset" ? null : positiveInt(fields.perType, "questionIdPolicy perType");
  return { datasetHash, types, perType, limit, selection };
}

function formatSessionContent(input) {
  const messages = asArray(input.messages);
  const lines = [];
  if (requiredString(input.date)) lines.push(`Date: ${String(input.date)}`);
  lines.push(`Session: ${input.sessionId}`);
  for (const message of messages) {
    if (!message || typeof message !== "object") continue;
    const role = String(message.role ?? "message").trim() || "message";
    const content = redactPrivateBenchmarkText(message.content, input.redactionStats);
    if (content) lines.push(`${titleCase(role)}: ${content}`);
  }
  return lines.join("\n");
}

function runCommandTemplates(privateOutputs) {
  const querySet = `<private-output-dir>/${privateOutputs.files.find((item) => item.role === "queryset")?.name ?? "longmemeval-queryset.private.json"}`;
  const memories = `<private-output-dir>/${privateOutputs.files.find((item) => item.role === "memories")?.name ?? "longmemeval-memories.private.jsonl"}`;
  const answerLabels = `<private-output-dir>/${privateOutputs.files.find((item) => item.role === "answer-labels")?.name ?? "longmemeval-answer-labels.private.json"}`;
  return {
    exportResponses:
      `RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 pnpm baseline:export:recallweave -- --live --queryset ${querySet} --memories ${memories} --preserve-ids --strategy ${retrievalStrategy} --context-token-budget ${contextTokenBudget} --limit ${limit} --output <private-output-dir>/longmemeval-recallweave-responses.private.json`,
    collectMetrics:
      `RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 RECALLWEAVE_BASELINE_JUDGE_MODEL=<judge-model> RECALLWEAVE_BASELINE_ANSWER_MODEL=<answer-model> pnpm baseline:collect:recallweave -- --live --queryset ${querySet} --responses <private-output-dir>/longmemeval-recallweave-responses.private.json --retrieval-mode strategy:${retrievalStrategy} --limit ${limit} --output <public-metrics-output.json>`,
    scoreAnswerQuality:
      `RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS=1 RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA=1 RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT=1 pnpm benchmark:answer-quality -- --live --target <target.json> --queryset ${querySet} --memories ${memories} --answer-labels ${answerLabels} --arm ${retrievalStrategy}=<private-output-dir>/longmemeval-recallweave-responses.private.json --output <public-answer-quality-output.json>`,
  };
}

function queryIdFor(row) {
  return `longmemeval-${shortHash(`${row.question_type}:${row.question_id}`)}`;
}

function renderMarkdown(value) {
  return [
    "# Public Benchmark Materialize Run",
    "",
    `- OK: ${value.ok}`,
    `- Fixture only: ${value.fixtureOnly}`,
    `- Benchmark: ${value.benchmark}`,
    `- Claim tier: ${value.claimTier}`,
    `- Dataset hash: ${value.source.datasetHash}`,
    `- Query count: ${value.selection.queryCount}`,
    `- Haystack session count: ${value.selection.haystackSessionCount}`,
    `- Expected result ref count: ${value.selection.expectedResultRefCount}`,
    `- Query set hash: ${value.selection.querySetHash}`,
    `- Collector-compatible query set hash: ${value.selection.collectorCompatibleQuerySetHash}`,
    `- Memories file hash: ${value.selection.memoriesFileHash}`,
    `- Retrieval strategy: ${value.target.retrievalStrategy}`,
    `- Context token budget: ${value.target.contextTokenBudget}`,
    `- Result limit: ${value.target.limit}`,
    "",
    "## Safety",
    "",
    `- Metrics only: ${value.metricsOnly}`,
    `- Public safe: ${value.publicSafe}`,
    `- Raw question ids included: ${value.rawQuestionIdsIncluded}`,
    `- Raw questions included: ${value.rawQuestionsIncluded}`,
    `- Raw answers included: ${value.rawAnswersIncluded}`,
    `- Raw memory included: ${value.rawMemoryIncluded}`,
    `- Raw transcript included: ${value.rawTranscriptIncluded}`,
    `- Private output path included: ${value.rawPrivateOutputPathIncluded}`,
    "",
    "## Private Outputs",
    "",
    ...value.privateOutputs.files.map((file) => `- ${file.role}: ${file.name} (${file.hash})`),
    "",
    "## Next Actions",
    "",
    ...value.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}

function publicSafety() {
  return {
    publicSafe: true,
    metricsOnly: true,
    privateInputsStoredOutsideRepository: true,
    rawQuestionIdsIncluded: false,
    rawQuestionsIncluded: false,
    rawAnswersIncluded: false,
    rawMemoryIncluded: false,
    rawTranscriptIncluded: false,
    rawPrivateOutputPathIncluded: false,
    printsCredentials: false,
  };
}

function assertSafePublicText(text, label) {
  assertNoPattern(text, secretPattern, `${label} contains a key-shaped secret`);
  assertNoPattern(text, privatePathPattern, `${label} contains a private path or raw memory filename`);
  assertNoPattern(text, privateTagPattern, `${label} contains private tags`);
}

function assertNoUnsafePrivateText(text, label) {
  assertNoPattern(text, secretPattern, `${label} contains a key-shaped secret`);
  assertNoPattern(text, privateTagPattern, `${label} contains private tags`);
}

function assertNoPattern(text, pattern, message) {
  pattern.lastIndex = 0;
  if (pattern.test(String(text))) throw new Error(message);
}

function writePrivateFile(path, text) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
  chmodSync(path, 0o600);
}

function writePublicOutput(path, text) {
  const resolved = resolve(path);
  mkdirSync(dirname(resolved), { recursive: true });
  assertSafePublicText(text, "public output");
  writeFileSync(resolved, text, { encoding: "utf8", mode: 0o600 });
}

function resolvePrivateOutputDir(value) {
  if (value) return isAbsolute(value) ? value : resolve(root, value);
  return mkdtempSync(resolve(tmpdir(), "recallweave-public-benchmark-"));
}

function assertOutsideRepo(path, label) {
  const rel = relative(root, resolve(path));
  assert.ok(rel.startsWith("..") || isAbsolute(rel), `${label} must stay outside the repository`);
}

function redactPrivateBenchmarkText(text, stats) {
  const input = String(text ?? "");
  const privateTagMatches = input.match(privateTagPattern) ?? [];
  const secretMatches = input.match(secretPatternGlobal) ?? [];
  if (stats) {
    stats.privateTagRedactionCount += privateTagMatches.length;
    stats.keyShapedTokenRedactionCount += secretMatches.length;
  }
  return input
    .replace(privateTagPattern, " ")
    .replace(secretPatternGlobal, "[redacted-key-shaped-token]")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(text) {
  return String(text).toLowerCase().replace(/\s+/g, " ").trim();
}

function requiredString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function answerPresent(value) {
  return value != null && String(value).trim().length > 0;
}

function requiredHttpsUrl(value) {
  try {
    const parsed = new URL(String(value));
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function requiredSha256(value) {
  return /^sha256:[a-f0-9]{64}$/i.test(String(value ?? ""));
}

function normalizeBenchmarkName(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, "-").replace(/^longmemeval-s$/, "longmemeval");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function titleCase(value) {
  const text = String(value).toLowerCase();
  return text ? `${text.slice(0, 1).toUpperCase()}${text.slice(1)}` : "Message";
}

function canonicalJson(value) {
  return JSON.stringify(sortForHash(value));
}

function sortForHash(value) {
  if (Array.isArray(value)) return value.map((item) => sortForHash(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortForHash(child)]),
    );
  }
  return value;
}

function fileHash(path) {
  return stableHash(readFileSync(path, "utf8"));
}

function stableHash(value) {
  const input = Buffer.isBuffer(value) ? value : typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(input).digest("hex");
}

function shortHash(value) {
  return stableHash(String(value)).slice(0, 16);
}

function positiveInt(value, label) {
  const number = Number(value);
  assert.ok(Number.isInteger(number) && number > 0, `${label} must be a positive integer`);
  return number;
}

function normalizeRetrievalStrategy(value) {
  const strategy = String(value ?? "").trim().toLowerCase();
  assert.ok(["jaccard", "bm25-lite", "hybrid-v1"].includes(strategy), `unknown retrieval strategy: ${strategy}`);
  return strategy;
}

function resolveInputPath(value) {
  if (!value) return null;
  return isAbsolute(value) ? value : resolve(root, value);
}

function displayPath(value) {
  const rel = relative(root, resolve(value)).replaceAll("\\", "/");
  return rel.startsWith("..") ? basename(value) : rel;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item.startsWith("--")) {
      const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) {
        parsed[key] = true;
      } else {
        parsed[key] = next;
        index += 1;
      }
    }
  }
  return parsed;
}
