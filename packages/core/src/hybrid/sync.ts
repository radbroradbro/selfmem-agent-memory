import type { MemoryKind } from "../types.js";
import type { HybridCandidate } from "./normalize.js";
import { normalizeHybridCandidate } from "./normalize.js";

export type SyncDecisionStatus =
  | "queued"
  | "skipped-duplicate"
  | "skipped-tombstoned"
  | "skipped-unsafe"
  | "skipped-budget"
  | "blocked-health";

export interface SyncHealth {
  readHealthy: boolean;
  writeHealthy: boolean;
  message?: string;
}

export interface SyncDecision {
  localId: string;
  status: SyncDecisionStatus;
  reason: string;
  idempotencyKey?: string;
  containerTag?: string;
}

export interface SyncPlan {
  dryRun: boolean;
  decisions: SyncDecision[];
  writeCount: number;
  blocked: boolean;
}

const syncableKinds = new Set<MemoryKind>(["fact", "preference", "decision", "procedure", "bug", "fix", "profile"]);

export function planSupermemorySync(input: {
  localMemories: HybridCandidate[];
  remoteCandidates?: HybridCandidate[];
  health: SyncHealth;
  allowedContainerTags: string[];
  dailyWriteBudget?: number;
  dryRun?: boolean;
}): SyncPlan {
  const dailyWriteBudget = input.dailyWriteBudget ?? 25;
  const remoteHashes = new Set(
    (input.remoteCandidates ?? [])
      .flatMap((candidate) => {
        const normalized = normalizeHybridCandidate(candidate);
        return normalized ? [normalized.normalizedHash] : [];
      }),
  );
  const decisions: SyncDecision[] = [];
  let writeCount = 0;

  for (const memory of input.localMemories) {
    const normalized = normalizeHybridCandidate(memory);
    if (!normalized) {
      decisions.push({ localId: memory.id, status: "skipped-unsafe", reason: "fully-private-or-unreadable" });
      continue;
    }
    const containerTag = normalized.containerTag ?? "";
    const safety = syncSafetyReason(normalized, input.allowedContainerTags);
    if (safety) {
      decisions.push({ localId: normalized.id, status: "skipped-unsafe", reason: safety, containerTag });
      continue;
    }
    if (!input.health.writeHealthy) {
      decisions.push({
        localId: normalized.id,
        status: "blocked-health",
        reason: input.health.message ?? "supermemory-write-unhealthy",
        containerTag,
      });
      continue;
    }
    if (remoteHashes.has(normalized.normalizedHash)) {
      decisions.push({ localId: normalized.id, status: "skipped-duplicate", reason: "remote-normalized-hash-match", containerTag });
      continue;
    }
    if (writeCount >= dailyWriteBudget) {
      decisions.push({ localId: normalized.id, status: "skipped-budget", reason: "daily-write-budget-exhausted", containerTag });
      continue;
    }
    writeCount += 1;
    decisions.push({
      localId: normalized.id,
      status: "queued",
      reason: input.dryRun === false ? "ready-to-apply" : "dry-run-ready",
      idempotencyKey: idempotencyKey(containerTag, normalized.normalizedHash, normalized.sourceKind ?? "unknown"),
      containerTag,
    });
  }

  return {
    dryRun: input.dryRun !== false,
    decisions,
    writeCount,
    blocked: decisions.some((decision) => decision.status === "blocked-health"),
  };
}

function syncSafetyReason(memory: ReturnType<typeof normalizeHybridCandidate>, allowlist: string[]): string {
  if (!memory) return "normalization-failed";
  if (!memory.safeForRemote) return "not-safe-for-remote";
  if (!memory.syncEligible) return "not-sync-eligible";
  if ((memory.confidence ?? 0) < 0.85) return "confidence-below-0.85";
  if (!syncableKinds.has(memory.kind as MemoryKind)) return "kind-not-syncable";
  if (["raw_transcript", "benchmark", "private", "unknown"].includes(memory.sourceKind ?? "unknown")) {
    return "source-kind-not-syncable";
  }
  if (!isAllowedContainerTag(memory.containerTag ?? "", allowlist)) return "container-not-allowed";
  return "";
}

function isAllowedContainerTag(containerTag: string, allowlist: string[]): boolean {
  return allowlist.some((allowed) => {
    if (allowed === containerTag) return true;
    if (allowed === "selfmem-bench-*") return /^selfmem-bench-[a-z0-9-]{1,40}$/.test(containerTag);
    return false;
  });
}

function idempotencyKey(containerTag: string, normalizedHash: string, sourceKind: string): string {
  const input = `supermemory:${containerTag}:${normalizedHash}:${sourceKind}`;
  return `sm-sync-${Buffer.from(input).toString("base64url").slice(0, 48)}`;
}
