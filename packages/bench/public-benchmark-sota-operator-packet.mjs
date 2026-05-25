import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const reviewDir = "reviews/overnight-20260522";
const targetPath = resolveInputPath(args.target ?? `${reviewDir}/public-longmemeval-expanded-run-target.json`);
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();
const sameDataStrategies = splitList(
  args.strategies ??
    "bm25-lite,dense-proxy,full-hybrid-rerank,query-expanded-full-hybrid-rerank,cloud-voyage4-voyage,cloud-gemini-voyage-rerank,cloud-nvidia-nemotron-1b,local-apple-qwen3-0_6b,local-apple-qwen3-0_6b-local-rerank",
);
const providerPreflightStrategies = sameDataStrategies.filter((strategy) => providerPreflightStrategy(strategy));
const minimumVoyageAnswerQualityStrategies = ["bm25-lite", "full-hybrid-rerank", "cloud-voyage4-lite-voyage-lite"];

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(existsSync(targetPath), `benchmark target missing: ${displayPath(targetPath)}`);
assert.ok(statSync(targetPath).size > 0, `benchmark target empty: ${displayPath(targetPath)}`);

const targetRaw = readFileSync(targetPath, "utf8");
assertSafePublicText(targetRaw, "source-locked target");
const target = JSON.parse(targetRaw);
const sotaLadder = runJson(["packages/bench/public-benchmark-sota-ladder.mjs", "--target", displayPath(targetPath)]);
const queryExpansionLocalQwen36PreflightEvidence = loadEvidence(`${reviewDir}/query-expansion-local-qwen36-preflight-20260525.json`);
const queryExpansionPreflight =
  queryExpansionLocalQwen36PreflightEvidence.json?.readiness?.queryExpansionCanBeBenchmarked === true
    ? queryExpansionLocalQwen36PreflightEvidence.json
    : runJson(["packages/bench/public-benchmark-query-expansion-preflight.mjs"]);
const providerPreflightEvidence = loadEvidence(`${reviewDir}/public-longmemeval-expanded-provider-live-preflight-voyage-nvidia-20260525.json`);
const providerPreflight =
  providerPreflightEvidence.json?.status === "READY_FOR_LIVE_PROVIDER_BENCHMARK"
    ? providerPreflightEvidence.json
    : runJson([
        "packages/bench/provider-benchmark-live-preflight.mjs",
        "--target",
        displayPath(targetPath),
        "--strategies",
        providerPreflightStrategies.join(","),
      ]);
const localRerankEvidence = loadEvidence(`${reviewDir}/local-rerank-sidecar-baseline-refresh-evidence.md`);
const localRerankResultGateEvidence = loadEvidence(`${reviewDir}/local-rerank-result-gate-20260525.json`);
const queryExpansionSmokeEvidence = loadEvidence(`${reviewDir}/query-expansion-live-local-smoke-20260525.json`);
const queryExpansionResultGateEvidence = loadEvidence(`${reviewDir}/query-expansion-result-gate-20260525.json`);
const providerChallengerResultGateEvidence = loadEvidence(`${reviewDir}/provider-challenger-result-gate-20260525.json`);
const endToEndMemoryScoreGateEvidence = loadEvidence(`${reviewDir}/end-to-end-memory-score-gate-20260525.json`);
const liveLocalAnswerQualityEvidence = loadEvidence(`${reviewDir}/end-to-end-memory-score-live-local-20260525.json`);
const liveProviderAnswerQualityEvidence = loadEvidence(`${reviewDir}/end-to-end-memory-score-live-provider-20260525.json`);
const voyageProviderRateLimitEvidence = loadEvidence(`${reviewDir}/voyage-provider-rate-limit-20260525.json`);
const memoryScoreReviewerIntakeEvidence = loadEvidence(`${reviewDir}/memory-score-reviewer-intake-20260525.json`);
const answerQualityArmExportLegacyEvidence = loadEvidence(`${reviewDir}/answer-quality-arm-export-20260525.json`);
const answerQualityArmExportLiveLocalEvidence = loadEvidence(`${reviewDir}/answer-quality-arm-export-live-local-20260525.json`);
const answerQualityArmExportEvidence =
  answerQualityArmExportLiveLocalEvidence.json?.status === "EXPORTED_RESPONSE_ARMS" ? answerQualityArmExportLiveLocalEvidence : answerQualityArmExportLegacyEvidence;
const answerQualityPreflightLegacyEvidence = loadEvidence(`${reviewDir}/answer-quality-preflight-20260525.json`);
const answerQualityPreflightLiveLocalEvidence = loadEvidence(`${reviewDir}/answer-quality-preflight-live-local-20260525.json`);
const answerQualityPreflightEvidence =
  answerQualityPreflightLiveLocalEvidence.json?.status === "READY_FOR_LIVE_ANSWER_QUALITY" ? answerQualityPreflightLiveLocalEvidence : answerQualityPreflightLegacyEvidence;
const answerQualityHarnessSmokeEvidence = loadEvidence(`${reviewDir}/answer-quality-harness-smoke-20260525.json`);
const currentQueryExpansionImpl = inspectQueryExpansionImplementation();
const liveLlmQueryExpansionProven = Boolean(
  answerQualityArmExportEvidence.json?.arms?.some((arm) => arm.strategy === "query-expanded-full-hybrid-rerank" && Number(arm.queryExpansionCalls ?? 0) > 0),
);

const blockers = [
  ...arrayOf(sotaLadder.blockers),
  ...arrayOf(queryExpansionPreflight.blockers).map((item) => `query-expansion:${item}`),
  ...arrayOf(providerPreflight.blockers).map((item) => `provider:${item}`),
  ...arrayOf(answerQualityArmExportEvidence.json?.blockers).map((item) => `answer-quality-arms:${item}`),
  ...arrayOf(memoryScoreReviewerIntakeEvidence.json?.blockers).map((item) => `memory-score-reviewers:${item}`),
  !currentQueryExpansionImpl.liveLlmExpansionWiringPresent ? "query-expansion-live-llm-wiring-not-proven" : null,
  !localRerankEvidence.exists ? "local-rerank-sidecar-evidence-missing" : null,
  !answerQualityArmExportEvidence.exists ? "answer-quality-arm-export-evidence-missing" : null,
  !memoryScoreReviewerIntakeEvidence.exists ? "memory-score-reviewer-intake-evidence-missing" : null,
  !endToEndMemoryScoreGateEvidence.exists ? "end-to-end-memory-score-gate-missing" : null,
  voyageProviderRateLimitEvidence.json?.status === "BLOCKED_VOYAGE_RATE_LIMIT" ? "voyage-provider-rate-limited" : null,
].filter(Boolean);

const packet = {
  schemaVersion: 1,
  ok: true,
  mode: "public-benchmark-sota-operator-packet",
  status: blockers.length === 0 ? "READY_FOR_REVIEWED_SOTA_RUN" : "BLOCKED_SOTA_OPERATOR_INPUTS",
  generatedAt: new Date().toISOString(),
  publicSafe: true,
  metricsOnly: true,
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  callsProviderApis: false,
  sendsBenchmarkTextToProvider: false,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  publicBenchmarkClaimsAllowed: false,
  target: {
    path: displayPath(targetPath),
    hash: `sha256:${sha256(targetRaw)}`,
    fixtureOnly: Boolean(target.fixtureOnly),
    benchmark: target.benchmark?.family ?? target.benchmark?.name ?? null,
    claimTier: target.claimTier ?? null,
    querySelectionPolicyHash: hashNullable(target.benchmark?.questionIdPolicy),
    answerLabelsHash: target.benchmark?.answerLabelsHash ?? null,
    scoringCodeHash: target.benchmark?.scoringCodeHash ?? null,
  },
  currentEvidence: {
    sotaLadder: {
      status: sotaLadder.status,
      publicBenchmarkClaimsAllowed: Boolean(sotaLadder.publicBenchmarkClaimsAllowed),
      blockers: arrayOf(sotaLadder.blockers),
      requiredFullMemoryArms: sotaLadder.requiredFullMemoryArms ?? [],
      fullBenchmarkPolicy: sotaLadder.fullBenchmarkPolicy ?? null,
      reportedMemoryTargets: sotaLadder.reportedMemoryTargets ?? [],
    },
    queryExpansionPreflight: {
      status: queryExpansionPreflight.status,
      evidencePath: queryExpansionLocalQwen36PreflightEvidence.exists ? queryExpansionLocalQwen36PreflightEvidence.path : null,
      queryExpansionCanBeBenchmarked: Boolean(queryExpansionPreflight.readiness?.queryExpansionCanBeBenchmarked),
      countsAsPureLocal: Boolean(queryExpansionPreflight.readiness?.countsAsPureLocal),
      countsAsMixedLocalCloud: Boolean(queryExpansionPreflight.readiness?.countsAsMixedLocalCloud),
      blockers: arrayOf(queryExpansionPreflight.blockers),
    },
    providerPreflight: {
      evidencePath: providerPreflightEvidence.exists ? providerPreflightEvidence.path : null,
      status: providerPreflight.status,
      liveRunAllowed: Boolean(providerPreflight.liveRunAllowed),
      strategies: providerPreflight.strategies ?? providerPreflightStrategies,
      requiredProviders: providerPreflight.requiredProviders ?? [],
      missingCredentialProviders: providerPreflight.missingCredentialProviders ?? [],
      blockers: arrayOf(providerPreflight.blockers),
    },
    voyageProviderRateLimit: {
      evidencePath: voyageProviderRateLimitEvidence.path,
      evidenceExists: voyageProviderRateLimitEvidence.exists,
      evidenceHash: voyageProviderRateLimitEvidence.hash,
      status: voyageProviderRateLimitEvidence.json?.status ?? null,
      attemptedStrategies: voyageProviderRateLimitEvidence.json?.attemptedStrategies ?? [],
      httpStatus: voyageProviderRateLimitEvidence.json?.httpStatus ?? null,
    },
    providerChallengerResultGate: {
      evidencePath: providerChallengerResultGateEvidence.path,
      evidenceExists: providerChallengerResultGateEvidence.exists,
      evidenceHash: providerChallengerResultGateEvidence.hash,
      status: providerChallengerResultGateEvidence.json?.status ?? null,
      countsAsLiveProviderChallengerBenchmark: Boolean(providerChallengerResultGateEvidence.json?.countsAsLiveProviderChallengerBenchmark),
      blockers: providerChallengerResultGateEvidence.json?.blockers ?? [],
    },
    endToEndMemoryScoreGate: {
      evidencePath: endToEndMemoryScoreGateEvidence.path,
      evidenceExists: endToEndMemoryScoreGateEvidence.exists,
      evidenceHash: endToEndMemoryScoreGateEvidence.hash,
      status: endToEndMemoryScoreGateEvidence.json?.status ?? null,
      countsAsEndToEndMemoryBenchmark: Boolean(endToEndMemoryScoreGateEvidence.json?.countsAsEndToEndMemoryBenchmark),
      countsAsFullMemorySotaEvidence: Boolean(endToEndMemoryScoreGateEvidence.json?.countsAsFullMemorySotaEvidence),
      blockers: endToEndMemoryScoreGateEvidence.json?.blockers ?? [],
    },
    liveLocalAnswerQuality: {
      evidencePath: liveLocalAnswerQualityEvidence.path,
      evidenceExists: liveLocalAnswerQualityEvidence.exists,
      evidenceHash: liveLocalAnswerQualityEvidence.hash,
      mode: liveLocalAnswerQualityEvidence.json?.mode ?? null,
      readyForEndToEndMemoryScoreGate: Boolean(liveLocalAnswerQualityEvidence.json?.readyForEndToEndMemoryScoreGate),
      winner: liveLocalAnswerQualityEvidence.json?.winner ?? null,
      providerCalls: Number(liveLocalAnswerQualityEvidence.json?.provider?.callsMade ?? 0),
    },
    liveProviderAnswerQuality: {
      evidencePath: liveProviderAnswerQualityEvidence.path,
      evidenceExists: liveProviderAnswerQualityEvidence.exists,
      evidenceHash: liveProviderAnswerQualityEvidence.hash,
      mode: liveProviderAnswerQualityEvidence.json?.mode ?? null,
      readyForEndToEndMemoryScoreGate: Boolean(liveProviderAnswerQualityEvidence.json?.readyForEndToEndMemoryScoreGate),
      winner: liveProviderAnswerQualityEvidence.json?.winner ?? null,
      providerCalls: Number(liveProviderAnswerQualityEvidence.json?.provider?.callsMade ?? 0),
      strategies: (liveProviderAnswerQualityEvidence.json?.strategies ?? []).map((item) => item.strategy).filter(Boolean),
    },
    memoryScoreReviewerIntake: {
      evidencePath: memoryScoreReviewerIntakeEvidence.path,
      evidenceExists: memoryScoreReviewerIntakeEvidence.exists,
      evidenceHash: memoryScoreReviewerIntakeEvidence.hash,
      status: memoryScoreReviewerIntakeEvidence.json?.status ?? null,
      publicBenchmarkApprovalReady: Boolean(memoryScoreReviewerIntakeEvidence.json?.publicBenchmarkApprovalReady),
      countsAsFullMemorySotaReview: Boolean(memoryScoreReviewerIntakeEvidence.json?.countsAsFullMemorySotaReview),
      reviewerApprovalCount: Number(memoryScoreReviewerIntakeEvidence.json?.reviewerApprovalCount ?? 0),
      independentReviewerCount: Number(memoryScoreReviewerIntakeEvidence.json?.independentReviewerCount ?? 0),
      blockers: memoryScoreReviewerIntakeEvidence.json?.blockers ?? [],
    },
    answerQualityArmExport: {
      evidencePath: answerQualityArmExportEvidence.path,
      evidenceExists: answerQualityArmExportEvidence.exists,
      evidenceHash: answerQualityArmExportEvidence.hash,
      status: answerQualityArmExportEvidence.json?.status ?? null,
      readyForAnswerQualityPreflight: Boolean(answerQualityArmExportEvidence.json?.readyForAnswerQualityPreflight),
      writesPrivateResponseFiles: Boolean(answerQualityArmExportEvidence.json?.writesPrivateResponseFiles),
      strategyCoverage: answerQualityArmExportEvidence.json?.strategyCoverage ?? null,
      blockers: answerQualityArmExportEvidence.json?.blockers ?? [],
    },
    answerQualityPreflight: {
      evidencePath: answerQualityPreflightEvidence.path,
      evidenceExists: answerQualityPreflightEvidence.exists,
      evidenceHash: answerQualityPreflightEvidence.hash,
      status: answerQualityPreflightEvidence.json?.status ?? null,
      liveAnswerQualityCanRun: Boolean(answerQualityPreflightEvidence.json?.readiness?.liveAnswerQualityCanRun),
      readyForEndToEndMemoryScoreGate: Boolean(answerQualityPreflightEvidence.json?.readiness?.readyForEndToEndMemoryScoreGate),
      blockers: answerQualityPreflightEvidence.json?.blockers ?? [],
    },
    answerQualityHarnessSmoke: {
      evidencePath: answerQualityHarnessSmokeEvidence.path,
      evidenceExists: answerQualityHarnessSmokeEvidence.exists,
      evidenceHash: answerQualityHarnessSmokeEvidence.hash,
      mode: answerQualityHarnessSmokeEvidence.json?.mode ?? null,
      fixtureOnly: Boolean(answerQualityHarnessSmokeEvidence.json?.fixtureOnly),
      memoryBenchAnswerQuality: Boolean(answerQualityHarnessSmokeEvidence.json?.memoryBenchAnswerQuality),
      readyForEndToEndMemoryScoreGate: Boolean(answerQualityHarnessSmokeEvidence.json?.readyForEndToEndMemoryScoreGate),
    },
    localRerankSidecar: {
      strategy: "local-apple-qwen3-0_6b-local-rerank",
      evidencePath: localRerankEvidence.path,
      evidenceExists: localRerankEvidence.exists,
      evidenceHash: localRerankEvidence.hash,
      endpointEnv: ["SELFMEM_LOCAL_RERANK_ENDPOINT", "SELFMEM_LOCAL_RERANK_BASE_URL"],
    },
    localRerankResultGate: {
      evidencePath: localRerankResultGateEvidence.path,
      evidenceExists: localRerankResultGateEvidence.exists,
      evidenceHash: localRerankResultGateEvidence.hash,
      status: localRerankResultGateEvidence.json?.status ?? null,
      countsAsLiveLocalRerankBenchmark: Boolean(localRerankResultGateEvidence.json?.countsAsLiveLocalRerankBenchmark),
      blockers: localRerankResultGateEvidence.json?.blockers ?? [],
    },
    queryExpansionLiveLocalSmoke: {
      evidencePath: queryExpansionSmokeEvidence.path,
      evidenceExists: queryExpansionSmokeEvidence.exists,
      evidenceHash: queryExpansionSmokeEvidence.hash,
      claimUse: queryExpansionSmokeEvidence.json?.claimUse ?? "wiring-smoke-only",
      publicBenchmarkClaimsAllowed: Boolean(queryExpansionSmokeEvidence.json?.publicBenchmarkClaimsAllowed),
    },
    queryExpansionResultGate: {
      evidencePath: queryExpansionResultGateEvidence.path,
      evidenceExists: queryExpansionResultGateEvidence.exists,
      evidenceHash: queryExpansionResultGateEvidence.hash,
      status: queryExpansionResultGateEvidence.json?.status ?? null,
      countsAsLiveQueryExpansionBenchmark: Boolean(queryExpansionResultGateEvidence.json?.countsAsLiveQueryExpansionBenchmark),
      blockers: queryExpansionResultGateEvidence.json?.blockers ?? [],
    },
    queryExpansionImplementation: currentQueryExpansionImpl,
    liveLlmQueryExpansionProven,
  },
  sameDataContract: {
    targetHashMustMatch: `sha256:${sha256(targetRaw)}`,
    querySetHashMustMatch: true,
    scoringCodeHashMustMatch: true,
    bm25LexicalFloorRequired: true,
    denseVectorSemanticControlRequired: true,
    fullHybridControlRequired: true,
    localAppleEmbeddingArmRequired: true,
    localAppleRerankerSidecarArmRequired: true,
    voyageProviderArmRequired: true,
    nvidiaOrGeminiProviderArmRequired: true,
    queryExpansionArmRequired: true,
    endToEndMemoryAnswerQualityRequired: true,
    fullOrOfficiallyComparableBenchmarkRequiredForBroadSota: true,
    retrievalProxyOnlyIsNotEnoughForPublicClaims: true,
    componentBenchmarksOnlySelectCandidates: true,
  },
  minimumVoyageAnswerQualityRetry: {
    purpose: "Close the current hard end-to-end gate blocker with the fewest extra provider calls after Voyage rate limits reset.",
    requiredStrategies: minimumVoyageAnswerQualityStrategies,
    mustCombineWithExistingInputs: [
      `${reviewDir}/end-to-end-memory-score-live-local-20260525.json`,
      `${reviewDir}/end-to-end-memory-score-live-provider-20260525.json`,
    ],
    combinedOutputMustThenPass: [
      "benchmark:provider-challenger:result-gate --require-ready",
      "benchmark:memory-score:result-gate --require-ready",
      "benchmark:sota-ladder",
    ],
    stillNotEnoughAlone: [
      "Does not authorize public SOTA wording unless the combined full-memory answer-quality score meets or beats the reported target.",
      "Does not authorize broad SOTA wording unless the run is full-benchmark or officially comparable, not only a 30-query canary.",
      "Does not replace owner approval or the fresh real-container production canary.",
    ],
  },
  operatorFlow: buildOperatorFlow(),
  reviewerPacket: {
    purpose: "Challenge the method, scoring contract, privacy contract, and release wording before any public or production claim.",
    acceptableReviewerRoutes: ["Gemini", "Claude", "NVIDIA/DeepSeek-style external critic", "Codex reviewer not involved in implementation"],
    reviewersMustReceive: [
      "metrics-only SOTA ladder report",
      "query-expansion preflight and run report",
      "same-data provider/local strategy reports",
      "end-to-end memory answer-quality report",
      "UI screenshots or browser evidence for the brain view",
      "docs and release-note diff",
    ],
    reviewersMustNotReceive: [
      "provider keys",
      "raw benchmark questions",
      "raw answers",
      "raw memory logs",
      "raw transcripts",
      "private local paths",
      "implementer scratchpad or hidden reasoning",
    ],
  },
  attachPolicy: {
    attachBack: [
      "sota-ladder-report.json",
      "sota-ladder-report.md",
      "query-expansion-preflight.json",
      "query-expansion-result.json",
      "query-expansion-result-gate.json",
      "provider-preflight.json",
      "same-data-provider-result.json",
      "provider-challenger-result-gate.json",
      "local-rerank-result-gate.json",
      "end-to-end-memory-score.json",
      "answer-quality-arm-export.json",
      "answer-quality-preflight.json",
      "answer-quality-harness-smoke.json",
      "memory-score-reviewer-intake.json",
      "end-to-end-memory-score-gate.json",
      "reviewer-approval-report.json",
      "ui-evidence-index.md",
      "release-notes-diff.md",
    ],
    forbidden: [
      "provider keys",
      "key files",
      "raw benchmark question text",
      "raw answers",
      "raw memories",
      "raw transcripts",
      "private local paths",
      "unredacted diagnostics",
      "unreviewed reviewer transcripts",
    ],
  },
  passCriteria: [
    "All arms use the exact same source-locked target, query-set hash, scoring-code hash, context budget, and limit.",
    "The actual answer model and judge model in the result match the target contract before any reported-target comparison counts.",
    "BM25, dense/vector-only, full-hybrid, local Apple embedding, local Apple reranker, Voyage, NVIDIA or Gemini, and query-expansion arms all have same-data rows.",
    "The query-expansion arm states whether it is pure local or mixed local-plus-cloud, and mixed arms name the cloud substep.",
    "The query-expansion arm proves live LLM expansion wiring before it is counted as an LLM query-expansion result.",
    "The final claim uses an end-to-end memory answer-quality score, not retrieval-proxy or MTEB-only evidence.",
    "Broad SOTA or production-replacement language waits for a full benchmark or officially comparable target, not only a 30-query canary.",
    "Supermemory reported scores are comparison targets only unless the same harness/dataset/judge semantics are matched.",
    "privacyLeakCount and redactionFailureCount are zero for every attached report.",
    "Two independent reviewers approve the exact metrics-only packet before owner review or public release wording changes.",
    "Brain UI evidence, docs, and release notes are updated after the benchmark result is known.",
  ],
  blockers,
};

const jsonText = `${JSON.stringify(packet, null, 2)}\n`;
const markdownText = `${renderMarkdown(packet)}\n`;
assertSafePublicText(jsonText, "SOTA operator packet");
assertSafePublicText(markdownText, "SOTA operator packet markdown");

if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);

function buildOperatorFlow() {
  const target = displayPath(targetPath);
  const fullAnswerQualityTarget = target.includes("public-longmemeval-full-run-target.json")
    ? target
    : `${reviewDir}/public-longmemeval-full-run-target.json`;
  const providerStrategies = providerPreflightStrategies.join(",");
  const fullLadderStrategies = sameDataStrategies.join(",");
  const minimumVoyageStrategies = minimumVoyageAnswerQualityStrategies.join(",");
  const answerQualityArms = sameDataStrategies
    .map((strategy) => `--arm ${strategy}="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/${strategy}-responses.private.json"`)
    .join(" ");
  const minimumVoyageAnswerQualityArms = minimumVoyageAnswerQualityStrategies
    .map((strategy) => `--arm ${strategy}="$RECALLWEAVE_SOTA_OUTPUT_DIR/voyage-response-arms/${strategy}-responses.private.json"`)
    .join(" ");
  return [
    {
      id: "refresh-current-safe-gates",
      description: "Refresh the blocked/ready state without provider calls or raw benchmark text.",
      commands: [
        "RECALLWEAVE_SOTA_OUTPUT_DIR=<private-output-dir-outside-repo>",
        "npm exec --yes pnpm@10.23.0 -- benchmark:sota-ladder -- --output reviews/overnight-20260522/sota-ladder-report.json --markdown-output reviews/overnight-20260522/sota-ladder-report.md",
        "npm exec --yes pnpm@10.23.0 -- benchmark:query-expansion:preflight -- --output reviews/overnight-20260522/query-expansion-preflight-next.json --markdown-output reviews/overnight-20260522/query-expansion-preflight-next.md",
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:public-provider:preflight --",
          `--target ${target}`,
          `--strategies ${providerStrategies}`,
          "--output reviews/overnight-20260522/provider-preflight-next.json",
        ].join(" "),
      ],
    },
    {
      id: "author-full-longmemeval-target",
      description:
        "Promote the benchmark target from the current 30-query canary shape to the full 500-row LongMemEval-S run-only target. This still does not spend model calls or authorize SOTA wording.",
      commands: [
        "RECALLWEAVE_SOTA_OUTPUT_DIR=<private-output-dir-outside-repo>",
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:public-slice -- --live",
          "--full",
          "--output reviews/overnight-20260522/public-longmemeval-full-slice-evidence.json",
          "--markdown-output reviews/overnight-20260522/public-longmemeval-full-slice-evidence.md",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:public-target:author --",
          "--slice-manifest reviews/overnight-20260522/public-longmemeval-full-slice-evidence.json",
          "--claim-tier run-only",
          "--judge-model gpt-4o",
          "--answer-model gpt-4o",
          "--judge-rule \"MemoryBench LongMemEval-S full answer-quality target; no comparison claim until the full metrics-only result, reviewer intake, and SOTA ladder pass.\"",
          "--output reviews/overnight-20260522/public-longmemeval-full-run-target.json",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:public-target --",
          "--target reviews/overnight-20260522/public-longmemeval-full-run-target.json",
          "--strict-run",
          "--output reviews/overnight-20260522/public-longmemeval-full-run-target-check.json",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:public-materialize -- --live",
          "--target reviews/overnight-20260522/public-longmemeval-full-run-target.json",
          "--private-output-dir \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-materialized\"",
          "--output reviews/overnight-20260522/public-longmemeval-full-materialize-run.json",
          "--markdown-output reviews/overnight-20260522/public-longmemeval-full-materialize-run-evidence.md",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:sota-ladder --",
          "--target reviews/overnight-20260522/public-longmemeval-full-run-target.json",
          "--output reviews/overnight-20260522/sota-ladder-full-target-report-20260525.json",
          "--markdown-output reviews/overnight-20260522/sota-ladder-full-target-report-20260525.md",
        ].join(" "),
      ],
      expectedPublicEvidence: [
        "full slice selectedCount is 500",
        "target claimTier remains run-only until a reported comparison row is attached",
        "materialize report queryCount is 500 and raw questions stay outside the repository",
        "SOTA ladder remains blocked until full answer-quality results exist",
      ],
    },
    {
      id: "full-longmemeval-answer-quality-shards",
      description:
        "Run the 500-query LongMemEval-S answer-quality benchmark in deterministic query shards. This is the first full-target scoring lane; it stays metrics-only and cannot authorize SOTA wording until the merged shard packet, reviewer intake, and SOTA ladder pass.",
      commands: [
        "RECALLWEAVE_SOTA_OUTPUT_DIR=<private-output-dir-outside-repo>",
        "RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS=1",
        "RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA=1",
        "RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT=1",
        "RECALLWEAVE_MEMORYBENCH_BASE_URL=<openai-compatible-answer-and-judge-url>",
        "RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL=<answer-model>",
        "RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL=<judge-model>",
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:public-materialize -- --live",
          `--target ${fullAnswerQualityTarget}`,
          "--private-output-dir \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-materialized\"",
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-materialize-report.json\"",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:arms -- --execute",
          `--target ${fullAnswerQualityTarget}`,
          "--queryset \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-materialized/longmemeval-queryset.private.json\"",
          "--memories \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-materialized/longmemeval-memories.private.jsonl\"",
          "--private-output-dir \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-response-arms\"",
          `--strategies ${fullLadderStrategies}`,
          "--context-token-budget 800",
          "--limit 5",
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-answer-quality-arm-export.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-answer-quality-arm-export.md\"",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:preflight -- --require-ready",
          `--target ${fullAnswerQualityTarget}`,
          "--queryset \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-materialized/longmemeval-queryset.private.json\"",
          "--memories \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-materialized/longmemeval-memories.private.jsonl\"",
          "--answer-labels \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-materialized/longmemeval-answer-labels.private.json\"",
          answerQualityArms.replaceAll("$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms", "$RECALLWEAVE_SOTA_OUTPUT_DIR/full-response-arms"),
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-answer-quality-preflight.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-answer-quality-preflight.md\"",
        ].join(" "),
        [
          "for offset in 0 50 100 150 200 250 300 350 400 450; do",
          "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality -- --live",
          `--target ${fullAnswerQualityTarget}`,
          "--queryset \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-materialized/longmemeval-queryset.private.json\"",
          "--memories \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-materialized/longmemeval-memories.private.jsonl\"",
          "--answer-labels \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-materialized/longmemeval-answer-labels.private.json\"",
          answerQualityArms.replaceAll("$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms", "$RECALLWEAVE_SOTA_OUTPUT_DIR/full-response-arms"),
          "--query-offset \"$offset\"",
          "--max-queries 50",
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-answer-quality-shards/shard-$offset.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-answer-quality-shards/shard-$offset.md\"",
          "|| exit 1; done",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:combine -- --combine-mode shards",
          "--input \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-answer-quality-shards/shard-0.json,$RECALLWEAVE_SOTA_OUTPUT_DIR/full-answer-quality-shards/shard-50.json,$RECALLWEAVE_SOTA_OUTPUT_DIR/full-answer-quality-shards/shard-100.json,$RECALLWEAVE_SOTA_OUTPUT_DIR/full-answer-quality-shards/shard-150.json,$RECALLWEAVE_SOTA_OUTPUT_DIR/full-answer-quality-shards/shard-200.json,$RECALLWEAVE_SOTA_OUTPUT_DIR/full-answer-quality-shards/shard-250.json,$RECALLWEAVE_SOTA_OUTPUT_DIR/full-answer-quality-shards/shard-300.json,$RECALLWEAVE_SOTA_OUTPUT_DIR/full-answer-quality-shards/shard-350.json,$RECALLWEAVE_SOTA_OUTPUT_DIR/full-answer-quality-shards/shard-400.json,$RECALLWEAVE_SOTA_OUTPUT_DIR/full-answer-quality-shards/shard-450.json\"",
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-end-to-end-memory-score.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-end-to-end-memory-score.md\"",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:memory-score:reviewer-intake -- --strict-target",
          "--result \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-end-to-end-memory-score.json\"",
          "--review <reviewer-a-memory-score-approval.json>",
          "--review <reviewer-b-memory-score-approval.json>",
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-memory-score-reviewer-intake.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-memory-score-reviewer-intake.md\"",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:memory-score:result-gate -- --require-ready",
          "--result \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-end-to-end-memory-score.json\"",
          `--target ${fullAnswerQualityTarget}`,
          "--reviewer-approval-report \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-memory-score-reviewer-intake.json\"",
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-end-to-end-memory-score-gate.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-end-to-end-memory-score-gate.md\"",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:sota-ladder --",
          `--target ${fullAnswerQualityTarget}`,
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-sota-ladder-report.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-sota-ladder-report.md\"",
        ].join(" "),
      ],
      shardContract: {
        shardSize: 50,
        expectedShardCount: 10,
        expectedFullQueryCount: 500,
        combineMode: "query-shard-answer-quality-union",
        failClosedOn: ["target mismatch", "query-set mismatch", "answer-model mismatch", "judge-model mismatch", "query-shard gap", "query-shard overlap"],
      },
      expectedPublicEvidence: [
        "each shard report includes scoredQueryStart, scoredQueryEndExclusive, totalQueryCount, and a selected-query hash",
        "the combined report uses combineMode=query-shard-answer-quality-union",
        "the combined report scoredQueryCount is 500 and queryShard.completeDataset is true",
        "publicBenchmarkClaimsAllowed remains false until result gate, SOTA ladder, and reviewer intake all pass",
      ],
    },
    {
      id: "pure-local-query-expansion-arm",
      description: "Use this only after a local OpenAI-compatible model endpoint is running. This may count as local-only when no cloud model is used.",
      commands: [
        "SELFMEM_QUERY_EXPANSION_BASE_URL=<local-openai-compatible-url>",
        "SELFMEM_QUERY_EXPANSION_MODEL=<local-query-expansion-model>",
        "RECALLWEAVE_SOTA_OUTPUT_DIR=<private-output-dir-outside-repo>",
        "npm exec --yes pnpm@10.23.0 -- benchmark:query-expansion:preflight -- --require-ready",
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:public-strategy -- --live",
          `--target ${target}`,
          "--strategies bm25-lite,dense-proxy,full-hybrid-rerank,query-expanded-full-hybrid-rerank",
          "--context-token-budget 800",
          "--limit 5",
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/query-expansion-pure-local-result.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/query-expansion-pure-local-result.md\"",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:query-expansion:result-gate -- --require-ready",
          "--result \"$RECALLWEAVE_SOTA_OUTPUT_DIR/query-expansion-pure-local-result.json\"",
          `--target ${target}`,
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/query-expansion-pure-local-gate.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/query-expansion-pure-local-gate.md\"",
        ].join(" "),
      ],
      beforeCountingAsLlmQueryExpansion: [
        "Verify the strategy used the configured local query-expansion endpoint, not only the deterministic expansion proxy.",
        "Record query-expansion latency separately from embedding and rerank latency.",
      ],
    },
    {
      id: "mixed-cloud-query-expansion-arm",
      description: "Use this when local hardware is the limiting factor. It must be labeled mixed local-plus-cloud, not pure local.",
      commands: [
        "RECALLWEAVE_QUERY_EXPANSION_CALLS=1",
        "RECALLWEAVE_QUERY_EXPANSION_PUBLIC_DATA=1",
        "NVIDIA_API_KEYS_FILE=<private-file-outside-repo>",
        "RECALLWEAVE_SOTA_OUTPUT_DIR=<private-output-dir-outside-repo>",
        "npm exec --yes pnpm@10.23.0 -- benchmark:query-expansion:preflight -- --require-ready",
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:public-strategy -- --live",
          `--target ${target}`,
          "--strategies bm25-lite,dense-proxy,full-hybrid-rerank,query-expanded-full-hybrid-rerank",
          "--context-token-budget 800",
          "--limit 5",
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/query-expansion-mixed-cloud-result.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/query-expansion-mixed-cloud-result.md\"",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:query-expansion:result-gate -- --require-ready",
          "--result \"$RECALLWEAVE_SOTA_OUTPUT_DIR/query-expansion-mixed-cloud-result.json\"",
          `--target ${target}`,
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/query-expansion-mixed-cloud-gate.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/query-expansion-mixed-cloud-gate.md\"",
        ].join(" "),
      ],
      beforeCountingAsLlmQueryExpansion: [
        "Verify only the current user query is sent to the cloud expansion model.",
        "Record provider, model, cost, and latency as a cloud substep.",
      ],
    },
    {
      id: "local-reranker-sidecar-arm",
      description: "Run the local Apple embedding arm with a separate local reranker endpoint.",
      commands: [
        "SELFMEM_LOCAL_EMBED_BASE_URL=<local-embedding-server-url>",
        "SELFMEM_LOCAL_RERANK_BASE_URL=<local-rerank-server-url>",
        "RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1",
        "RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1",
        "RECALLWEAVE_SOTA_OUTPUT_DIR=<private-output-dir-outside-repo>",
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:public-provider:preflight -- --require-ready",
          `--target ${target}`,
          "--strategies bm25-lite,full-hybrid-rerank,local-apple-qwen3-0_6b-local-rerank",
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/local-rerank-preflight.json\"",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:public-provider -- --live",
          `--target ${target}`,
          "--strategies bm25-lite,full-hybrid-rerank,local-apple-qwen3-0_6b-local-rerank",
          "--max-memory-bytes 80000000",
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/local-rerank-result.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/local-rerank-result.md\"",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:local-rerank:result-gate -- --require-ready",
          "--result \"$RECALLWEAVE_SOTA_OUTPUT_DIR/local-rerank-result.json\"",
          `--target ${target}`,
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/local-rerank-gate.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/local-rerank-gate.md\"",
        ].join(" "),
      ],
    },
    {
      id: "provider-comparison-ladder",
      description: "Run provider challengers on the same target only after preflight is ready and public-data/provider-call consent is explicit.",
      commands: [
        "RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1",
        "RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1",
        "VOYAGE_API_KEYS_FILE=<private-file-outside-repo>",
        "GEMINI_API_KEYS_FILE=<private-file-outside-repo>",
        "NVIDIA_API_KEYS_FILE=<private-file-outside-repo>",
        "SELFMEM_LOCAL_EMBED_BASE_URL=<local-embedding-server-url>",
        "RECALLWEAVE_SOTA_OUTPUT_DIR=<private-output-dir-outside-repo>",
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:public-provider:preflight -- --require-ready",
          `--target ${target}`,
          `--strategies ${providerStrategies}`,
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/provider-preflight-ready.json\"",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:public-provider -- --live",
          `--target ${target}`,
          `--strategies ${providerStrategies}`,
          "--max-memory-bytes 80000000",
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/provider-same-data-result.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/provider-same-data-result.md\"",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:provider-challenger:result-gate -- --require-ready",
          "--result \"$RECALLWEAVE_SOTA_OUTPUT_DIR/provider-same-data-result.json\"",
          `--target ${target}`,
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/provider-challenger-gate.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/provider-challenger-gate.md\"",
        ].join(" "),
      ],
    },
    {
      id: "minimum-voyage-answer-quality-retry",
      description:
        "Run this after the Voyage 429 clears. It targets the current hard blocker with BM25 and full-hybrid controls plus one Voyage arm, then combines the metrics-only result with existing local/NVIDIA/query-expansion answer-quality rows.",
      commands: [
        "RECALLWEAVE_SOTA_OUTPUT_DIR=<private-output-dir-outside-repo>",
        "RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1",
        "RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1",
        "VOYAGE_API_KEYS_FILE=<private-file-outside-repo>",
        "RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS=1",
        "RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA=1",
        "RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT=1",
        "RECALLWEAVE_MEMORYBENCH_BASE_URL=<openai-compatible-answer-and-judge-url>",
        "RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL=<answer-model>",
        "RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL=<judge-model>",
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:public-materialize -- --live",
          `--target ${target}`,
          "--private-output-dir \"$RECALLWEAVE_SOTA_OUTPUT_DIR/voyage-materialized\"",
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/voyage-materialize-report.json\"",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:arms -- --execute",
          `--target ${target}`,
          "--queryset \"$RECALLWEAVE_SOTA_OUTPUT_DIR/voyage-materialized/longmemeval-queryset.private.json\"",
          "--memories \"$RECALLWEAVE_SOTA_OUTPUT_DIR/voyage-materialized/longmemeval-memories.private.jsonl\"",
          "--private-output-dir \"$RECALLWEAVE_SOTA_OUTPUT_DIR/voyage-response-arms\"",
          `--strategies ${minimumVoyageStrategies}`,
          "--context-token-budget 800",
          "--limit 5",
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/voyage-answer-quality-arm-export.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/voyage-answer-quality-arm-export.md\"",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:preflight -- --require-ready",
          `--target ${target}`,
          "--queryset \"$RECALLWEAVE_SOTA_OUTPUT_DIR/voyage-materialized/longmemeval-queryset.private.json\"",
          "--memories \"$RECALLWEAVE_SOTA_OUTPUT_DIR/voyage-materialized/longmemeval-memories.private.jsonl\"",
          "--answer-labels \"$RECALLWEAVE_SOTA_OUTPUT_DIR/voyage-materialized/longmemeval-answer-labels.private.json\"",
          minimumVoyageAnswerQualityArms,
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/voyage-answer-quality-preflight.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/voyage-answer-quality-preflight.md\"",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality -- --live",
          `--target ${target}`,
          "--queryset \"$RECALLWEAVE_SOTA_OUTPUT_DIR/voyage-materialized/longmemeval-queryset.private.json\"",
          "--memories \"$RECALLWEAVE_SOTA_OUTPUT_DIR/voyage-materialized/longmemeval-memories.private.jsonl\"",
          "--answer-labels \"$RECALLWEAVE_SOTA_OUTPUT_DIR/voyage-materialized/longmemeval-answer-labels.private.json\"",
          minimumVoyageAnswerQualityArms,
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/voyage-answer-quality.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/voyage-answer-quality.md\"",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:combine --",
          "--input reviews/overnight-20260522/end-to-end-memory-score-live-local-20260525.json,reviews/overnight-20260522/end-to-end-memory-score-live-provider-20260525.json,\"$RECALLWEAVE_SOTA_OUTPUT_DIR/voyage-answer-quality.json\"",
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/end-to-end-memory-score-with-voyage.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/end-to-end-memory-score-with-voyage.md\"",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:provider-challenger:result-gate -- --require-ready",
          "--result \"$RECALLWEAVE_SOTA_OUTPUT_DIR/end-to-end-memory-score-with-voyage.json\"",
          `--target ${target}`,
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/provider-challenger-gate-with-voyage.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/provider-challenger-gate-with-voyage.md\"",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:memory-score:result-gate -- --require-ready",
          "--result \"$RECALLWEAVE_SOTA_OUTPUT_DIR/end-to-end-memory-score-with-voyage.json\"",
          "--reviewer-approval-report reviews/overnight-20260522/memory-score-reviewer-intake-20260525.json",
          `--target ${target}`,
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/end-to-end-memory-score-gate-with-voyage.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/end-to-end-memory-score-gate-with-voyage.md\"",
        ].join(" "),
      ],
      beforeCountingAsFullMemoryGateProgress: [
        "Confirm the combined report includes BM25, full-hybrid, query expansion, local Apple, local rerank, NVIDIA or Gemini, and Voyage rows.",
        "Confirm the combined report remains metrics-only and publicBenchmarkClaimsAllowed=false until the SOTA ladder target comparison passes.",
        "Send the combined metrics-only report to independent reviewers again if the winner, target score, or release wording changes.",
      ],
    },
    {
      id: "end-to-end-memory-score-and-review",
      description: "Do not ship public benchmark or production-replacement claims until answer quality, reviewers, UI, docs, and owner approval are all present.",
      commands: [
        "RECALLWEAVE_SOTA_OUTPUT_DIR=<private-output-dir-outside-repo>",
        "RECALLWEAVE_BASELINE_LIVE=1",
        "RECALLWEAVE_BASELINE_NO_RAW_TEXT=1",
        "RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1",
        "RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1",
        "SELFMEM_QUERY_EXPANSION_BASE_URL=<local-query-expansion-url-or-use-approved-cloud-env>",
        "SELFMEM_QUERY_EXPANSION_MODEL=<local-query-expansion-model-or-use-approved-cloud-env>",
        "VOYAGE_API_KEYS_FILE=<private-file-outside-repo>",
        "NVIDIA_API_KEYS_FILE=<private-file-outside-repo>",
        "SELFMEM_LOCAL_EMBED_BASE_URL=<local-embedding-server-url>",
        "SELFMEM_LOCAL_RERANK_BASE_URL=<local-rerank-server-url>",
        "npm exec --yes pnpm@10.23.0 -- benchmark:sota-ladder",
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:public-materialize -- --live",
          `--target ${target}`,
          "--private-output-dir \"$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized\"",
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/materialize-report.json\"",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:public-strategy -- --live",
          `--target ${target}`,
          `--strategies ${fullLadderStrategies}`,
          "--context-token-budget 800",
          "--limit 5",
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-ladder-same-data-result.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-ladder-same-data-result.md\"",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:arms -- --execute",
          `--target ${target}`,
          "--queryset \"$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized/longmemeval-queryset.private.json\"",
          "--memories \"$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized/longmemeval-memories.private.jsonl\"",
          "--private-output-dir \"$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms\"",
          `--strategies ${fullLadderStrategies}`,
          "--context-token-budget 800",
          "--limit 5",
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/answer-quality-arm-export.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/answer-quality-arm-export.md\"",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:preflight -- --require-ready",
          `--target ${target}`,
          "--queryset \"$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized/longmemeval-queryset.private.json\"",
          "--memories \"$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized/longmemeval-memories.private.jsonl\"",
          "--answer-labels \"$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized/longmemeval-answer-labels.private.json\"",
          answerQualityArms,
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/answer-quality-preflight.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/answer-quality-preflight.md\"",
        ].join(" "),
        [
          "RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS=1",
          "RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA=1",
          "RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT=1",
          "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality -- --live",
          `--target ${target}`,
          "--queryset \"$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized/longmemeval-queryset.private.json\"",
          "--memories \"$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized/longmemeval-memories.private.jsonl\"",
          "--answer-labels \"$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized/longmemeval-answer-labels.private.json\"",
          answerQualityArms,
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/end-to-end-memory-score.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/end-to-end-memory-score.md\"",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:memory-score:reviewer-intake -- --strict-target",
          "--result \"$RECALLWEAVE_SOTA_OUTPUT_DIR/end-to-end-memory-score.json\"",
          "--review <reviewer-a-memory-score-approval.json>",
          "--review <reviewer-b-memory-score-approval.json>",
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/memory-score-reviewer-intake.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/memory-score-reviewer-intake.md\"",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:memory-score:result-gate -- --require-ready",
          "--result \"$RECALLWEAVE_SOTA_OUTPUT_DIR/end-to-end-memory-score.json\"",
          "--reviewer-approval-report \"$RECALLWEAVE_SOTA_OUTPUT_DIR/memory-score-reviewer-intake.json\"",
          `--target ${target}`,
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/end-to-end-memory-score-gate.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/end-to-end-memory-score-gate.md\"",
        ].join(" "),
        "npm exec --yes pnpm@10.23.0 -- baseline:packet -- --hosted <metrics-only-hosted-result.json> --recallweave <metrics-only-recallweave-result.json> --comparison <metrics-only-comparison.json> --preflight <metrics-only-preflight.json> --strict-real --output <metrics-only-reviewer-packet.zip>",
        "npm exec --yes pnpm@10.23.0 -- baseline:reviewer-intake -- --packet <metrics-only-reviewer-packet.zip> --comparison <metrics-only-comparison.json> --strict-target --review <reviewer-a-approval.json> --review <reviewer-b-approval.json> --output reviews/overnight-20260522/reviewer-approval-report.json",
      ],
    },
  ];
}

function runJson(nodeArgs) {
  const result = spawnSync("node", nodeArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, `command failed: ${nodeArgs[0]}`);
  assertSafePublicText(result.stdout, nodeArgs[0]);
  return JSON.parse(result.stdout);
}

function providerPreflightStrategy(strategy) {
  return (
    strategy === "bm25-lite" ||
    strategy === "full-hybrid-rerank" ||
    strategy.startsWith("cloud-") ||
    strategy.startsWith("local-apple-")
  );
}

function inspectQueryExpansionImplementation() {
  const file = "packages/bench/recallweave-response-export.mjs";
  const text = readFileSync(resolve(root, file), "utf8");
  assertSafePublicText(text, file);
  const importsLiveRequestBuilder = /buildQueryExpansionRequest/.test(text);
  const hasLivePlan = /function queryExpansionPlan\(/.test(text);
  const hasOpenAiCompatibleExpansion = /function openAiCompatibleQueryExpansion\(/.test(text);
  const hasGeminiExpansion = /function geminiQueryExpansion\(/.test(text);
  return {
    strategy: "query-expanded-full-hybrid-rerank",
    inspectedFile: file,
    usesDeterministicProxy: /function expandQuery\(/.test(text),
    importsLiveRequestBuilder,
    hasLivePlan,
    hasOpenAiCompatibleExpansion,
    hasGeminiExpansion,
    liveLlmExpansionWiringPresent: importsLiveRequestBuilder && hasLivePlan && (hasOpenAiCompatibleExpansion || hasGeminiExpansion),
    liveLlmExpansionProven: false,
    claimRule: "Wiring presence is not benchmark proof; do not count this as a live LLM query-expansion arm until the run report proves the configured expander was used.",
  };
}

function loadEvidence(file) {
  const abs = resolve(root, file);
  if (!existsSync(abs)) return { path: file, exists: false, hash: null, json: null };
  const text = readFileSync(abs, "utf8");
  assertSafePublicText(text, file);
  const json = file.endsWith(".json") ? JSON.parse(text) : null;
  return { path: file, exists: true, hash: `sha256:${sha256(text)}`, json };
}

function renderMarkdown(value) {
  return [
    "# RecallWeave SOTA Ladder Operator Packet",
    "",
    `- Status: ${value.status}`,
    `- Public benchmark claims allowed: ${value.publicBenchmarkClaimsAllowed}`,
    `- Target: ${value.target.path}`,
    `- Target hash: ${value.target.hash}`,
    "",
    "## Current Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Current Evidence",
    `- SOTA ladder: ${value.currentEvidence.sotaLadder.status}`,
    `- Query expansion preflight: ${value.currentEvidence.queryExpansionPreflight.status}`,
    `- Provider preflight: ${value.currentEvidence.providerPreflight.status}`,
    `- Voyage provider blocker: ${value.currentEvidence.voyageProviderRateLimit.status ?? "missing"}`,
    `- Provider challenger result gate: ${value.currentEvidence.providerChallengerResultGate.status ?? "missing"}`,
    `- End-to-end memory score gate: ${value.currentEvidence.endToEndMemoryScoreGate.status ?? "missing"}`,
    `- Live-local answer quality: ${value.currentEvidence.liveLocalAnswerQuality.readyForEndToEndMemoryScoreGate}`,
    `- Live-local winner: ${value.currentEvidence.liveLocalAnswerQuality.winner?.strategy ?? "missing"} (${value.currentEvidence.liveLocalAnswerQuality.winner?.answerQuality ?? "missing"})`,
    `- Live-provider answer quality: ${value.currentEvidence.liveProviderAnswerQuality.readyForEndToEndMemoryScoreGate}`,
    `- Live-provider winner: ${value.currentEvidence.liveProviderAnswerQuality.winner?.strategy ?? "missing"} (${value.currentEvidence.liveProviderAnswerQuality.winner?.answerQuality ?? "missing"})`,
    `- Memory score reviewer intake: ${value.currentEvidence.memoryScoreReviewerIntake.status ?? "missing"}`,
    `- Answer-quality arm export: ${value.currentEvidence.answerQualityArmExport.status ?? "missing"}`,
    `- Answer-quality preflight: ${value.currentEvidence.answerQualityPreflight.status ?? "missing"}`,
    `- Answer-quality harness smoke: ${value.currentEvidence.answerQualityHarnessSmoke.mode ?? "missing"}`,
    `- Local rerank evidence: ${value.currentEvidence.localRerankSidecar.evidenceExists}`,
    `- Local rerank result gate: ${value.currentEvidence.localRerankResultGate.status ?? "missing"}`,
    `- Query expansion local smoke: ${value.currentEvidence.queryExpansionLiveLocalSmoke.evidenceExists}`,
    `- Query expansion result gate: ${value.currentEvidence.queryExpansionResultGate.status ?? "missing"}`,
    `- Live LLM query expansion proven: ${value.currentEvidence.liveLlmQueryExpansionProven}`,
    "",
    "## Operator Flow",
    ...value.operatorFlow.flatMap((step) => [
      `### ${step.id}`,
      "",
      step.description,
      "",
      "```bash",
      ...step.commands,
      "```",
      "",
      ...(step.beforeCountingAsLlmQueryExpansion
        ? ["Before counting this as LLM query expansion:", "", ...step.beforeCountingAsLlmQueryExpansion.map((item) => `- ${item}`), ""]
        : []),
    ]),
    "## Pass Criteria",
    ...value.passCriteria.map((item) => `- ${item}`),
    "",
    "## Reviewer Packet",
    ...value.reviewerPacket.reviewersMustReceive.map((item) => `- Attach: ${item}`),
    ...value.reviewerPacket.reviewersMustNotReceive.map((item) => `- Do not attach: ${item}`),
  ].join("\n");
}

function writeOutput(path, text) {
  const resolved = resolve(path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, text, { encoding: "utf8", mode: 0o600 });
}

function splitList(value) {
  return String(value ?? "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function hashNullable(value) {
  return value == null ? null : `sha256:${sha256(String(value))}`;
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function resolveInputPath(value) {
  return isAbsolute(String(value ?? "")) ? String(value) : resolve(root, String(value ?? ""));
}

function displayPath(value) {
  const rel = relative(root, value).replaceAll("\\", "/");
  return rel.startsWith("..") ? "external-input" : rel;
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

function assertSafePublicText(text, label) {
  const secretPattern =
    /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
  const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;
  assert.doesNotMatch(String(text), secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(String(text), privatePathPattern, `${label} contains a private local path`);
}
