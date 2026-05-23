import { createHash } from "node:crypto";

export const baselineScoringContract = Object.freeze({
  id: "recallweave-baseline-scoring-v1",
  relevance: ["expectedResultIds", "expectedResultHashes"],
  metrics: ["quality", "pAt1", "recallAt5", "recallAt10", "ndcgAt10", "latencyP50Ms", "latencyP95Ms", "contextTokensAvg"],
  quality: "mean(pAt1, recallAt5, recallAt10, ndcgAt10)",
  ndcg: "binary relevance over top 10",
  latency: "response timing in milliseconds",
  contextTokens: "sum result estimatedTokens; raw text fixture fallback uses ceil(chars / 4)",
  resultOutput: "aggregate metrics and hashed fingerprints only",
});

export function baselineScoringContractHash() {
  return createHash("sha256").update(JSON.stringify(baselineScoringContract)).digest("hex");
}
