import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const fixtureRequested = Boolean(args.fixture) || (!args.live && !args.datasetFile && !args.datasetUrl);
const format = String(args.format ?? "json").toLowerCase();
const outputPath = args.output ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_SLICE_OUTPUT ?? null;
const markdownOutputPath = args.markdownOutput ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_SLICE_MARKDOWN_OUTPUT ?? null;
const sourceLockPath = resolveInputPath(
  args.sourceLock ??
    args.sourceLockFile ??
    process.env.RECALLWEAVE_PUBLIC_BENCHMARK_SOURCE_LOCK ??
    "reviews/overnight-20260522/public-memorybench-source-lock.json",
);
const benchmark = normalizeBenchmarkName(args.benchmark ?? "longmemeval");
const selection = normalizeSelection(args.selection ?? (args.full ? "full-dataset" : "first-per-type-round-robin"));
const perType = selection === "full-dataset" ? null : Number(args.perType ?? 1);
const limit = args.limit == null && selection === "full-dataset" ? null : Number(args.limit ?? 6);
if (selection === "first-per-type-round-robin") {
  assert.ok(Number.isInteger(perType) && perType > 0, "--per-type must be a positive integer");
  assert.ok(Number.isInteger(limit) && limit > 0, "--limit must be a positive integer");
} else {
  assert.ok(limit == null || (Number.isInteger(limit) && limit > 0), "--limit must be a positive integer when provided");
}

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern =
  /(\/Users\/[^/\s"]+|\/Volumes\/[^/\s"]+|\/private\/[^/\s"]+|\/var\/folders\/[^/\s"]+|\/tmp\/[^/\s"]+|\/home\/[^/\s"]+|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*|memories\.jsonl|raw_events\.jsonl|lossless_context\.jsonl)/i;

const manifest = fixtureRequested ? fixtureManifest() : await liveManifest();
const serialized = format === "markdown" ? `${renderMarkdown(manifest)}\n` : `${JSON.stringify(manifest, null, 2)}\n`;
assertSafePublicText(serialized, "public benchmark slice manifest output");
if (outputPath) writeOutput(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
if (markdownOutputPath) writeOutput(markdownOutputPath, `${renderMarkdown(manifest)}\n`);
process.stdout.write(serialized);

async function liveManifest() {
  assert.equal(benchmark, "longmemeval", "only LongMemEval slice authoring is implemented");
  assert.ok(existsSync(sourceLockPath), `source lock missing: ${displayPath(sourceLockPath)}`);
  const sourceLockRaw = readFileSync(sourceLockPath, "utf8");
  assertSafePublicText(sourceLockRaw, displayPath(sourceLockPath));
  const sourceLock = JSON.parse(sourceLockRaw);
  const datasetSource = sourceLock.datasetSources?.longmemeval ?? {};
  const datasetUrl = String(args.datasetUrl ?? datasetSource.datasetUrl ?? "");
  assert.ok(requiredHttpsUrl(datasetUrl), "--dataset-url or source-lock LongMemEval dataset URL is required");
  const rawBuffer = await readDatasetBuffer(datasetUrl);
  const rawText = rawBuffer.toString("utf8");
  const datasetHash = `sha256:${stableHash(rawBuffer)}`;
  const dataset = JSON.parse(rawText);
  assert.ok(Array.isArray(dataset), "LongMemEval dataset must be a JSON array");
  const questionTypes = sourceLock.datasetSources?.longmemeval?.questionTypes ?? [
    "single-session-user",
    "single-session-assistant",
    "single-session-preference",
    "multi-session",
    "temporal-reasoning",
    "knowledge-update",
  ];
  const selected = selectSlice(dataset, questionTypes, { perType, limit, selection });
  const labelPayload = selected.map((item) => ({
    questionId: String(item.question_id),
    questionType: String(item.question_type),
    answer: String(item.answer ?? ""),
  }));
  const selectedIds = selected.map((item) => String(item.question_id));
  const typeCounts = countBy(selected, (item) => String(item.question_type));
  const scoringInputs = {
    sourceCommit: sourceLock.source?.commit,
    benchmarkContract: sourceLock.benchmarkContract,
    providerContract: sourceLock.providerContract,
    longmemevalAdapterHash: sourceLock.keyFileHashes?.["src/benchmarks/longmemeval/index.ts"],
    longmemevalTypesHash: sourceLock.keyFileHashes?.["src/benchmarks/longmemeval/types.ts"],
    benchmarkTypesHash: sourceLock.keyFileHashes?.["src/types/benchmark.ts"],
    unifiedTypesHash: sourceLock.keyFileHashes?.["src/types/unified.ts"],
  };
  const questionIdPolicy =
    selection === "full-dataset"
      ? [
          `datasetHash=${datasetHash}`,
          `types=${questionTypes.join(",")}`,
          `limit=${selected.length}`,
          "sort=question_id-ascending",
          "selection=full-dataset",
        ].join("; ")
      : [
          `datasetHash=${datasetHash}`,
          `types=${questionTypes.join(",")}`,
          `perType=${perType}`,
          `limit=${limit}`,
          "sort=question_id-ascending",
          "selection=first-per-type-round-robin",
        ].join("; ");

  return {
    schemaVersion: 1,
    mode: "public-benchmark-slice-manifest",
    fixtureOnly: false,
    benchmark: "longmemeval",
    sourceName: "MemoryBench LongMemEval-S cleaned dataset",
    sourceUrl: sourceLock.source?.repoUrl,
    sourceCommit: sourceLock.source?.commit,
    checkedAt: new Date().toISOString().slice(0, 10),
    dataset: {
      urlHost: new URL(datasetUrl).host,
      urlHash: `sha256:${stableHash(datasetUrl)}`,
      hash: datasetHash,
      byteSize: rawBuffer.byteLength,
      itemCount: dataset.length,
      selectedCount: selected.length,
      questionTypeCount: Object.keys(typeCounts).length,
      selectedQuestionIdsHash: `sha256:${stableHash(selectedIds.join("\n"))}`,
      questionIdPolicy,
      selectedTypeCounts: typeCounts,
    },
    labels: {
      answerLabelsHash: `sha256:${stableHash(canonicalJson(labelPayload))}`,
      answerLabelCount: labelPayload.length,
      answerLabelFields: ["question_id", "question_type", "answer"],
    },
    scoring: {
      scoringCodeHash: `sha256:${stableHash(canonicalJson(scoringInputs))}`,
      scoringInputsHash: `sha256:${stableHash(canonicalJson(scoringInputs))}`,
      scoringScriptRef: "MemoryBench LongMemEval adapter and benchmark contracts at the source-locked commit",
    },
    publicSafety: publicSafety(),
    nextActions: [
      "Use this manifest to author a real benchmark target with benchmark:public-target:author.",
      "Run RecallWeave on the same dataset hash and deterministic question-id policy.",
      "Attach metrics-only results before using canary-trend wording.",
    ],
  };
}

async function readDatasetBuffer(datasetUrl) {
  if (args.datasetFile) {
    const file = resolveInputPath(args.datasetFile);
    assert.ok(existsSync(file), `dataset file missing: ${displayPath(file)}`);
    assert.ok(statSync(file).isFile(), `dataset file is not a file: ${displayPath(file)}`);
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
    assert.ok(selected.length > 0, "full dataset selection did not produce any rows");
    if (options.limit != null) assert.equal(selected.length, options.limit, "full dataset selection did not match the expected limit");
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

function fixtureManifest() {
  const questionTypes = [
    "single-session-user",
    "single-session-assistant",
    "single-session-preference",
    "multi-session",
    "temporal-reasoning",
    "knowledge-update",
  ];
  return {
    schemaVersion: 1,
    mode: "public-benchmark-slice-manifest",
    fixtureOnly: true,
    benchmark: "longmemeval",
    sourceName: "fixture MemoryBench LongMemEval-S cleaned dataset",
    sourceUrl: "https://github.com/supermemoryai/memorybench",
    sourceCommit: "118209a746d97d0d85e5a7234267f0b6962857e9",
    checkedAt: "2026-05-23",
    dataset: {
      urlHost: "huggingface.co",
      urlHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      hash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      byteSize: 1024,
      itemCount: 12,
      selectedCount: 6,
      questionTypeCount: 6,
      selectedQuestionIdsHash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      questionIdPolicy: `fixture deterministic first question per type: ${questionTypes.join(",")}`,
      selectedTypeCounts: Object.fromEntries(questionTypes.map((type) => [type, 1])),
    },
    labels: {
      answerLabelsHash: "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      answerLabelCount: 6,
      answerLabelFields: ["question_id", "question_type", "answer"],
    },
    scoring: {
      scoringCodeHash: "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      scoringInputsHash: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      scoringScriptRef: "fixture MemoryBench LongMemEval adapter and benchmark contracts",
    },
    publicSafety: publicSafety(),
    nextActions: [
      "Replace fixture data with a live public dataset hash before benchmark claims.",
      "Run RecallWeave on the same deterministic question-id policy.",
    ],
  };
}

function publicSafety() {
  return {
    publicSafe: true,
    metricsOnly: true,
    rawQuestionIdsIncluded: false,
    rawQuestionsIncluded: false,
    rawAnswersIncluded: false,
    rawMemoryIncluded: false,
    rawTranscriptIncluded: false,
    printsCredentials: false,
    includesPrivatePaths: false,
  };
}

function renderMarkdown(value) {
  return [
    "# Public Benchmark Slice Manifest",
    "",
    `- Fixture only: ${value.fixtureOnly}`,
    `- Benchmark: ${value.benchmark}`,
    `- Source commit: ${value.sourceCommit}`,
    `- Dataset host: ${value.dataset.urlHost}`,
    `- Dataset hash: ${value.dataset.hash}`,
    `- Dataset items: ${value.dataset.itemCount}`,
    `- Selected count: ${value.dataset.selectedCount}`,
    `- Question type count: ${value.dataset.questionTypeCount}`,
    `- Selected id hash: ${value.dataset.selectedQuestionIdsHash}`,
    `- Answer labels hash: ${value.labels.answerLabelsHash}`,
    `- Scoring code hash: ${value.scoring.scoringCodeHash}`,
    "",
    "## Safety",
    "",
    `- Raw question ids included: ${value.publicSafety.rawQuestionIdsIncluded}`,
    `- Raw questions included: ${value.publicSafety.rawQuestionsIncluded}`,
    `- Raw answers included: ${value.publicSafety.rawAnswersIncluded}`,
    `- Raw memories included: ${value.publicSafety.rawMemoryIncluded}`,
    "",
    "## Next Actions",
    "",
    ...value.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}

function countBy(items, getKey) {
  return Object.fromEntries(
    [...items.reduce((map, item) => map.set(getKey(item), (map.get(getKey(item)) ?? 0) + 1), new Map())]
      .sort(([left], [right]) => left.localeCompare(right)),
  );
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

function normalizeBenchmarkName(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, "-").replace(/^longmemeval-s$/, "longmemeval");
}

function normalizeSelection(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  assert.ok(["first-per-type-round-robin", "full-dataset"].includes(normalized), "--selection must be first-per-type-round-robin or full-dataset");
  return normalized;
}

function requiredString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function answerPresent(value) {
  return value != null && String(value).trim().length > 0;
}

function requiredHttpsUrl(value) {
  if (!requiredString(value)) return false;
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" && Boolean(url.host);
  } catch {
    return false;
  }
}

function writeOutput(path, text) {
  const resolvedOutput = resolve(path);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  assertSafePublicText(text, displayPath(resolvedOutput));
  writeFileSync(resolvedOutput, text, { encoding: "utf8", mode: 0o600 });
}

function displayPath(value) {
  const rel = relative(root, value).replaceAll("\\", "/");
  if (!rel.startsWith("../") && rel !== "..") return rel;
  return `external:${basename(value)}`;
}

function resolveInputPath(value) {
  if (!value) return null;
  return isAbsolute(String(value)) ? String(value) : resolve(root, String(value));
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a private path or raw runtime file name`);
}

function stableHash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (!item.startsWith("--")) continue;
    const key = toCamel(item.slice(2));
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
