import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const reviewDir = String(args.reviewDir ?? process.env.RECALLWEAVE_REVIEW_DIR ?? "reviews/overnight-20260522");
const sourceLockPath = resolveInputPath(args.sourceLock ?? `${reviewDir}/agentic-memory-source-lock-live-20260529.json`);
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();
const strict = Boolean(args.strict);

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,}|sk-or-v1-[A-Za-z0-9_-]{20,})/;
const privatePathPattern =
  /(\/Users\/[^/\s"]+|\/Volumes\/[^/\s"]+|\/private\/[^/\s"]+|\/var\/folders\/[^/\s"]+|\/tmp\/[^/\s"]+|\/home\/[^/\s"]+|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*|memories\.jsonl|raw_events\.jsonl|lossless_context\.jsonl)/i;

const officialRunContract = {
  tier: "small",
  tierReason:
    "Use LME-V2-Small for the first materialized official-comparable run because it is a supported public tier and the lower-resource tier for the M5 24GB lane; Medium stays a follow-up once Small is stable.",
  readerModel: "Qwen/Qwen3.5-9B",
  judgeModel: "gpt-5.2",
  judgeReason:
    "The released runner defaults to gpt-5.2 and the leaderboard package validator requires evaluator model names to contain gpt-5.2.",
  readerReason:
    "The released runner defaults to Qwen/Qwen3.5-9B and the leaderboard package validator requires reader model names to contain qwen3.5-9b.",
  codexActorLane:
    "Codex GPT-5.5 may be used as an internal memory-controller or actor lane, but a Codex-reader run is not leaderboard-comparable unless the official model contract changes.",
  referenceFrontier: {
    source: "LongMemEval-V2 leaderboard fixed reference frontier",
    metric: "LAFS gain",
    tier: "small",
    tMinSeconds: 1,
    tMaxSeconds: 200,
    points: [
      { name: "RAG: query -> slice + notes", accuracyPercent: 51.0, latencySeconds: 0.2 },
      { name: "Codex", accuracyPercent: 69.9, latencySeconds: 177.2 },
      { name: "AgentRunbook-R", accuracyPercent: 58.6, latencySeconds: 26.9 },
      { name: "AgentRunbook-C", accuracyPercent: 74.9, latencySeconds: 108.3 },
    ],
  },
  sourceUrls: {
    repositoryReadme: "https://github.com/xiaowu0162/LongMemEval-V2",
    leaderboardReadme: "https://github.com/xiaowu0162/LongMemEval-V2/tree/main/leaderboard",
    websiteLeaderboard: "https://xiaowu0162.github.io/longmemeval-v2/#leaderboard",
  },
};

const sourceLock = loadSourceLock(sourceLockPath);
const report = buildReport({ sourceLock, contract: officialRunContract });
const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "agentic source-lock decision");
assertSafePublicText(markdownText, "agentic source-lock decision markdown");
if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (strict) {
  assert.equal(report.ok, true, jsonText);
  assert.equal(report.publicSafe, true, jsonText);
  assert.equal(report.metricsOnly, true, jsonText);
  assert.equal(report.countsAsBenchmarkScore, false, jsonText);
  assert.equal(report.sourceLockArguments.tier, "small");
  assert.equal(report.sourceLockArguments.readerModel, "Qwen/Qwen3.5-9B");
  assert.equal(report.sourceLockArguments.judgeModel, "gpt-5.2");
  assert.match(report.sourceLockArguments.leaderboardRowHash, /^sha256:[a-f0-9]{64}$/);
}

function loadSourceLock(path) {
  assert.ok(existsSync(path), `source lock missing: ${path}`);
  const text = readFileSync(path, "utf8");
  assertSafePublicText(text, "agentic source-lock input");
  return JSON.parse(text);
}

function buildReport({ sourceLock, contract }) {
  const leaderboardRowHash = `sha256:${stableHash(canonicalJson(contract.referenceFrontier))}`;
  const sourceProof = {
    repoCommit: sourceLock.liveSourceSnapshot?.repoCommit ?? null,
    datasetRevision: sourceLock.liveSourceSnapshot?.datasetRevision ?? null,
    questionIdsHash: sourceLock.liveSourceSnapshot?.questionIdsHash ?? null,
    answerLabelsHash: sourceLock.liveSourceSnapshot?.answerLabelsHash ?? null,
    scoringCodeHash: sourceLock.liveSourceSnapshot?.scoringCodeHash ?? null,
    trajectoryIngestContractHash:
      sourceLock.proofChecks?.find((item) => item.field === "trajectoryIngestContractHash")?.provided === true,
  };
  const checks = [
    check("source-lock-live", sourceLock.liveChecksRequested === true && sourceLock.liveSourceSnapshot?.ok === true),
    check("question-count", Number(sourceLock.liveSourceSnapshot?.questionCount ?? 0) === 451),
    check("source-proofs-present", Object.values(sourceProof).every(Boolean)),
    check("tier-supported", ["small", "medium"].includes(contract.tier)),
    check("official-reader-model", /qwen\/qwen3\.5-9b/i.test(contract.readerModel)),
    check("official-judge-model", /^gpt-5\.2$/i.test(contract.judgeModel)),
    check("reference-frontier-pinned", contract.referenceFrontier.points.length === 4),
  ];
  const failedChecks = checks.filter((item) => !item.ok).map((item) => item.name);
  return {
    schemaVersion: 1,
    ok: failedChecks.length === 0,
    mode: "agentic-memory-source-lock-decision",
    generatedAt: new Date().toISOString(),
    writesRealFiles: Boolean(outputPath || markdownOutputPath),
    metricsOnly: true,
    publicSafe: true,
    countsAsBenchmarkScore: false,
    publicBenchmarkClaimsAllowed: false,
    callsProviderApis: false,
    sendsBenchmarkTextToProvider: false,
    rawQuestionIdsIncluded: false,
    rawQuestionsIncluded: false,
    rawAnswersIncluded: false,
    rawMemoryIncluded: false,
    rawTranscriptIncluded: false,
    sourceLockTarget: {
      id: sourceLock.target?.id ?? "longmemeval-v2",
      name: sourceLock.target?.name ?? "LongMemEval-V2",
      questionCount: sourceLock.liveSourceSnapshot?.questionCount ?? null,
      existingSourceLockReady: Boolean(sourceLock.sourceLockReadyForMaterialization),
    },
    officialRunContract: contract,
    sourceProof,
    checks,
    failedChecks,
    sourceLockArguments: {
      tier: contract.tier,
      leaderboardRowHash,
      readerModel: contract.readerModel,
      judgeModel: contract.judgeModel,
    },
    sourceLockCommandTemplate: [
      "benchmark:agentic-source-lock -- --live",
      "--tier small",
      `--leaderboard-row-hash ${leaderboardRowHash}`,
      "--reader-model Qwen/Qwen3.5-9B",
      "--judge-model gpt-5.2",
      "--ingest-contract-hash <agentic-ingest-contract-hash>",
    ].join(" "),
    nextActions: [
      "Regenerate the live source-lock packet with these four decision fields.",
      "Keep Codex GPT-5.5 as a separate internal actor/controller lane unless the official leaderboard model contract changes.",
      "Start official-comparable materialization only after the regenerated source-lock says sourceLockReadyForMaterialization=true.",
    ],
  };
}

function renderMarkdown(report) {
  return [
    "# Agentic Memory Source-Lock Decision",
    "",
    `- OK: ${report.ok}`,
    `- Tier: ${report.sourceLockArguments.tier}`,
    `- Reader model: ${report.sourceLockArguments.readerModel}`,
    `- Judge model: ${report.sourceLockArguments.judgeModel}`,
    `- Leaderboard row hash: ${report.sourceLockArguments.leaderboardRowHash}`,
    `- Counts as benchmark score: ${report.countsAsBenchmarkScore}`,
    "",
    "## Boundary",
    "",
    `- ${report.officialRunContract.codexActorLane}`,
    "",
    "## Next Actions",
    "",
    ...report.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (!item.startsWith("--")) continue;
    const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function resolveInputPath(value) {
  return isAbsolute(String(value ?? "")) ? String(value) : resolve(root, String(value ?? ""));
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
}

function canonicalJson(value) {
  return JSON.stringify(sortCanonical(value));
}

function sortCanonical(value) {
  if (Array.isArray(value)) return value.map((item) => sortCanonical(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortCanonical(value[key])]));
}

function stableHash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function check(name, ok) {
  return { name, ok: Boolean(ok) };
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(String(text), secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(String(text), privatePathPattern, `${label} contains a private path`);
}
