import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const sourceLockPath = resolveInputPath(
  args.sourceLock ??
    args.sourceLockFile ??
    process.env.RECALLWEAVE_PUBLIC_BENCHMARK_SOURCE_LOCK ??
    "reviews/overnight-20260522/public-memorybench-source-lock.json",
);
const outputPath = args.output ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_SOURCE_LOCK_REPORT_JSON ?? null;
const repoCheckoutPath = args.repoCheckout ? resolveInputPath(args.repoCheckout) : null;
const strict = Boolean(args.strict);
const format = String(args.format ?? "json").toLowerCase();

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern =
  /(\/Users\/[^/\s"]+|\/Volumes\/[^/\s"]+|\/private\/[^/\s"]+|\/var\/folders\/[^/\s"]+|\/tmp\/[^/\s"]+|\/home\/[^/\s"]+|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*|memories\.jsonl|raw_events\.jsonl|lossless_context\.jsonl)/i;
const sha256Pattern = /^sha256:[a-f0-9]{64}$/i;
const commitPattern = /^[a-f0-9]{40}$/i;
const requiredBenchmarks = ["locomo", "longmemeval", "convomem"];
const requiredProviderMethods = ["initialize", "ingest", "awaitIndexing", "search", "clear"];
const requiredBenchmarkMethods = ["load", "getQuestions", "getHaystackSessions", "getGroundTruth", "getQuestionTypes"];
const requiredKeyFiles = [
  "README.md",
  "package.json",
  "src/benchmarks/README.md",
  "src/benchmarks/index.ts",
  "src/benchmarks/longmemeval/index.ts",
  "src/benchmarks/longmemeval/types.ts",
  "src/benchmarks/locomo/index.ts",
  "src/benchmarks/locomo/types.ts",
  "src/benchmarks/convomem/index.ts",
  "src/benchmarks/convomem/types.ts",
  "src/providers/README.md",
  "src/types/provider.ts",
  "src/types/benchmark.ts",
  "src/types/unified.ts",
  "src/utils/config.ts",
];

assert.ok(existsSync(sourceLockPath), `source lock missing: ${displayPath(sourceLockPath)}`);
const raw = readFileSync(sourceLockPath, "utf8");
assertSafePublicText(raw, displayPath(sourceLockPath));
const sourceLock = JSON.parse(raw);
const checks = inspectSourceLock(sourceLock);
const checkoutVerification = verifyCheckout(sourceLock, repoCheckoutPath);
if (checkoutVerification.requested) {
  checks.push(check("repo-checkout-verification", checkoutVerification.ok));
}
const failedChecks = checks.filter((check) => !check.ok).map((check) => check.name);
const ok = failedChecks.length === 0;

const report = {
  ok,
  mode: "public-benchmark-source-lock-check",
  schemaVersion: 1,
  writesRealFiles: Boolean(outputPath),
  metricsOnly: true,
  publicSafe: true,
  rawQuestionIdsIncluded: false,
  rawLabelsIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  publicBenchmarkClaimsAllowed: false,
  sourceLockReadyForTargetAuthoring: ok,
  sourceSummary: {
    name: safeText(sourceLock.source?.name),
    repoHost: urlHost(sourceLock.source?.repoUrl),
    branch: safeText(sourceLock.source?.branch),
    commit: safeText(sourceLock.source?.commit),
    checkedAt: safeText(sourceLock.checkedAt),
    availableBenchmarks: requiredBenchmarks.filter((name) => sourceLock.availableBenchmarks?.includes(name)),
    datasetSourceCount: Object.keys(sourceLock.datasetSources ?? {}).length,
    keyFileHashCount: Object.keys(sourceLock.keyFileHashes ?? {}).length,
  },
  hashes: {
    sourceLockFileHash: `sha256:${stableHash(raw)}`,
    commitHash: sourceLock.source?.commit ? `sha256:${stableHash(sourceLock.source.commit).slice(0, 16)}` : null,
  },
  checks,
  failedChecks,
  checkoutVerification,
  nextActions: ok
    ? [
        "Materialize the selected public dataset slice.",
        "Hash the answer label source and exact scoring script.",
        "Create a target with benchmark:public-target:author.",
        "Validate the target with benchmark:public-target --strict before running RecallWeave.",
      ]
    : [
        `Fix failed source-lock checks: ${failedChecks.join(", ")}.`,
        "Do not author a public benchmark target from this source lock until all checks pass.",
      ],
  safety: {
    printsCredentials: false,
    includesPrivatePaths: false,
    includesRawQuestionIds: false,
    includesRawLabels: false,
    includesRawMemoryText: false,
    includesRawTranscriptText: false,
  },
};

const serialized = format === "markdown" ? `${renderMarkdown(report)}\n` : `${JSON.stringify(report, null, 2)}\n`;
assertSafePublicText(serialized, "public benchmark source lock report");
if (outputPath) {
  const resolvedOutput = resolve(outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, serialized, { encoding: "utf8", mode: 0o600 });
}
process.stdout.write(serialized);
if (strict && !ok) process.exit(1);

function inspectSourceLock(value) {
  const checks = [];
  const source = value.source ?? {};
  const datasetSources = value.datasetSources ?? {};
  const keyFileHashes = value.keyFileHashes ?? {};
  checks.push(check("schema-version", value.schemaVersion === 1));
  checks.push(check("public-safe", value.publicSafe === true && value.metricsOnly === true));
  checks.push(check("no-raw-private-data", value.rawQuestionIdsIncluded === false && value.rawLabelsIncluded === false && value.rawMemoryIncluded === false && value.rawTranscriptIncluded === false));
  checks.push(check("checked-date", requiredDate(value.checkedAt)));
  checks.push(check("repo-url", requiredHttpsUrl(source.repoUrl)));
  checks.push(check("repo-commit", commitPattern.test(String(source.commit ?? ""))));
  checks.push(check("repo-branch", requiredString(source.branch)));
  checks.push(check("license", String(source.license ?? "").toUpperCase() === "MIT"));
  checks.push(check("required-benchmarks", requiredBenchmarks.every((name) => value.availableBenchmarks?.includes(name))));
  checks.push(check("benchmark-contract-methods", requiredBenchmarkMethods.every((method) => value.benchmarkContract?.methods?.includes(method))));
  checks.push(check("provider-contract-methods", requiredProviderMethods.every((method) => value.providerContract?.methods?.includes(method))));
  checks.push(check("memscore-components", ["quality", "latencyMs", "contextTokens"].every((name) => value.cli?.memScoreComponents?.includes(name))));
  checks.push(check("pipeline", ["ingest", "index", "search", "answer", "evaluate", "report"].every((name) => value.cli?.pipeline?.includes(name))));
  checks.push(check("key-file-hashes", requiredKeyFiles.every((file) => sha256Pattern.test(String(keyFileHashes[file] ?? "")))));
  for (const benchmark of requiredBenchmarks) {
    const dataset = datasetSources[benchmark] ?? {};
    checks.push(check(`${benchmark}-dataset-url`, requiredHttpsUrl(dataset.datasetUrl)));
    checks.push(check(`${benchmark}-source-file`, requiredString(dataset.sourceFile) && String(dataset.sourceFile).startsWith("src/benchmarks/")));
    checks.push(check(`${benchmark}-question-types`, Array.isArray(dataset.questionTypes) && dataset.questionTypes.length >= 5));
  }
  checks.push(check("next-target-recommendation", value.nextTargetRecommendation?.benchmark === "longmemeval" && requiredString(value.nextTargetRecommendation?.sourceLockNote)));
  return checks;
}

function verifyCheckout(value, checkoutPath) {
  if (!checkoutPath) {
    return {
      requested: false,
      ok: null,
      commitMatches: null,
      requiredFileCount: requiredKeyFiles.length,
      checkedFileCount: 0,
      failedFileCount: 0,
    };
  }

  const emptyFailure = {
    requested: true,
    ok: false,
    commitMatches: null,
    requiredFileCount: requiredKeyFiles.length,
    checkedFileCount: 0,
    failedFileCount: requiredKeyFiles.length,
  };

  try {
    if (!existsSync(checkoutPath) || !statSync(checkoutPath).isDirectory()) return emptyFailure;
  } catch {
    return emptyFailure;
  }

  const head = spawnSync("git", ["-C", checkoutPath, "rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const commitMatches = head.status === 0 && head.stdout.trim() === value.source?.commit;
  const keyFileHashes = value.keyFileHashes ?? {};
  let checkedFileCount = 0;
  let failedFileCount = commitMatches ? 0 : 1;

  for (const file of requiredKeyFiles) {
    try {
      const actual = `sha256:${stableHash(readFileSync(join(checkoutPath, file)))}`;
      checkedFileCount += 1;
      if (actual !== keyFileHashes[file]) failedFileCount += 1;
    } catch {
      failedFileCount += 1;
    }
  }

  return {
    requested: true,
    ok: commitMatches && checkedFileCount === requiredKeyFiles.length && failedFileCount === 0,
    commitMatches,
    requiredFileCount: requiredKeyFiles.length,
    checkedFileCount,
    failedFileCount,
  };
}

function check(name, ok) {
  return { name, ok: Boolean(ok) };
}

function renderMarkdown(report) {
  return [
    "# Public Benchmark Source Lock Check",
    "",
    `- OK: ${report.ok}`,
    `- Source: ${report.sourceSummary.name}`,
    `- Repo host: ${report.sourceSummary.repoHost}`,
    `- Commit: ${report.sourceSummary.commit}`,
    `- Checkout verified: ${report.checkoutVerification.requested ? report.checkoutVerification.ok : "not requested"}`,
    `- Benchmarks: ${report.sourceSummary.availableBenchmarks.join(", ")}`,
    `- Ready for target authoring: ${report.sourceLockReadyForTargetAuthoring}`,
    `- Failed checks: ${report.failedChecks.length === 0 ? "none" : report.failedChecks.join(", ")}`,
    "",
    "## Next Actions",
    "",
    ...report.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}

function requiredString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function requiredDate(value) {
  return requiredString(value) && /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim()) && !Number.isNaN(Date.parse(String(value)));
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

function safeText(value) {
  return String(value ?? "").replace(privatePathPattern, "[redacted-path]").replace(secretPattern, "[redacted-secret]");
}

function urlHost(value) {
  try {
    return new URL(String(value)).host;
  } catch {
    return "";
  }
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
