import { normalizeHybridCandidate } from "./normalize.js";
const syncableKinds = new Set(["fact", "preference", "decision", "procedure", "bug", "fix", "profile"]);
export function planSupermemorySync(input) {
    const dailyWriteBudget = input.dailyWriteBudget ?? 25;
    const remoteHashes = new Set((input.remoteCandidates ?? [])
        .flatMap((candidate) => {
        const normalized = normalizeHybridCandidate(candidate);
        return normalized ? [normalized.normalizedHash] : [];
    }));
    const decisions = [];
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
function syncSafetyReason(memory, allowlist) {
    if (!memory)
        return "normalization-failed";
    if (!memory.safeForRemote)
        return "not-safe-for-remote";
    if (!memory.syncEligible)
        return "not-sync-eligible";
    if ((memory.confidence ?? 0) < 0.85)
        return "confidence-below-0.85";
    if (!syncableKinds.has(memory.kind))
        return "kind-not-syncable";
    if (["raw_transcript", "benchmark", "private", "unknown"].includes(memory.sourceKind ?? "unknown")) {
        return "source-kind-not-syncable";
    }
    if (!isAllowedContainerTag(memory.containerTag ?? "", allowlist))
        return "container-not-allowed";
    return "";
}
function isAllowedContainerTag(containerTag, allowlist) {
    return allowlist.some((allowed) => {
        if (allowed === containerTag)
            return true;
        if (allowed === "selfmem-bench-*")
            return /^selfmem-bench-[a-z0-9-]{1,40}$/.test(containerTag);
        return false;
    });
}
function idempotencyKey(containerTag, normalizedHash, sourceKind) {
    const input = `supermemory:${containerTag}:${normalizedHash}:${sourceKind}`;
    return `sm-sync-${Buffer.from(input).toString("base64url").slice(0, 48)}`;
}
//# sourceMappingURL=sync.js.map