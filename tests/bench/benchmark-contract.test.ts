import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script = "packages/bench/public-benchmark-strategy-compare.mjs";

describe("public benchmark comparison contract", () => {
  it("reports provider promotion from provider-backed arms, not the local hybrid control", () => {
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
    expect(report.promotion.bestHybridStrategy).toBe("cloud-voyage4-lite-voyage-lite");
    expect(report.promotion.reason).toMatch(/provider-backed arm/i);
    expect(report.promotion.reason).not.toMatch(/hybrid-family arm/i);
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
