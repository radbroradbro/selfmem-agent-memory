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

const sourceLock = loadSourceLock(sourceLockPath);
const report = buildReport(sourceLock);
const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "agentic provider autoresearch plan");
assertSafePublicText(markdownText, "agentic provider autoresearch plan markdown");
if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (strict) {
  assert.equal(report.ok, true, jsonText);
  assert.equal(report.publicSafe, true, jsonText);
  assert.equal(report.metricsOnly, true, jsonText);
  assert.equal(report.callsProviderApis, false, jsonText);
  assert.equal(report.sendsBenchmarkTextToProvider, false, jsonText);
  assert.equal(report.cloudDefaultForPersonalUse, "cloud-voyage4-voyage");
  assert.equal(report.methodologyDefault, "local-apple-controlled-lanes");
}

function loadSourceLock(path) {
  assert.ok(existsSync(path), `source lock missing: ${path}`);
  const text = readFileSync(path, "utf8");
  assertSafePublicText(text, "agentic source lock input");
  return JSON.parse(text);
}

function buildReport(lock) {
  const blockers = arrayOf(lock.blockersBeforeRun);
  const questionCount = Number(lock.liveSourceSnapshot?.questionCount ?? lock.target?.expectedPublicShape?.questionCount ?? 0);
  const sourceLockProof = {
    repoCommit: proofProvided(lock, "repoCommit"),
    datasetRevision: proofProvided(lock, "datasetRevision"),
    questionIdsHash: proofProvided(lock, "questionIdsHash"),
    answerLabelsHash: proofProvided(lock, "answerLabelsHash"),
    scoringCodeHash: proofProvided(lock, "scoringCodeHash"),
    trajectoryIngestContractHash: proofProvided(lock, "trajectoryIngestContractHash"),
    leaderboardTier: proofProvided(lock, "leaderboardTier"),
    leaderboardRowHash: proofProvided(lock, "leaderboardRowHash"),
    readerModel: proofProvided(lock, "readerModel"),
    judgeModel: proofProvided(lock, "judgeModel"),
  };
  const missingBeforeFullRun = Object.entries(sourceLockProof)
    .filter(([, provided]) => !provided)
    .map(([field]) => `missing-${field}`);
  const providerMatrix = buildProviderMatrix();
  const phases = [
    {
      id: "source-lock-closeout",
      status: missingBeforeFullRun.length ? "blocked" : "ready",
      purpose: "Pin the exact LongMemEval-V2 tier, comparable row, reader model, and judge/scorer before any public-comparable run.",
      requiredBeforeProviderSpend: true,
      blockers: missingBeforeFullRun,
    },
    {
      id: "local-method-refinement",
      status: "ready",
      purpose: "Use local Apple lanes to refine chunking, topic/subtopic amplification, query expansion gates, and hybrid retrieval without spending provider quota.",
      arms: [
        "bm25-lite",
        "full-hybrid-rerank",
        "query-expanded-full-hybrid-rerank",
        "wiki-title-amplified-hybrid",
        "wiki-subtopic-amplified-hybrid",
        "wiki-summary-session-hybrid",
        "local-apple-qwen3-0_6b",
        "local-apple-qwen3-0_6b-local-rerank",
        "local-apple-qwen3-4b",
        "local-apple-qwen3-4b-local-rerank",
      ],
    },
    {
      id: "cloud-challenger-run",
      status: missingBeforeFullRun.length ? "blocked-until-source-lock-ready" : "ready",
      purpose: "Run the best local method against controlled NVIDIA, Gemini, and Voyage challengers on the same source-locked rows.",
      arms: providerMatrix.map((item) => item.harnessArm),
      requiredBeforeProviderSpend: true,
      blockers: missingBeforeFullRun,
    },
    {
      id: "answer-quality-and-review",
      status: missingBeforeFullRun.length ? "blocked-until-source-lock-ready" : "ready",
      purpose: "Use Codex GPT-5.5 as the reader/actor when declared, then score with the official scorer or the declared judge model and attach reviewer intake.",
      readerModel: "codex-gpt-5.5",
      judgePolicy:
        "Prefer the benchmark official scorer when available; use deepseek-v4-pro only as the declared judge/reviewer lane when the scoring contract permits LLM judging.",
    },
  ];

  return {
    schemaVersion: 1,
    ok: true,
    mode: "agentic-memory-provider-autoresearch-plan",
    generatedAt: new Date().toISOString(),
    metricsOnly: true,
    publicSafe: true,
    callsProviderApis: false,
    sendsBenchmarkTextToProvider: false,
    writesRealFiles: Boolean(outputPath || markdownOutputPath),
    rawQuestionIdsIncluded: false,
    rawQuestionsIncluded: false,
    rawAnswersIncluded: false,
    rawMemoryIncluded: false,
    rawTranscriptIncluded: false,
    target: {
      id: lock.target?.id ?? "longmemeval-v2",
      name: lock.target?.name ?? "LongMemEval-V2",
      sourceLockHash: `sha256:${stableHash(JSON.stringify(lock.proofChecks ?? []))}`,
      questionCount,
      sourceLockReadyForMaterialization: Boolean(lock.sourceLockReadyForMaterialization),
      sourceLockReadyForPublicClaim: Boolean(lock.sourceLockReadyForPublicClaim),
      remainingSourceLockBlockers: blockers,
    },
    sourceLockProof,
    cloudDefaultForPersonalUse: "cloud-voyage4-voyage",
    methodologyDefault: "local-apple-controlled-lanes",
    hostedSupermemorySearchForMethodology: "disabled",
    providerMatrix,
    runPolicy: {
      fullSetPreferred: true,
      fullQuestionCount: questionCount || 451,
      sampleWaveQuestionCounts: [45, 150, questionCount || 451],
      concurrentProviderFamiliesAllowed: true,
      maxConcurrentProviderFamilies: 3,
      scheduleStyle: "completion-waves",
      publicClaimRequiresFullRun: true,
      publicClaimRequiresReviewerIntake: true,
      publicClaimRequiresZeroPrivacyFailures: true,
    },
    watchdog: {
      enabled: true,
      minimumQuestionsBeforeQualityStop: 45,
      stopArmIfScoreTrailsBestControlByPoints: 8,
      stopArmIfPrivacyFailuresAbove: 0,
      stopArmIfErrorRateAbove: 0.05,
      stopArmIfRateLimitRetryStreakAbove: 6,
      stopArmIfLatencyExceedsBudgetMultiplier: 2,
      keepRunningIfArmIsWithinPointsOfLeader: 3,
      reasonCodes: [
        "quality-under-control",
        "privacy-failure",
        "provider-error-rate",
        "rate-limit-streak",
        "latency-budget",
        "source-lock-mismatch",
      ],
    },
    phases,
    nextActions: [
      "Close the remaining LongMemEval-V2 source-lock choices before spending provider calls on a public-comparable run.",
      "Run local-method-refinement waves first, then cloud challengers with NVIDIA, Gemini, Voyage, and local Apple controls on the same rows.",
      "Keep Voyage as the personal/prod default until a same-data cloud challenger beats it with lower cost or better answer quality.",
      "Do not enable hosted Supermemory search inside methodology runs; keep it as a separate parity lane.",
    ],
  };
}

function buildProviderMatrix() {
  return [
    {
      family: "voyage",
      harnessArm: "cloud-voyage4-voyage",
      role: "prod-default-and-quality-challenger",
      embedModel: "voyage-4",
      rerankModel: "rerank-2.5-or-lite",
      safeRpmCap: 3,
      higherCapWhenDashboardConfirms: 60,
      freeTierNote: "Use low-RPM free-trial pacing unless the dashboard confirms higher basic limits.",
    },
    {
      family: "gemini",
      harnessArm: "cloud-gemini2-embed-rerank-proxy",
      role: "free-tier-embedding-challenger",
      embedModel: "gemini-embedding-001-or-gemini-embedding",
      rerankModel: "proxy-or-voyage-rerank",
      safeRpmCap: 20,
      publishedFreeTierRpm: 100,
      publishedFreeTierRpd: 1000,
      freeTierNote: "Cap below the published free-tier RPM because TPM is tighter for embedding.",
    },
    {
      family: "nvidia",
      harnessArm: "cloud-nvidia-nemotron-vl-1b",
      role: "free-nim-retrieval-challenger",
      embedModel: "nvidia/llama-nemotron-embed-vl-1b-v2",
      rerankModel: "nvidia/llama-nemotron-rerank-vl-1b-v2",
      safeRpmCap: 10,
      upperRpmCapByUserBudget: 20,
      freeTierNote: "Use low pacing and retry budget even if the account advertises a higher per-model cap.",
    },
    {
      family: "local-apple",
      harnessArm: "local-apple-qwen3-4b-local-rerank",
      role: "methodology-refinement-baseline",
      embedModel: "qwen3-embedding-local",
      rerankModel: "qwen3-reranker-local",
      safeRpmCap: null,
      freeTierNote: "No provider quota; bounded by unified memory, sidecar stability, and cache reuse.",
    },
  ];
}

function proofProvided(lock, field) {
  return lock.proofChecks?.find((item) => item.field === field)?.provided === true;
}

function renderMarkdown(report) {
  return [
    "# Agentic Provider Autoresearch Plan",
    "",
    `- OK: ${report.ok}`,
    `- Target: ${report.target.name}`,
    `- Source-lock ready: ${report.target.sourceLockReadyForMaterialization}`,
    `- Remaining source-lock blockers: ${report.target.remainingSourceLockBlockers.length ? report.target.remainingSourceLockBlockers.join(", ") : "none"}`,
    `- Personal/prod default: ${report.cloudDefaultForPersonalUse}`,
    `- Methodology default: ${report.methodologyDefault}`,
    `- Calls provider APIs: ${report.callsProviderApis}`,
    "",
    "## Provider Matrix",
    "",
    ...report.providerMatrix.map((item) => `- ${item.family}: ${item.harnessArm}; embed=${item.embedModel}; rerank=${item.rerankModel}; cap=${item.safeRpmCap ?? "local"}`),
    "",
    "## Watchdog",
    "",
    `- Minimum questions before quality stop: ${report.watchdog.minimumQuestionsBeforeQualityStop}`,
    `- Stop if trailing best control by points: ${report.watchdog.stopArmIfScoreTrailsBestControlByPoints}`,
    `- Stop on privacy failures above: ${report.watchdog.stopArmIfPrivacyFailuresAbove}`,
    "",
    "## Phases",
    "",
    ...report.phases.map((phase) => `- ${phase.id}: ${phase.status}`),
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

function stableHash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(String(text), secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(String(text), privatePathPattern, `${label} contains a private path`);
}
