import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = "packages/bench/public-benchmark-strategy-compare.mjs";
const preflightScript = "packages/bench/provider-benchmark-live-preflight.mjs";
const resultGateScript = "packages/bench/provider-challenger-result-gate.mjs";
const materializeScript = "packages/bench/public-benchmark-materialize-run.mjs";
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
    expect(report.promotion.pairedDeltaVsBm25.pairedQueryCount).toBe(3);
    expect(report.promotion.pairedDeltaVsFullHybrid.pairedQueryCount).toBe(3);
    expect(report.promotion.reason).toMatch(/provider-backed arm/i);
    expect(report.promotion.reason).not.toMatch(/hybrid-family arm/i);
    expect(report.providerBudget.mode).toBe("no-spend-free-tier");
    expect(report.providerBudget.maxPaidUsd).toBe(0);
    expect(report.providerBudget.requiredProviders).toEqual(["voyage"]);
    expect(report.providerBudget.requiredProvidersWithinAllowed).toBe(true);
    expect(report.providerBudget.paidProviderRequestedInNoSpendMode).toBe(false);
    expect(report.providerBudget.fallbackPolicy.crossProviderFallbackEnabled).toBe(false);
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
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
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
