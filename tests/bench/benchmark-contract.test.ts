import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = "packages/bench/public-benchmark-strategy-compare.mjs";
const preflightScript = "packages/bench/provider-benchmark-live-preflight.mjs";
const resultGateScript = "packages/bench/provider-challenger-result-gate.mjs";
const materializeScript = "packages/bench/public-benchmark-materialize-run.mjs";
const answerQualityScript = "packages/bench/public-benchmark-answer-quality.mjs";
const answerQualityMethodLadderScript = "packages/bench/public-benchmark-answer-quality-method-ladder.mjs";
const answerQualityMethodLadderGateScript = "packages/bench/answer-quality-method-ladder-result-gate.mjs";
const answerQualityShardPlanScript = "packages/bench/public-benchmark-answer-quality-shard-plan.mjs";
const answerQualityShardWorkorderScript = "packages/bench/public-benchmark-answer-quality-shard-workorder.mjs";
const responseExportScript = "packages/bench/recallweave-response-export.mjs";

describe("public benchmark comparison contract", () => {
  it("reports provider promotion separately from the local hybrid control", () => {
    const report = runReport([
      "--gate",
      "provider",
      "--fixture",
      "--format",
      "json",
      "--strategies",
      "bm25-lite,full-hybrid-rerank,cloud-voyage4-lite-voyage-lite",
    ]);

    expect(report.mode).toBe("public-benchmark-provider-gate");
    expect(report.comparisonContract.bm25ControlPresent).toBe(true);
    expect(report.comparisonContract.fullHybridControlPresent).toBe(true);
    expect(report.comparisonContract.providerArmPresent).toBe(true);
    expect(report.promotion.kind).toBe("provider");
    expect(report.promotion.bestProviderStrategy).toBe("cloud-voyage4-lite-voyage-lite");
    expect(report.promotion.bestHybridStrategy).toBe("full-hybrid-rerank");
    expect(report.promotion.directionalWin).toBe(false);
    expect(report.promotion.promoteProvider).toBe(false);
    expect(report.promotion.confidenceGate.minPairedQueryCount).toBe(30);
    expect(report.promotion.confidenceGate.passes).toBe(false);
    expect(report.promotion.pairedDeltaVsBm25.pairedQueryCount).toBe(3);
    expect(report.promotion.pairedDeltaVsFullHybrid.pairedQueryCount).toBe(3);
    expect(report.promotion.reason).toMatch(/provider-backed arm/i);
    expect(report.promotion.reason).toMatch(/not earned promotion/i);
    expect(report.promotion.reason).not.toMatch(/hybrid-family arm/i);
    expect(report.providerBudget.mode).toBe("no-spend-free-tier");
    expect(report.providerBudget.maxPaidUsd).toBe(0);
    expect(report.providerBudget.requiredProviders).toEqual(["voyage"]);
    expect(report.providerBudget.requiredProvidersWithinAllowed).toBe(true);
    expect(report.providerBudget.paidProviderRequestedInNoSpendMode).toBe(false);
    expect(report.providerBudget.fallbackPolicy.crossProviderFallbackEnabled).toBe(false);
  });

  it("blocks tiny provider wins from promotion until the paired-query confidence gate passes", () => {
    const result = runRaw(["--promotion-gate-smoke"]);
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.mode).toBe("promotion-gate-smoke");
    expect(report.bootstrapCiPresent).toBe(true);
    expect(report.promotionQueryFloorEnforced).toBe(true);
  });

  it("labels the scaled Apple Silicon arm separately from the 0.6B default", () => {
    const report = runReport([
      "--gate",
      "provider",
      "--fixture",
      "--format",
      "json",
      "--strategies",
      "bm25-lite,full-hybrid-rerank,local-apple-qwen3-4b",
    ]);

    const apple = report.strategies.find((item: { strategy: string }) => item.strategy === "local-apple-qwen3-4b");
    expect(apple.provider.modelArm).toBe("local-apple-qwen3-4b");
    expect(apple.provider.embedModel).toBe("Qwen/Qwen3-Embedding-4B-GGUF");
    expect(apple.provider.embedDimensions).toBe(2560);
  });

  it("keeps the local reranker sidecar arm explicit and fail-closed", () => {
    const report = runReport([
      "--gate",
      "provider",
      "--fixture",
      "--format",
      "json",
      "--strategies",
      "bm25-lite,full-hybrid-rerank,local-apple-qwen3-0_6b-local-rerank",
    ]);

    const apple = report.strategies.find((item: { strategy: string }) => item.strategy === "local-apple-qwen3-0_6b-local-rerank");
    expect(apple.provider.providers).toEqual(["local-apple", "local-rerank"]);
    expect(apple.provider.embedModel).toBe("Qwen/Qwen3-Embedding-0.6B-GGUF");
    expect(apple.provider.embedDimensions).toBe(1024);
    expect(apple.provider.rerankModel).toBe("Qwen/Qwen3-Reranker-0.6B");
    expect(apple.provider.rerankCalls).toBeGreaterThan(0);
  });

  it("keeps the scaled local reranker sidecar arm explicit", () => {
    const report = runReport([
      "--gate",
      "provider",
      "--fixture",
      "--format",
      "json",
      "--strategies",
      "bm25-lite,full-hybrid-rerank,local-apple-qwen3-4b-local-rerank",
    ]);

    const apple = report.strategies.find((item: { strategy: string }) => item.strategy === "local-apple-qwen3-4b-local-rerank");
    expect(apple.provider.providers).toEqual(["local-apple", "local-rerank"]);
    expect(apple.provider.embedModel).toBe("Qwen/Qwen3-Embedding-4B-GGUF");
    expect(apple.provider.embedDimensions).toBe(2560);
    expect(apple.provider.rerankModel).toBe("Qwen/Qwen3-Reranker-0.6B");
    expect(apple.provider.rerankCalls).toBeGreaterThan(0);
  });

  it("counts direct Gemini Embedding 2 as a non-Voyage provider challenger", () => {
    const compare = runRaw([
      "--gate",
      "provider",
      "--fixture",
      "--format",
      "json",
      "--strategies",
      "bm25-lite,full-hybrid-rerank,cloud-voyage4-lite-voyage-lite,cloud-gemini2-embed-rerank-proxy,local-apple-qwen3-0_6b",
    ]);
    expect(compare.status, `${compare.stdout}\n${compare.stderr}`).toBe(0);

    const tempDir = mkdtempSync(join(tmpdir(), "recallweave-provider-gate-"));
    try {
      const resultPath = join(tempDir, "provider-result.json");
      writeFileSync(resultPath, compare.stdout);
      const gate = spawnSync(process.execPath, [resultGateScript, "--result", resultPath, "--format", "json"], {
        cwd: new URL("../..", import.meta.url),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      expect(gate.status, `${gate.stdout}\n${gate.stderr}`).toBe(0);

      const report = JSON.parse(gate.stdout);
      expect(report.checks.nvidiaOrGeminiProviderArmPresent).toBe(true);
      expect(report.checks.providerArmsPresent).toBe(true);
      expect(report.result.providerArms.map((item: { strategy: string }) => item.strategy)).toContain("cloud-gemini2-embed-rerank-proxy");
      expect(report.blockers).not.toContain("missing-nvidia-or-gemini-provider-arm");
      expect(report.blockers).not.toContain("missing-provider-challenger-arms");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("blocks provider gates without both lexical and full-hybrid controls", () => {
    const result = runRaw([
      "--gate",
      "provider",
      "--fixture",
      "--format",
      "json",
      "--strategies",
      "bm25-lite,cloud-voyage4-lite-voyage-lite",
    ]);

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/full-hybrid-rerank/i);
  });

  it("blocks hybrid gates without a hybrid-family candidate", () => {
    const result = runRaw([
      "--gate",
      "hybrid",
      "--fixture",
      "--format",
      "json",
      "--strategies",
      "bm25-lite,jaccard",
    ]);

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/hybrid-family/i);
  });

  it("requires a local rerank endpoint before a live local reranker run", () => {
    const result = spawnSync(
      process.execPath,
      [
        preflightScript,
        "--target",
        "packages/bench/fixtures/public-benchmark-target.fixture.json",
        "--strategies",
        "bm25-lite,full-hybrid-rerank,local-apple-qwen3-0_6b-local-rerank",
        "--require-ready",
      ],
      {
        cwd: new URL("../..", import.meta.url),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          RECALLWEAVE_PROVIDER_BENCHMARK_CALLS: "1",
          RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA: "1",
          SELFMEM_LOCAL_EMBED_BASE_URL: "http://127.0.0.1:18081/v1",
          SELFMEM_LOCAL_RERANK_ENDPOINT: "",
          SELFMEM_LOCAL_RERANK_BASE_URL: "",
        },
      },
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/local-rerank-credentials-missing/);
  });

  it("materializes atomic memory as separate fact records with source rehydration", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "recallweave-atomic-materialize-"));
    try {
      const result = spawnSync(
        process.execPath,
        [
          materializeScript,
          "--fixture",
          "--memory-method",
          "atomic-memory-v1",
          "--private-output-dir",
          tempDir,
          "--format",
          "json",
        ],
        {
          cwd: new URL("../..", import.meta.url),
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      const report = JSON.parse(result.stdout);
      expect(report.selection.memoryMethod).toBe("atomic-memory-v1");
      expect(report.selection.atomicMemoryCount).toBeGreaterThan(report.selection.contextualSourceChunkCount);
      expect(report.selection.expectedResultRefCount).toBeGreaterThan(0);
      expect(report.selection.redactionStats.keyShapedTokenRedactionCount).toBeGreaterThan(0);
      const memories = readFileSync(join(tempDir, "longmemeval-memories.private.jsonl"), "utf8");
      const fixtureKeyShapedToken = ["sk", "1234567890abcdef1234567890abcdef"].join("-");
      expect(memories).toContain("[redacted-key-shaped-token]");
      expect(memories).not.toContain(fixtureKeyShapedToken);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("links atomic updates to superseded facts with stable content-derived ids", () => {
    const result = spawnSync(
      process.execPath,
      [
        materializeScript,
        "--atomic-lifecycle-smoke",
        "--memory-method",
        "atomic-memory-v1",
      ],
      {
        cwd: new URL("../..", import.meta.url),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.mode).toBe("atomic-lifecycle-smoke");
    expect(report.stableContentIds).toBe(true);
    expect(report.linkedSupersedesCount).toBe(2);
    expect(report.supersededCount).toBe(2);
    expect(report.currentAtomId).toMatch(/#atom-[a-f0-9]{16}$/);
    expect(report.currentAtomId).not.toContain("#atom-001-");
    expect(report.currentTruth).toContain("SQLite");
  });

  it("dedupes atomic facts by rehydrated source before exporting top-k", () => {
    const result = spawnSync(process.execPath, [responseExportScript, "--rehydrated-atomic-dedupe-smoke"], {
      cwd: new URL("../..", import.meta.url),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.mode).toBe("rehydrated-atomic-dedupe-smoke");
    expect(report.rankingIdsStayAtomic).toBe(true);
    expect(report.keepsBestAtomicFactPerRehydratedSource).toBe(true);
    expect(report.resultIdsAreUnique).toBe(true);
  });

  it("keeps provider rerank scores rank-position normalized ahead of unranked tails", () => {
    const result = spawnSync(process.execPath, [responseExportScript, "--provider-rerank-cascade-smoke"], {
      cwd: new URL("../..", import.meta.url),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.mode).toBe("provider-rerank-cascade-smoke");
    expect(report.providerRankedDocsOutrankTail).toBe(true);
    expect(report.supportsNegativeRawScores).toBe(true);
  });

  it("parses NVIDIA rerank ranking/logit responses without letting negative logits invert rank", () => {
    const result = spawnSync(process.execPath, [responseExportScript, "--nvidia-adapter-parser-smoke"], {
      cwd: new URL("../..", import.meta.url),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.mode).toBe("nvidia-adapter-parser-smoke");
    expect(report.acceptsRankingsLogitShape).toBe(true);
    expect(report.negativeLogitsPreserveProviderRank).toBe(true);
  });

  it("disables DeepSeek thinking in answer-quality OpenAI-compatible calls", () => {
    const result = spawnSync(process.execPath, [answerQualityScript, "--deepseek-thinking-smoke"], {
      cwd: new URL("../..", import.meta.url),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.mode).toBe("deepseek-thinking-smoke");
    expect(report.disablesByModel).toBe(true);
    expect(report.disablesByEndpoint).toBe(true);
    expect(report.leavesNonDeepSeekUnchanged).toBe(true);
  });

  it("forwards continue-on-call-error into answer-quality method ladders", () => {
    const result = spawnSync(process.execPath, [answerQualityMethodLadderScript, "--continue-on-call-error-smoke"], {
      cwd: new URL("../..", import.meta.url),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.mode).toBe("answer-quality-method-ladder-continue-on-call-error-smoke");
    expect(report.forwardsContinueOnCallError).toBe(true);
    expect(report.leavesStrictModeStrict).toBe(true);
  });

  it("supports same-data model-challenger shard plans without exact-target or local sidecar gates", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "recallweave-model-challenger-shards-"));
    try {
      const planPath = join(tempDir, "model-challenger-shard-plan.json");
      const keyFiles = {
        gemini: join(tempDir, "gemini.keys"),
        nvidia: join(tempDir, "nvidia.keys"),
        openrouter: join(tempDir, "openrouter.keys"),
        voyage: join(tempDir, "voyage.keys"),
      };
      for (const [provider, path] of Object.entries(keyFiles)) writeFileSync(path, `${provider}-fixture-key\n`);

      const planResult = spawnSync(
        process.execPath,
        [
          answerQualityShardPlanScript,
          "--claim-scope",
          "model-challenger",
          "--output",
          planPath,
          "--format",
          "json",
        ],
        {
          cwd: new URL("../..", import.meta.url),
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      expect(planResult.status, `${planResult.stdout}\n${planResult.stderr}`).toBe(0);
      const plan = JSON.parse(planResult.stdout);
      const acceptedPlanLane = plan.executionLanes.find((lane: { acceptedByFullShardIntake: boolean }) => lane.acceptedByFullShardIntake);
      expect(plan.claimScope).toBe("model-challenger");
      expect(plan.scoringPolicy.modelMatchPolicy).toBe("challenger-model-allowed");
      expect(plan.scoringPolicy.challengerModelAllowed).toBe(true);
      expect(plan.runPlan.strategies).not.toContain("local-apple-qwen3-0_6b");
      expect(acceptedPlanLane.id).toBe("model-challenger-accepted-shards");
      expect(acceptedPlanLane.providerRequirements).toEqual(["gemini", "nvidia", "voyage"]);
      expect(acceptedPlanLane.canReachFullSotaGateAfterShardIntake).toBe(false);

      const workorderResult = spawnSync(
        process.execPath,
        [answerQualityShardWorkorderScript, "--plan", planPath, "--max-workorders", "1"],
        {
          cwd: new URL("../..", import.meta.url),
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            GEMINI_API_KEYS_FILE: keyFiles.gemini,
            NVIDIA_API_KEYS_FILE: keyFiles.nvidia,
            OPENROUTER_API_KEYS_FILE: keyFiles.openrouter,
            VOYAGE_API_KEYS_FILE: keyFiles.voyage,
            RECALLWEAVE_BASELINE_LIVE: "1",
            RECALLWEAVE_BASELINE_NO_RAW_TEXT: "1",
            RECALLWEAVE_PROVIDER_BENCHMARK_CALLS: "1",
            RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA: "1",
            RECALLWEAVE_QUERY_EXPANSION_CALLS: "1",
            RECALLWEAVE_QUERY_EXPANSION_PUBLIC_DATA: "1",
            RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS: "1",
            RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA: "1",
            RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT: "1",
            RECALLWEAVE_MEMORYBENCH_BASE_URL: "https://api.deepseek.com",
            RECALLWEAVE_MEMORYBENCH_API_KEY: "fixture-answer-key",
            RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL: "deepseek-v4-flash",
            RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL: "deepseek-v4-flash",
          },
        },
      );
      expect(workorderResult.status, `${workorderResult.stdout}\n${workorderResult.stderr}`).toBe(0);
      const workorder = JSON.parse(workorderResult.stdout);
      const acceptedWorkorderLane = workorder.executionLaneReadiness.find((lane: { acceptedByFullShardIntake: boolean }) => lane.acceptedByFullShardIntake);
      expect(acceptedWorkorderLane.readyForResponseArmExport).toBe(true);
      expect(acceptedWorkorderLane.readyForAnswerQualityScoring).toBe(true);
      expect(acceptedWorkorderLane.answerQuality.modelMatchPolicy).toBe("challenger-model-allowed");
      expect(acceptedWorkorderLane.answerQuality.scoringModelPolicySatisfied).toBe(true);
      expect(acceptedWorkorderLane.blockers).not.toContain("answer-model-does-not-match-target");
      expect(acceptedWorkorderLane.blockers).not.toContain("local-apple-credentials-missing");
      expect(acceptedWorkorderLane.blockers).not.toContain("local-rerank-credentials-missing");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("retries transient dataset fetch failures during materialization", () => {
    const result = spawnSync(process.execPath, [materializeScript, "--dataset-fetch-retry-smoke"], {
      cwd: new URL("../..", import.meta.url),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.mode).toBe("dataset-fetch-retry-smoke");
    expect(report.calls).toBe(2);
    expect(report.retriesTerminatedTimeout).toBe(true);
  });

  it("gates answer-quality method ladders only when a challenger beats session-v1", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "recallweave-method-ladder-gate-"));
    const resultPath = join(tempDir, "method-ladder.json");
    writeFileSync(
      resultPath,
      JSON.stringify({
        schemaVersion: 1,
        ok: true,
        mode: "answer-quality-memory-method-ladder",
        publicSafe: true,
        metricsOnly: true,
        retrievalProxyOnly: false,
        memoryBenchAnswerQuality: true,
        publicBenchmarkClaimsAllowed: false,
        rawQuestionIdsIncluded: false,
        rawQuestionsIncluded: false,
        rawAnswersIncluded: false,
        rawMemoryIncluded: false,
        rawTranscriptIncluded: false,
        rawPrivateOutputPathIncluded: false,
        benchmark: "longmemeval",
        fixtureOnly: false,
        executeRequested: true,
        queryShard: {
          sameRawQuerySelectionAcrossMethods: true,
          selectedQuestionIdsHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
        answerQualityReports: [
          {
            method: "session-v1",
            callsMade: 20,
            winner: { strategy: "bm25-lite", answerQuality: 20, judgeCorrectRate: 0.2 },
            strategies: [{
              strategy: "bm25-lite",
              answerQuality: 20,
              judgeCorrectRate: 0.2,
              answerFailures: 0,
              judgeFailures: 0,
              resultFingerprints: [
                { queryIdHash: "q1", score: 20, correct: false },
                { queryIdHash: "q2", score: 20, correct: false },
                { queryIdHash: "q3", score: 20, correct: false },
              ],
            }],
          },
          {
            method: "contextual-source-chunk-v1",
            callsMade: 20,
            winner: { strategy: "bm25-lite", answerQuality: 35, judgeCorrectRate: 0.35 },
            strategies: [{
              strategy: "bm25-lite",
              answerQuality: 35,
              judgeCorrectRate: 0.35,
              answerFailures: 0,
              judgeFailures: 0,
              resultFingerprints: [
                { queryIdHash: "q1", score: 35, correct: false },
                { queryIdHash: "q2", score: 35, correct: false },
                { queryIdHash: "q3", score: 35, correct: false },
              ],
            }],
          },
        ],
      }),
    );
    const result = spawnSync(
      process.execPath,
      [
        answerQualityMethodLadderGateScript,
        "--result",
        resultPath,
        "--require-ready",
        "--require-paired-bootstrap",
        "--paired-bootstrap-samples",
        "100",
      ],
      {
        cwd: new URL("../..", import.meta.url),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.status).toBe("READY_ANSWER_QUALITY_METHOD_LADDER_CHALLENGER");
    expect(report.bestChallenger.method).toBe("contextual-source-chunk-v1");
    expect(report.comparison.deltaVsBaseline).toBe(15);
    expect(report.comparison.pairedBootstrap.available).toBe(true);
    expect(report.comparison.pairedBootstrap.lowerBound95).toBe(15);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("blocks paired-bootstrap method-ladder promotion when fingerprints are missing", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "recallweave-method-ladder-bootstrap-gate-"));
    const resultPath = join(tempDir, "method-ladder.json");
    writeFileSync(
      resultPath,
      JSON.stringify({
        schemaVersion: 1,
        ok: true,
        mode: "answer-quality-memory-method-ladder",
        publicSafe: true,
        metricsOnly: true,
        retrievalProxyOnly: false,
        memoryBenchAnswerQuality: true,
        publicBenchmarkClaimsAllowed: false,
        rawQuestionIdsIncluded: false,
        rawQuestionsIncluded: false,
        rawAnswersIncluded: false,
        rawMemoryIncluded: false,
        rawTranscriptIncluded: false,
        rawPrivateOutputPathIncluded: false,
        benchmark: "longmemeval",
        fixtureOnly: false,
        executeRequested: true,
        queryShard: {
          sameRawQuerySelectionAcrossMethods: true,
          selectedQuestionIdsHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
        answerQualityReports: [
          {
            method: "session-v1",
            callsMade: 20,
            winner: { strategy: "bm25-lite", answerQuality: 20, judgeCorrectRate: 0.2 },
            strategies: [{ strategy: "bm25-lite", answerQuality: 20, judgeCorrectRate: 0.2, answerFailures: 0, judgeFailures: 0 }],
          },
          {
            method: "contextual-source-chunk-v1",
            callsMade: 20,
            winner: { strategy: "bm25-lite", answerQuality: 35, judgeCorrectRate: 0.35 },
            strategies: [{ strategy: "bm25-lite", answerQuality: 35, judgeCorrectRate: 0.35, answerFailures: 0, judgeFailures: 0 }],
          },
        ],
      }),
    );
    const result = spawnSync(
      process.execPath,
      [answerQualityMethodLadderGateScript, "--result", resultPath, "--require-paired-bootstrap"],
      {
        cwd: new URL("../..", import.meta.url),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.status).toBe("BLOCKED_ANSWER_QUALITY_METHOD_LADDER_RESULT");
    expect(report.blockers).toContain("paired-bootstrap-fingerprints-missing");
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("forwards live materialization shard controls into provider runs", () => {
    const result = runRaw([
      "--live-materialize-args-smoke",
      "--memory-method",
      "atomic-memory-v1",
      "--max-queries",
      "3",
      "--query-offset",
      "2",
      "--context-token-budget",
      "800",
      "--limit",
      "5",
    ]);
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.mode).toBe("live-materialize-args-smoke");
    expect(report.forwardsMemoryMethod).toBe(true);
    expect(report.forwardsShardSelection).toBe(true);
    expect(report.forwardsContextBudget).toBe(true);
    expect(report.forwardsLimit).toBe(true);
  });

  it("accepts zero as an explicit provider throttle interval", () => {
    const result = spawnSync(
      process.execPath,
      [
        responseExportScript,
        "--fixture",
        "--strategy",
        "cloud-voyage4-lite-voyage-lite",
        "--context-token-budget",
        "800",
        "--limit",
        "5",
        "--max-queries",
        "1",
      ],
      {
        cwd: new URL("../..", import.meta.url),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          VOYAGE_PROVIDER_MIN_INTERVAL_MS: "0",
        },
      },
    );
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.source.provider.providerThrottle.providers.voyage.minIntervalMs).toBe(0);
  });
});

function runReport(args: string[]) {
  const result = runRaw(args);
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  return JSON.parse(result.stdout);
}

function runRaw(args: string[]) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: new URL("../..", import.meta.url),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}
