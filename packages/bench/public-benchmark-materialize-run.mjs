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
    (fixtureRequested ? null : "reviews/overnight-20260522/public-longmemeval-full-run-target.json"),
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
const memoryMethod = normalizeMemoryMethod(args.memoryMethod ?? process.env.RECALLWEAVE_MEMORYBENCH_MEMORY_METHOD ?? "session-v1");
const contextualChunkChars = positiveInt(
  args.contextualChunkChars ?? process.env.RECALLWEAVE_CONTEXTUAL_MEMORY_CHUNK_CHARS ?? 1800,
  "contextual chunk chars",
);
const materializeMaxQueries = optionalPositiveInt(args.maxQueries ?? process.env.RECALLWEAVE_MATERIALIZE_MAX_QUERIES ?? null, "materialize max queries");
const materializeQueryOffset = optionalNonNegativeInt(
  args.queryOffset ?? process.env.RECALLWEAVE_MATERIALIZE_QUERY_OFFSET ?? 0,
  "materialize query offset",
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
  const targetSelected = selectSlice(dataset, policy.types, { perType: policy.perType, limit: policy.limit, selection: policy.selection });
  const targetSelectedIds = targetSelected.map((item) => String(item.question_id));
  const targetSelectedQuestionIdsHash = `sha256:${stableHash(targetSelectedIds.join("\n"))}`;
  const targetLabelPayload = targetSelected.map((item) => ({
    questionId: String(item.question_id),
    questionType: String(item.question_type),
    answer: String(item.answer ?? ""),
  }));
  const targetAnswerLabelsHash = `sha256:${stableHash(canonicalJson(targetLabelPayload))}`;
  assert.equal(targetSelectedQuestionIdsHash, sourceLock.nextTargetRecommendation?.selectedQuestionIdsHash ?? targetSelectedQuestionIdsHash);
  assert.equal(targetAnswerLabelsHash, target.benchmark.answerLabelsHash, "target answer label hash must match target");

  const shard = materializationShard(targetSelected);
  const selected = shard.selected;
  const selectedIds = selected.map((item) => String(item.question_id));
  const selectedQuestionIdsHash = `sha256:${stableHash(selectedIds.join("\n"))}`;
  const labelPayload = selected.map((item) => ({
    questionId: String(item.question_id),
    questionType: String(item.question_type),
    answer: String(item.answer ?? ""),
  }));
  const answerLabelsHash = `sha256:${stableHash(canonicalJson(labelPayload))}`;

  const materialized = writePrivateBenchmarkInputs({
    fixtureOnly: false,
    datasetSlice: target.benchmark.split,
    judgeModel: target.benchmark.judgeModel,
    answerModel: target.benchmark.answerModel,
    selected,
    target,
    materializationShard: shard,
    rawDatasetText: rawText,
    rawDatasetByteSize: rawBuffer.byteLength,
    rawDatasetItemCount: dataset.length,
    datasetHash,
    selectedQuestionIdsHash,
    targetSelectedQuestionIdsHash,
    answerLabelsHash,
    targetAnswerLabelsHash,
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
    rawSourcesRetainedPrivate: true,
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
      memoryMethod,
      materializationShard: shard.summary,
    },
    selection: materialized.selection,
    sourceRetention: materialized.sourceRetention,
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
  const targetSelected = [
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
  const shard = materializationShard(targetSelected);
  const selected = shard.selected;
  const selectedQuestionIdsHash = `sha256:${stableHash(selected.map((item) => item.question_id).join("\n"))}`;
  const targetSelectedQuestionIdsHash = `sha256:${stableHash(targetSelected.map((item) => item.question_id).join("\n"))}`;
  const rawDatasetText = JSON.stringify(targetSelected, null, 2);
  const answerLabelsHash = `sha256:${stableHash(canonicalJson(selected.map((item) => ({
    questionId: item.question_id,
    questionType: item.question_type,
    answer: item.answer,
  }))))}`;
  const targetAnswerLabelsHash = `sha256:${stableHash(canonicalJson(targetSelected.map((item) => ({
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
    materializationShard: shard,
    rawDatasetText,
    rawDatasetByteSize: Buffer.byteLength(rawDatasetText, "utf8"),
    rawDatasetItemCount: targetSelected.length,
    datasetHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    selectedQuestionIdsHash,
    targetSelectedQuestionIdsHash,
    answerLabelsHash,
    targetAnswerLabelsHash,
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
    rawSourcesRetainedPrivate: true,
    generatedAt: "2026-05-23T00:00:00.000Z",
    source: {
      memoryBenchCommit: "118209a746d97d0d85e5a7234267f0b6962857e9",
      datasetHost: "fixture",
      datasetHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      datasetByteSize: 1024,
      datasetItemCount: targetSelected.length,
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
      memoryMethod,
      materializationShard: materialized.selection.materializationShard,
    },
    selection: materialized.selection,
    sourceRetention: materialized.sourceRetention,
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
  const sessionContentById = new Map();
  const memoryMap = new Map();
  const chunkIdsBySessionId = new Map();
  const chunkHashesBySessionId = new Map();
  const answerContentHashesByQuery = new Map();
  const materializerHash =
    memoryMethod === "session-v1"
      ? `sha256:${stableHash("public-benchmark-materialize-run:v1")}`
      : `sha256:${stableHash(`public-benchmark-materialize-run:v1:${memoryMethod}`)}`;
  const redactionStats = {
    keyShapedTokenRedactionCount: 0,
    privateTagRedactionCount: 0,
  };
  for (const row of options.selected) {
    const sessionIds = asArray(row.haystack_session_ids).map((item) => String(item));
    const sessions = asArray(row.haystack_sessions);
    const dates = asArray(row.haystack_dates);
    sessionIds.forEach((sessionId, index) => {
      if (!requiredString(sessionId) || sessionContentById.has(sessionId)) return;
      const formatted = formatSessionLines({
        sessionId,
        date: dates[index],
        messages: sessions[index],
        redactionStats,
      });
      const content = formatted.lines.join("\n");
      sessionContentById.set(sessionId, content);
      const records = memoryRecordsForSession({
        sessionId,
        date: dates[index],
        content,
        messageLines: formatted.messageLines,
      });
      const sourceChunks = records.filter((record) => record.metadata?.kind === "contextual_source_chunk");
      chunkIdsBySessionId.set(sessionId, sourceChunks.map((record) => record.id));
      chunkHashesBySessionId.set(
        sessionId,
        sourceChunks.map((record) => `sha256:${stableHash(normalizeText(record.content))}`),
      );
      for (const record of records) memoryMap.set(record.id, record);
    });
    const hashes = asArray(row.answer_session_ids)
      .map((sessionId) => sessionContentById.get(String(sessionId)))
      .filter(Boolean)
      .map((content) => `sha256:${stableHash(normalizeText(content))}`);
    answerContentHashesByQuery.set(String(row.question_id), [...new Set(hashes)]);
  }

  const queries = options.selected.map((row) => {
    const answerSessionIds = asArray(row.answer_session_ids).map((item) => String(item)).filter(Boolean);
    const expectedResultIds = usesContextualChunkRefs()
        ? answerSessionIds.flatMap((sessionId) => chunkIdsBySessionId.get(sessionId) ?? [sessionId])
        : answerSessionIds;
    const expectedChunkHashes = answerSessionIds.flatMap((sessionId) => chunkHashesBySessionId.get(sessionId) ?? []);
    return {
      id: queryIdFor(row),
      q: String(row.question),
      expectedResultIds,
      expectedResultHashes: usesContextualChunkRefs()
        ? expectedResultIds.length > 0
          ? []
          : expectedChunkHashes
        : answerContentHashesByQuery.get(String(row.question_id)) ?? [],
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
      targetSelectedQuestionIdsHash: options.targetSelectedQuestionIdsHash,
      answerLabelsHash: options.answerLabelsHash,
      targetAnswerLabelsHash: options.targetAnswerLabelsHash,
      scoringCodeHash: options.scoringCodeHash,
      materializerHash,
      memoryMethod,
      materializationShard: options.materializationShard?.summary ?? null,
    },
    queries,
  };
  const answerLabels = {
    schemaVersion: 1,
    fixtureOnly: options.fixtureOnly,
    benchmark: "longmemeval",
    datasetSlice: options.datasetSlice,
    answerLabelsHash: options.answerLabelsHash,
    targetAnswerLabelsHash: options.targetAnswerLabelsHash,
    scoringCodeHash: options.scoringCodeHash,
    materializationShard: options.materializationShard?.summary ?? null,
    labels: options.selected.map((row) => ({
      queryId: queryIdFor(row),
      questionId: String(row.question_id),
      questionType: String(row.question_type),
      answer: String(row.answer ?? ""),
    })),
  };
  const collectorQuerySetPayload = collectorQuerySetHashPayload(querySet);
  const memories = [...memoryMap.values()].sort((left, right) => left.id.localeCompare(right.id));
  const querySetPath = resolve(privateOutputDir, "longmemeval-queryset.private.json");
  const memoriesPath = resolve(privateOutputDir, "longmemeval-memories.private.jsonl");
  const answerLabelsPath = resolve(privateOutputDir, "longmemeval-answer-labels.private.json");
  const rawDatasetPath = resolve(privateOutputDir, "longmemeval-raw-dataset.private.json");
  const selectedRawRowsPath = resolve(privateOutputDir, "longmemeval-selected-raw-rows.private.json");
  const sourceManifestPath = resolve(privateOutputDir, "longmemeval-source-manifest.private.json");
  const readmePath = resolve(privateOutputDir, "README.private.txt");
  assertOutsideRepo(querySetPath, "private query set");
  assertOutsideRepo(memoriesPath, "private memories file");
  assertOutsideRepo(answerLabelsPath, "private answer labels file");
  assertOutsideRepo(rawDatasetPath, "private raw dataset file");
  assertOutsideRepo(selectedRawRowsPath, "private selected raw rows file");
  assertOutsideRepo(sourceManifestPath, "private source manifest file");
  assertNoUnsafePrivateText(JSON.stringify(querySet), "private query set");
  assertNoUnsafePrivateText(memories.map((item) => JSON.stringify(item)).join("\n"), "private memories");
  assertNoUnsafePrivateText(JSON.stringify(answerLabels), "private answer labels");
  const rawDatasetText = options.rawDatasetText.endsWith("\n") ? options.rawDatasetText : `${options.rawDatasetText}\n`;
  const selectedRawRowsText = `${JSON.stringify(options.selected, null, 2)}\n`;
  const querySetHash = `sha256:${stableHash(canonicalJson(querySet))}`;
  const memoriesFileHash = `sha256:${stableHash(memories.map((item) => JSON.stringify(item)).join("\n"))}`;
  const rawDatasetHash = `sha256:${stableHash(rawDatasetText)}`;
  const selectedRawRowsHash = `sha256:${stableHash(selectedRawRowsText)}`;
  const sourceManifest = {
    schemaVersion: 1,
    mode: "longmemeval-source-retention-manifest",
    fixtureOnly: options.fixtureOnly,
    benchmark: "longmemeval",
    datasetSlice: options.datasetSlice,
    memoryMethod,
    rawDataset: {
      fileName: basename(rawDatasetPath),
      hash: rawDatasetHash,
      datasetHash: options.datasetHash,
      byteSize: options.rawDatasetByteSize,
      itemCount: options.rawDatasetItemCount,
      rawTextPrivate: true,
    },
    selectedRawRows: {
      fileName: basename(selectedRawRowsPath),
      hash: selectedRawRowsHash,
      rowCount: options.selected.length,
      selectedQuestionIdsHash: options.selectedQuestionIdsHash,
      targetSelectedQuestionIdsHash: options.targetSelectedQuestionIdsHash,
      rawTextPrivate: true,
    },
    derivedInputs: {
      querySetHash,
      memoriesFileHash,
      answerLabelsHash: options.answerLabelsHash,
      targetAnswerLabelsHash: options.targetAnswerLabelsHash,
      scoringCodeHash: options.scoringCodeHash,
      materializerHash,
      memoryMethod,
    },
    publicReportOnlyContainsHashesAndCounts: true,
  };
  writePrivateFile(querySetPath, `${JSON.stringify(querySet, null, 2)}\n`);
  writePrivateFile(memoriesPath, `${memories.map((item) => JSON.stringify(item)).join("\n")}\n`);
  writePrivateFile(answerLabelsPath, `${JSON.stringify(answerLabels, null, 2)}\n`);
  writePrivateFile(rawDatasetPath, rawDatasetText);
  writePrivateFile(selectedRawRowsPath, selectedRawRowsText);
  writePrivateFile(sourceManifestPath, `${JSON.stringify(sourceManifest, null, 2)}\n`);
  const sourceManifestHash = `sha256:${fileHash(sourceManifestPath)}`;
  writePrivateFile(
    readmePath,
    [
      "Private RecallWeave public-benchmark inputs.",
      "",
      "Do not commit these files. They include the raw benchmark source, selected raw rows, derived query/memory/label inputs, and a source manifest.",
      "The public report contains only hashes, counts, file roles, and file names.",
      "Use the command templates in the public materialize report to run response export and scoring.",
      "",
      `Memory method: ${memoryMethod}`,
      "",
    ].join("\n"),
  );

  const expectedRefs = queries.reduce((sum, query) => sum + query.expectedResultIds.length + query.expectedResultHashes.length, 0);
  return {
    selection: {
      selectedCount: options.selected.length,
      questionTypeCount: new Set(options.selected.map((item) => String(item.question_type))).size,
      selectedQuestionIdsHash: options.selectedQuestionIdsHash,
      targetSelectedQuestionIdsHash: options.targetSelectedQuestionIdsHash,
      answerLabelsHash: options.answerLabelsHash,
      targetAnswerLabelsHash: options.targetAnswerLabelsHash,
      materializerHash,
      memoryMethod,
      materializationShard: options.materializationShard?.summary ?? null,
      queryCount: queries.length,
      haystackSessionCount: sessionContentById.size,
      memoryRecordCount: memories.length,
      contextualSourceChunkCount: memories.filter((item) => item.metadata?.kind === "contextual_source_chunk").length,
      contextualIndexMemoryCount: memories.filter((item) => item.metadata?.kind === "contextual_index").length,
      atomicMemoryCount: memories.filter((item) => item.metadata?.kind === "atomic_memory").length,
      rawSessionMemoryCount: memories.filter((item) => item.metadata?.kind === "raw_session").length,
      expectedResultRefCount: expectedRefs,
      redactionStats,
      querySetHash,
      collectorCompatibleQuerySetHash: `sha256:${stableHash(collectorQuerySetPayload)}`,
      memoriesFileHash,
      answerLabelsFileHash: `sha256:${fileHash(answerLabelsPath)}`,
    },
    sourceRetention: {
      rawDatasetRetainedPrivate: true,
      selectedRawRowsRetainedPrivate: true,
      sourceManifestRetainedPrivate: true,
      rawTextPubliclyIncluded: false,
      privateOutputPathIncluded: false,
      rawDatasetHash,
      selectedRawRowsHash,
      sourceManifestHash,
      rawDatasetByteSize: options.rawDatasetByteSize,
      rawDatasetItemCount: options.rawDatasetItemCount,
      selectedRawRowsCount: options.selected.length,
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
        { role: "raw-dataset", name: basename(rawDatasetPath), hash: rawDatasetHash, rawTextPrivate: true },
        { role: "selected-raw-rows", name: basename(selectedRawRowsPath), hash: selectedRawRowsHash, rawTextPrivate: true },
        { role: "source-manifest", name: basename(sourceManifestPath), hash: sourceManifestHash, rawTextPrivate: false },
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

function materializationShard(selected) {
  const totalQueryCount = selected.length;
  assert.ok(materializeQueryOffset <= totalQueryCount, `materialize query offset ${materializeQueryOffset} exceeds selected query count ${totalQueryCount}`);
  const endIndexExclusive = materializeMaxQueries
    ? Math.min(totalQueryCount, materializeQueryOffset + materializeMaxQueries)
    : totalQueryCount;
  const shardSelected = selected.slice(materializeQueryOffset, endIndexExclusive);
  assert.ok(shardSelected.length > 0, "materialized query shard is empty");
  const summary = {
    applied: materializeQueryOffset > 0 || materializeMaxQueries != null,
    startIndex: materializeQueryOffset,
    endIndexExclusive,
    totalQueryCount,
    selectedCount: shardSelected.length,
    requestedLimit: materializeMaxQueries,
    selectedQuestionIdsHash: `sha256:${stableHash(shardSelected.map((item) => String(item.question_id)).join("\n"))}`,
  };
  return { ...summary, selected: shardSelected, summary };
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
  return formatSessionLines(input).lines.join("\n");
}

function formatSessionLines(input) {
  const messages = asArray(input.messages);
  const lines = [];
  const messageLines = [];
  if (requiredString(input.date)) lines.push(`Date: ${String(input.date)}`);
  lines.push(`Session: ${input.sessionId}`);
  for (const message of messages) {
    if (!message || typeof message !== "object") continue;
    const role = String(message.role ?? "message").trim() || "message";
    const content = redactPrivateBenchmarkText(message.content, input.redactionStats);
    if (content) {
      const line = `${titleCase(role)}: ${content}`;
      lines.push(line);
      messageLines.push(line);
    }
  }
  return { lines, messageLines };
}

function memoryRecordsForSession(input) {
  const date = requiredString(input.date) ? String(input.date) : null;
  if (memoryMethod === "session-v1") {
    return [
      {
        id: input.sessionId,
        content: input.content,
        metadata: {
          benchmark: "longmemeval",
          source: "MemoryBench LongMemEval-S cleaned",
          date,
          kind: "raw_session",
        },
      },
    ];
  }

  const chunks = chunkSessionLines(input.messageLines.length > 0 ? input.messageLines : [input.content]);
  if (memoryMethod === "contextual-source-chunk-v1") {
    return chunks.map((chunkLines, index) => contextualSourceChunkRecord({ ...input, chunkLines, index, chunks, date }));
  }

  if (memoryMethod === "atomic-memory-v1") {
    return chunks.flatMap((chunkLines, index) => atomicMemoryRecordsForChunk({ ...input, chunkLines, index, chunks, date }));
  }

  return chunks.flatMap((chunkLines, index) => {
    const chunkText = chunkLines.join("\n");
    const terms = salientTerms(chunkText, 12);
    const title = terms.length > 0 ? terms.slice(0, 6).join(" ") : `session ${shortHash(input.sessionId)}`;
    const eventDate = firstDateLikeText(chunkText) ?? date;
    const source = contextualSourceChunkRecord({ ...input, chunkLines, index, chunks, date, terms, title, eventDate });
    const sourceContentHash = `sha256:${stableHash(normalizeText(source.content))}`;
    const indexId = `${input.sessionId}#index-${String(index + 1).padStart(3, "0")}`;
    return [
      {
        ...source,
        metadata: {
          ...source.metadata,
          retrievalRole: "source",
          indexedBy: indexId,
        },
      },
      {
        id: indexId,
        content: contextualIndexContent({
          sessionId: input.sessionId,
          date,
          eventDate,
          title,
          terms,
          chunkLines,
          chunkIndex: index,
          chunkCount: chunks.length,
          sourceChunkId: source.id,
        }),
        metadata: {
          benchmark: "longmemeval",
          source: "MemoryBench LongMemEval-S cleaned",
          kind: "contextual_index",
          retrievalRole: "index",
          sourceChunkId: source.id,
          rehydrateId: source.id,
          sourceContentHash,
          sourceEstimatedTokens: estimateTokens(source.content),
          parentSessionId: input.sessionId,
          date,
          documentDate: date,
          eventDate,
          title,
          topic: terms.slice(0, 5).join(" "),
          topicPath: "Benchmarks / LongMemEval-S / atomic-index",
          subtopic: terms.join(" "),
          subtopicPath: `${date ?? "undated"} / ${terms.slice(0, 6).join(" ") || "source chunk"}`,
          chunkIndex: index,
          chunkCount: chunks.length,
          sourceRetention: "private-source-chunk",
        },
      },
    ];
  });
}

function contextualSourceChunkRecord(input) {
  const chunkText = input.chunkLines.join("\n");
  const terms = input.terms ?? salientTerms(chunkText, 12);
  const title = input.title ?? (terms.length > 0 ? terms.slice(0, 6).join(" ") : `session ${shortHash(input.sessionId)}`);
  const eventDate = input.eventDate ?? firstDateLikeText(chunkText) ?? input.date;
  return {
    id: `${input.sessionId}#chunk-${String(input.index + 1).padStart(3, "0")}`,
      content: [
        `Contextual memory: ${title}`,
        input.date ? `Document date: ${input.date}` : null,
        eventDate ? `Event date: ${eventDate}` : null,
        `Session: ${input.sessionId}`,
        `Chunk: ${input.index + 1}/${input.chunks.length}`,
        "Source excerpt:",
        chunkText,
      ]
        .filter(Boolean)
        .join("\n"),
      metadata: {
        benchmark: "longmemeval",
        source: "MemoryBench LongMemEval-S cleaned",
        kind: "contextual_source_chunk",
        parentSessionId: input.sessionId,
        date: input.date,
        documentDate: input.date,
        eventDate,
        title,
        topic: terms.slice(0, 5).join(" "),
        topicPath: "Benchmarks / LongMemEval-S / source-session",
        subtopic: terms.join(" "),
        subtopicPath: `${input.date ?? "undated"} / ${terms.slice(0, 6).join(" ") || "source chunk"}`,
        chunkIndex: input.index,
        chunkCount: input.chunks.length,
        sourceRetention: "private-source-chunk",
      },
  };
}

function atomicMemoryRecordsForChunk(input) {
  const chunkText = input.chunkLines.join("\n");
  const terms = input.terms ?? salientTerms(chunkText, 16);
  const title = terms.length > 0 ? terms.slice(0, 6).join(" ") : `session ${shortHash(input.sessionId)}`;
  const eventDate = firstDateLikeText(chunkText) ?? input.date;
  const source = contextualSourceChunkRecord({ ...input, terms, title, eventDate });
  const sourceContentHash = `sha256:${stableHash(normalizeText(source.content))}`;
  const atomId = `${input.sessionId}#atom-${String(input.index + 1).padStart(3, "0")}`;
  const facts = atomicFactLines(input.chunkLines);
  return [
    {
      ...source,
      metadata: {
        ...source.metadata,
        retrievalRole: "source",
        indexedBy: atomId,
      },
    },
    {
      id: atomId,
      content: atomicMemoryContent({
        sessionId: input.sessionId,
        date: input.date,
        eventDate,
        title,
        terms,
        facts,
        chunkIndex: input.index,
        chunkCount: input.chunks.length,
        sourceChunkId: source.id,
      }),
      metadata: {
        benchmark: "longmemeval",
        source: "MemoryBench LongMemEval-S cleaned",
        kind: "atomic_memory",
        retrievalRole: "index",
        sourceChunkId: source.id,
        rehydrateId: source.id,
        sourceContentHash,
        sourceEstimatedTokens: estimateTokens(source.content),
        parentSessionId: input.sessionId,
        date: input.date,
        documentDate: input.date,
        eventDate,
        title,
        topic: terms.slice(0, 5).join(" "),
        topicPath: "Benchmarks / LongMemEval-S / atomic-memory",
        subtopic: terms.join(" "),
        subtopicPath: `${input.date ?? "undated"} / ${terms.slice(0, 6).join(" ") || "atomic memory"}`,
        chunkIndex: input.index,
        chunkCount: input.chunks.length,
        atomicFactCount: facts.length,
        sourceRetention: "private-source-chunk",
      },
    },
  ];
}

function atomicMemoryContent(input) {
  return [
    `Atomic memory: ${input.title}`,
    input.date ? `Document date: ${input.date}` : null,
    input.eventDate ? `Event date: ${input.eventDate}` : null,
    `Topic: ${input.terms.slice(0, 5).join(" ") || "source session"}`,
    `Subtopic: ${input.terms.join(" ") || "source chunk"}`,
    `Session: ${input.sessionId}`,
    `Source chunk: ${input.sourceChunkId}`,
    `Chunk: ${input.chunkIndex + 1}/${input.chunkCount}`,
    "Facts:",
    ...input.facts.map((fact) => `- ${fact}`),
    `Key terms: ${input.terms.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function atomicFactLines(lines) {
  const facts = [];
  for (const line of lines) {
    const cleaned = String(line ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) continue;
    const withoutRole = cleaned.replace(/^(User|Assistant|System|Message):\s*/i, "");
    if (!withoutRole) continue;
    facts.push(withoutRole.slice(0, 260));
    if (facts.length >= 8) break;
  }
  return facts.length ? facts : ["Source chunk contains benchmark memory context."];
}

function contextualIndexContent(input) {
  const roleSummary = input.chunkLines
    .slice(0, 6)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((line) => line.slice(0, 220))
    .join(" | ");
  return [
    `Atomic contextual index: ${input.title}`,
    input.date ? `Document date: ${input.date}` : null,
    input.eventDate ? `Event date: ${input.eventDate}` : null,
    `Topic: ${input.terms.slice(0, 5).join(" ") || "source session"}`,
    `Subtopic: ${input.terms.join(" ") || "source chunk"}`,
    `Session: ${input.sessionId}`,
    `Source chunk: ${input.sourceChunkId}`,
    `Chunk: ${input.chunkIndex + 1}/${input.chunkCount}`,
    `Index summary: ${roleSummary}`,
    `Key terms: ${input.terms.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function chunkSessionLines(lines) {
  const chunks = [];
  let current = [];
  let size = 0;
  for (const line of lines) {
    const text = String(line);
    if (current.length > 0 && size + text.length + 1 > contextualChunkChars) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(text);
    size += text.length + 1;
  }
  if (current.length > 0) chunks.push(current);
  return chunks.length > 0 ? chunks : [lines.map((line) => String(line)).filter(Boolean)];
}

function salientTerms(text, limit) {
  const stop = new Set([
    "about",
    "after",
    "assistant",
    "before",
    "could",
    "from",
    "have",
    "message",
    "should",
    "that",
    "their",
    "there",
    "this",
    "user",
    "what",
    "when",
    "where",
    "which",
    "with",
    "would",
  ]);
  const counts = new Map();
  for (const token of normalizeText(text).match(/[a-z0-9][a-z0-9_-]{2,}/g) ?? []) {
    if (stop.has(token)) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([token]) => token);
}

function firstDateLikeText(text) {
  const iso = String(text).match(/\b20\d{2}-\d{2}-\d{2}\b/);
  if (iso) return iso[0];
  const named = String(text).match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,\s*20\d{2})?\b/i);
  return named ? named[0] : null;
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
    `- Memory method: ${value.selection.memoryMethod}`,
    `- Materialization shard: ${value.selection.materializationShard?.applied ? `${value.selection.materializationShard.startIndex}-${value.selection.materializationShard.endIndexExclusive}` : "full"}`,
    `- Query count: ${value.selection.queryCount}`,
    `- Haystack session count: ${value.selection.haystackSessionCount}`,
    `- Memory record count: ${value.selection.memoryRecordCount}`,
    `- Contextual source chunk count: ${value.selection.contextualSourceChunkCount}`,
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
    `- Raw sources retained privately: ${value.rawSourcesRetainedPrivate}`,
    "",
    "## Source Retention",
    "",
    `- Raw dataset retained privately: ${value.sourceRetention.rawDatasetRetainedPrivate}`,
    `- Selected raw rows retained privately: ${value.sourceRetention.selectedRawRowsRetainedPrivate}`,
    `- Source manifest retained privately: ${value.sourceRetention.sourceManifestRetainedPrivate}`,
    `- Raw dataset hash: ${value.sourceRetention.rawDatasetHash}`,
    `- Selected raw rows hash: ${value.sourceRetention.selectedRawRowsHash}`,
    `- Source manifest hash: ${value.sourceRetention.sourceManifestHash}`,
    `- Public raw text included: ${value.sourceRetention.rawTextPubliclyIncluded}`,
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
    rawSourcesRetainedPrivate: true,
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

function estimateTokens(text) {
  return Math.max(1, Math.ceil(String(text ?? "").length / 4));
}

function positiveInt(value, label) {
  const number = Number(value);
  assert.ok(Number.isInteger(number) && number > 0, `${label} must be a positive integer`);
  return number;
}

function optionalPositiveInt(value, label) {
  if (value == null || value === "") return null;
  return positiveInt(value, label);
}

function optionalNonNegativeInt(value, label) {
  if (value == null || value === "") return 0;
  const number = Number(value);
  assert.ok(Number.isInteger(number) && number >= 0, `${label} must be a non-negative integer`);
  return number;
}

function normalizeRetrievalStrategy(value) {
  const strategy = String(value ?? "").trim().toLowerCase();
  assert.ok(["jaccard", "bm25-lite", "hybrid-v1"].includes(strategy), `unknown retrieval strategy: ${strategy}`);
  return strategy;
}

function normalizeMemoryMethod(value) {
  const method = String(value ?? "").trim().toLowerCase();
  assert.ok(["session-v1", "contextual-source-chunk-v1", "contextual-index-source-chunk-v1", "atomic-memory-v1"].includes(method), `unknown memory method: ${method}`);
  return method;
}

function usesContextualChunkRefs() {
  return memoryMethod === "contextual-source-chunk-v1" || memoryMethod === "contextual-index-source-chunk-v1" || memoryMethod === "atomic-memory-v1";
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
