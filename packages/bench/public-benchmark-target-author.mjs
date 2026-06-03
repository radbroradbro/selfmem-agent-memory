import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const fixtureRequested = Boolean(args.fixture) || (!args.benchmark && !args.output && !args.sliceManifest);
const format = String(args.format ?? "json").toLowerCase();
const outputPath = args.output ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_TARGET_OUTPUT ?? null;
const today = new Date().toISOString().slice(0, 10);

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern =
  /(\/Users\/[^/\s"]+|\/Volumes\/[^/\s"]+|\/private\/[^/\s"]+|\/var\/folders\/[^/\s"]+|\/tmp\/[^/\s"]+|\/home\/[^/\s"]+|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*|memories\.jsonl|raw_events\.jsonl|lossless_context\.jsonl)/i;
const sha256Pattern = /^sha256:[a-f0-9]{64}$/i;

const defaultMetrics = [
  "quality",
  "pAt1",
  "recallAt5",
  "recallAt10",
  "ndcgAt10",
  "latencyP50Ms",
  "latencyP95Ms",
  "contextTokensAvg",
  "queryCostUsdAvg",
];

const target = fixtureRequested ? fixtureTarget() : realTargetFromArgs(args);
const serialized = format === "markdown" ? `${renderMarkdown(target)}\n` : `${JSON.stringify(target, null, 2)}\n`;
assertSafePublicText(serialized, "public benchmark target author output");

if (outputPath) {
  const resolvedOutput = resolve(outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, serialized, { encoding: "utf8", mode: 0o600 });
}

process.stdout.write(serialized);

function realTargetFromArgs(options) {
  const sliceManifest = options.sliceManifest ? readSliceManifest(options.sliceManifest) : null;
  const benchmarkFamily = normalizeBenchmarkName(options.benchmark ?? sliceManifest?.benchmark);
  assert.ok(requiredString(benchmarkFamily), "--benchmark or --slice-manifest is required");
  const benchmarkName = options.benchmarkName ?? displayBenchmarkName(benchmarkFamily);
  const checkedAt = options.checkedAt ?? sliceManifest?.checkedAt ?? today;
  const reportedCheckedAt = options.reportedCheckedAt ?? checkedAt;
  const questionIds = readQuestionIds(options);
  const questionIdPolicy = options.questionIdPolicy ?? sliceManifest?.dataset?.questionIdPolicy;
  assert.ok(questionIds.length > 0 || requiredString(questionIdPolicy), "--question-ids, --question-ids-file, or --question-id-policy is required");

  const answerLabelsHash = hashInput({
    hash: options.answerLabelsHash,
    path: options.answerLabelsFile,
    fallbackHash: sliceManifest?.labels?.answerLabelsHash,
    label: "--answer-labels-hash or --answer-labels-file",
  });
  const scoringCodeHash = hashInput({
    hash: options.scoringCodeHash,
    path: options.scoringPath,
    fallbackHash: sliceManifest?.scoring?.scoringCodeHash,
    label: "--scoring-code-hash or --scoring-path",
  });
  const answerLabelsRef =
    options.answerLabelsRef ??
    (sliceManifest ? `${sliceManifest.sourceName ?? "public benchmark"} selected answer labels hash` : safeBasename(options.answerLabelsFile));
  const scoringScriptRef = options.scoringScriptRef ?? sliceManifest?.scoring?.scoringScriptRef ?? safeBasename(options.scoringPath);

  const judgeModel = requiredOption(options.judgeModel, "--judge-model");
  const answerModel = requiredOption(options.answerModel, "--answer-model");
  const sourceLockNote =
    options.sourceLockNote ??
    (sliceManifest ? sourceLockNoteFromManifest(sliceManifest) : requiredOption(options.sourceLockNote, "--source-lock-note"));
  const metrics = listOption(options.metrics, defaultMetrics);
  const claimTier = options.claimTier ?? "canary-trend";
  const allowMissingReportedTarget = claimTier === "run-only" || Boolean(options.allowMissingReportedTarget);
  const reportedScore = options.reportedScore === undefined ? null : Number(requiredOption(options.reportedScore, "--reported-score"));
  if (!allowMissingReportedTarget || options.reportedScore !== undefined) {
    assert.ok(Number.isFinite(reportedScore), "--reported-score must be a finite number");
  }
  const reportedTokenBudget = options.reportedTokenBudget ? Number(options.reportedTokenBudget) : null;
  if (options.reportedTokenBudget) assert.ok(Number.isFinite(reportedTokenBudget), "--reported-token-budget must be a finite number");
  const targetId =
    options.targetId ??
    `${benchmarkFamily}-${slug(options.split ?? splitFromManifest(sliceManifest) ?? "split")}-${slug(checkedAt)}-${shortHash([
      options.datasetRevision ?? datasetRevisionFromManifest(sliceManifest),
      options.split ?? splitFromManifest(sliceManifest),
      judgeModel,
      answerModel,
      questionIds.join(","),
      questionIdPolicy ?? "",
      scoringCodeHash,
    ].join("|"))}`;

  return {
    schemaVersion: 1,
    fixtureOnly: false,
    targetId,
    benchmarkType: "memory",
    claimTier,
    benchmark: {
      name: benchmarkName,
      family: benchmarkFamily,
      sourceUrl: requiredOption(options.sourceUrl ?? sliceManifest?.sourceUrl, "--source-url or --slice-manifest sourceUrl"),
      checkedAt,
      datasetRevision: requiredOption(options.datasetRevision ?? datasetRevisionFromManifest(sliceManifest), "--dataset-revision or --slice-manifest dataset hash"),
      split: requiredOption(options.split ?? splitFromManifest(sliceManifest), "--split or --slice-manifest selected-count policy"),
      judgeModel,
      answerModel,
      ...(questionIds.length > 0 ? { questionIds } : { questionIdPolicy }),
      answerLabelsRef: requiredOption(answerLabelsRef, "--answer-labels-ref or --answer-labels-file"),
      answerLabelsHash,
      judgeRule: requiredOption(options.judgeRule, "--judge-rule"),
      scoringScriptRef: requiredOption(scoringScriptRef, "--scoring-script-ref or --scoring-path"),
      scoringCodeHash,
      metrics,
    },
    sourceLock: {
      authorTool: "benchmark:public-target:author",
      checkedAt,
      sameDataAttestation: sourceLockNote,
    },
    ...(allowMissingReportedTarget && !options.reportedSourceName
      ? { reportedTarget: { pending: true, caveat: "Run-only target. Attach a source-locked reported target row before comparison claims." } }
      : {
          reportedTarget: {
            sourceName: requiredOption(options.reportedSourceName, "--reported-source-name"),
            sourceUrl: requiredOption(options.reportedSourceUrl, "--reported-source-url"),
            checkedAt: reportedCheckedAt,
            metricName: requiredOption(options.reportedMetricName, "--reported-metric-name"),
            score: reportedScore,
            judgeModel,
            answerModel,
            ...(options.reportedTokenBudget
              ? { tokenBudget: reportedTokenBudget }
              : { tokenBudgetReported: false }),
            caveat: requiredOption(options.reportedCaveat, "--reported-caveat"),
          },
        }),
    comparability: {
      metricDefinitionsMatch: true,
      sameDatasetSource: true,
      sameDatasetRevision: true,
      sameSplit: true,
      sameLabels: true,
      sameJudgeRule: true,
      sameScoringCode: true,
    },
    componentEvidence: readComponentEvidence(options.componentEvidenceFile),
    fullComparableBenchmarkCount: Number(options.fullComparableBenchmarkCount ?? 0),
  };
}

function fixtureTarget() {
  return JSON.parse(readFileSync(resolve(root, "packages/bench/fixtures/public-benchmark-target.fixture.json"), "utf8"));
}

function readSliceManifest(inputPath) {
  const file = resolveInputPath(inputPath);
  assert.ok(existsSync(file), `slice manifest missing: ${displayPath(file)}`);
  const raw = readFileSync(file, "utf8");
  assertSafePublicText(raw, "slice manifest");
  const parsed = JSON.parse(raw);
  assert.equal(parsed.mode, "public-benchmark-slice-manifest", "slice manifest must come from benchmark:public-slice");
  assert.equal(parsed.publicSafety?.publicSafe, true, "slice manifest must be public safe");
  assert.equal(parsed.publicSafety?.rawQuestionIdsIncluded, false, "slice manifest must not include raw question ids");
  assert.equal(parsed.publicSafety?.rawQuestionsIncluded, false, "slice manifest must not include raw questions");
  assert.equal(parsed.publicSafety?.rawAnswersIncluded, false, "slice manifest must not include raw answers");
  return parsed;
}

function readQuestionIds(options) {
  const ids = [];
  if (options.questionIds) ids.push(...splitList(options.questionIds));
  if (options.questionIdsFile) {
    const file = resolveInputPath(options.questionIdsFile);
    assert.ok(existsSync(file), `question id file missing: ${displayPath(file)}`);
    const raw = readFileSync(file, "utf8");
    assertSafePublicText(raw, "question id file");
    const trimmed = raw.trim();
    if (trimmed.startsWith("[")) {
      const parsed = JSON.parse(trimmed);
      assert.ok(Array.isArray(parsed), "question id JSON file must be an array");
      ids.push(...parsed.map((item) => String(item)));
    } else {
      ids.push(...trimmed.split(/[\r\n,]+/));
    }
  }
  return [...new Set(ids.map((item) => String(item).trim()).filter(Boolean))];
}

function readComponentEvidence(inputPath) {
  if (!inputPath) return [];
  const file = resolveInputPath(inputPath);
  assert.ok(existsSync(file), `component evidence file missing: ${displayPath(file)}`);
  const raw = readFileSync(file, "utf8");
  assertSafePublicText(raw, "component evidence file");
  const parsed = JSON.parse(raw);
  assert.ok(Array.isArray(parsed), "component evidence file must be a JSON array");
  for (const item of parsed) {
    assert.ok(
      ["model-selection-only", "component-evidence-only"].includes(String(item?.claimUse ?? item?.claimUsage ?? "")),
      "component evidence must be model-selection-only or component-evidence-only",
    );
  }
  return parsed;
}

function hashInput({ hash, path, fallbackHash, label }) {
  if (hash) {
    const normalized = normalizeHash(hash);
    assert.ok(sha256Pattern.test(normalized), `${label} must be a sha256 hash`);
    return normalized;
  }
  if (path) return `sha256:${hashPath(resolveInputPath(path))}`;
  if (fallbackHash) {
    const normalized = normalizeHash(fallbackHash);
    assert.ok(sha256Pattern.test(normalized), `${label} fallback must be a sha256 hash`);
    return normalized;
  }
  throw new Error(`${label} is required`);
}

function hashPath(inputPath) {
  assert.ok(existsSync(inputPath), `hash input missing: ${displayPath(inputPath)}`);
  const info = statSync(inputPath);
  const hasher = createHash("sha256");
  if (info.isDirectory()) {
    const files = listFiles(inputPath);
    assert.ok(files.length > 0, `hash directory has no files: ${displayPath(inputPath)}`);
    for (const file of files) {
      const rel = relative(inputPath, file).replaceAll("\\", "/");
      hasher.update(rel);
      hasher.update("\0");
      hasher.update(readFileSync(file));
      hasher.update("\0");
    }
  } else {
    hasher.update(readFileSync(inputPath));
  }
  return hasher.digest("hex");
}

function listFiles(dir) {
  const entries = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "node_modules", ".venv", "__pycache__"].includes(entry.name)) continue;
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) entries.push(...listFiles(full));
    else if (entry.isFile()) entries.push(full);
  }
  return entries.sort();
}

function renderMarkdown(value) {
  const usesPolicy = Boolean(value.benchmark?.questionIdPolicy) && !Array.isArray(value.benchmark?.questionIds);
  const validationFlag = value.claimTier === "run-only" ? "--strict-run" : "--strict";
  return [
    "# Public Benchmark Target",
    "",
    `- Fixture only: ${value.fixtureOnly === true}`,
    `- Target id: ${value.targetId}`,
    `- Benchmark: ${value.benchmark?.name}`,
    `- Family: ${value.benchmark?.family}`,
    `- Claim tier: ${value.claimTier}`,
    `- Question selector: ${usesPolicy ? "deterministic policy" : `${value.benchmark?.questionIds?.length ?? 0} explicit ids`}`,
    `- Reported source: ${value.reportedTarget?.sourceName ?? "pending"}`,
    `- Reported metric: ${value.reportedTarget?.metricName ?? "pending"}`,
    `- Reported score: ${value.reportedTarget?.score ?? "pending"}`,
    "",
    "Run this through:",
    "",
    "```bash",
    `npm exec --yes pnpm@10.23.0 -- benchmark:public-target -- --target <target.json> ${validationFlag}`,
    "```",
  ].join("\n");
}

function requiredOption(value, name) {
  assert.ok(requiredString(value), `${name} is required`);
  return String(value).trim();
}

function requiredString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function listOption(value, fallback) {
  const list = value ? splitList(value) : fallback;
  assert.ok(list.length > 0, "list option must not be empty");
  return list;
}

function splitList(value) {
  return String(value)
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeHash(value) {
  const text = String(value).trim();
  return text.startsWith("sha256:") ? text : `sha256:${text}`;
}

function normalizeBenchmarkName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/^longmemeval-s$/, "longmemeval")
    .replace(/^longmemeval-v1$/, "longmemeval")
    .replace(/^convomem-benchmark$/, "convomem");
}

function displayBenchmarkName(family) {
  const names = {
    memorybench: "MemoryBench",
    longmemeval: "LongMemEval",
    "longmemeval-v2": "LongMemEval-V2",
    locomo: "LoCoMo",
    convomem: "ConvoMem",
    beam: "BEAM",
  };
  return names[family] ?? family;
}

function safeBasename(value) {
  return value ? basename(String(value)) : "";
}

function datasetRevisionFromManifest(manifest) {
  if (!manifest) return "";
  const parts = [];
  if (manifest.sourceCommit) parts.push(`memorybench:${manifest.sourceCommit}`);
  if (manifest.dataset?.hash) parts.push(`dataset:${manifest.dataset.hash}`);
  return parts.join(";");
}

function splitFromManifest(manifest) {
  if (!manifest) return "";
  const count = manifest.dataset?.selectedCount;
  const checkedAt = manifest.checkedAt;
  if (String(manifest.dataset?.questionIdPolicy ?? "").includes("selection=full-dataset")) {
    return `longmemeval-s-cleaned-full-${count ?? "unknown"}-${checkedAt ?? "undated"}`;
  }
  return `longmemeval-s-cleaned-canary-${count ?? "unknown"}-first-per-type-${checkedAt ?? "undated"}`;
}

function sourceLockNoteFromManifest(manifest) {
  if (!manifest) return "";
  return [
    `same public ${manifest.benchmark} data source is locked by ${manifest.sourceName ?? "source manifest"}`,
    `MemoryBench commit ${manifest.sourceCommit ?? "unknown"}`,
    `dataset hash ${manifest.dataset?.hash ?? "unknown"}`,
    `selected-id policy hash ${manifest.dataset?.selectedQuestionIdsHash ?? "unknown"}`,
    `answer-label hash ${manifest.labels?.answerLabelsHash ?? "unknown"}`,
    `scoring-code hash ${manifest.scoring?.scoringCodeHash ?? "unknown"}`,
  ].join("; ");
}

function slug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function displayPath(value) {
  const rel = relative(root, value).replaceAll("\\", "/");
  if (!rel.startsWith("../") && rel !== "..") return rel;
  return `external:${basename(value)}`;
}

function resolveInputPath(value) {
  return isAbsolute(String(value)) ? String(value) : resolve(root, String(value));
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a private path or raw runtime file name`);
}

function stableHash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function shortHash(value) {
  return stableHash(String(value)).slice(0, 16);
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
