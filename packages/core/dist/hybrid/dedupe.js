import { jaccardSimilarity, normalizeHybridCandidate } from "./normalize.js";
export function dedupeHybridCandidates(candidates) {
    const normalized = candidates.flatMap((candidate) => {
        const item = normalizeHybridCandidate(candidate);
        return item ? [item] : [];
    });
    const skippedUnsafe = candidates.length - normalized.length;
    const groups = [];
    const byKey = new Map();
    for (const candidate of normalized) {
        for (const key of candidateKeys(candidate)) {
            const list = byKey.get(key) ?? [];
            list.push(candidate);
            byKey.set(key, list);
        }
    }
    const consumed = new Set();
    const merged = [];
    for (const candidate of normalized) {
        if (consumed.has(candidate.id))
            continue;
        const cluster = collectCluster(candidate, byKey, normalized, consumed);
        const primary = choosePrimary(cluster);
        const duplicates = cluster.filter((item) => item.id !== primary.id);
        if (duplicates.length > 0) {
            groups.push({
                primaryId: primary.id,
                duplicateIds: duplicates.map((item) => item.id),
                reason: groupReason(primary, duplicates[0] ?? primary),
                normalizedHash: primary.normalizedHash,
                origins: [...new Set(cluster.map((item) => item.origin))].sort(),
            });
        }
        merged.push(mergeCluster(primary, duplicates));
    }
    const reviewCandidates = findNearDuplicates(merged);
    return {
        candidates: merged.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)),
        groups,
        reviewCandidates,
        skippedUnsafe,
    };
}
function candidateKeys(candidate) {
    const keys = [`hash:${candidate.normalizedHash}`];
    if (candidate.remoteSystem && candidate.remoteId)
        keys.push(`remote:${candidate.remoteSystem}:${candidate.remoteId}`);
    if (candidate.sourceId)
        keys.push(`source:${candidate.sourceId}`);
    return keys;
}
function collectCluster(seed, byKey, all, consumed) {
    const cluster = new Map();
    const queue = [seed];
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current || cluster.has(current.id))
            continue;
        cluster.set(current.id, current);
        for (const key of candidateKeys(current)) {
            for (const next of byKey.get(key) ?? []) {
                if (!cluster.has(next.id))
                    queue.push(next);
            }
        }
    }
    for (const item of cluster.values())
        consumed.add(item.id);
    return all.filter((item) => cluster.has(item.id));
}
function choosePrimary(candidates) {
    return [...candidates].sort(comparePrimary)[0] ?? candidates[0];
}
function comparePrimary(a, b) {
    const confidence = (b.confidence ?? 0) - (a.confidence ?? 0);
    if (confidence !== 0)
        return confidence;
    const updated = dateScore(b.updatedAt) - dateScore(a.updatedAt);
    if (updated !== 0)
        return updated;
    const observed = dateScore(b.observedAt) - dateScore(a.observedAt);
    if (observed !== 0)
        return observed;
    if (a.origin === "local" && b.origin !== "local")
        return -1;
    if (b.origin === "local" && a.origin !== "local")
        return 1;
    return a.id.localeCompare(b.id);
}
function dateScore(value) {
    return Date.parse(value ?? "") || 0;
}
function groupReason(primary, duplicate) {
    if (primary.remoteSystem && duplicate.remoteSystem && primary.remoteId === duplicate.remoteId)
        return "remote-id";
    if (primary.sourceId && duplicate.sourceId && primary.sourceId === duplicate.sourceId)
        return "source-id";
    return "normalized-hash";
}
function mergeCluster(primary, duplicates) {
    if (duplicates.length === 0)
        return primary;
    const all = [primary, ...duplicates];
    return {
        ...primary,
        score: Math.max(...all.map((item) => item.score)),
        confidence: Math.max(...all.map((item) => item.confidence ?? 0)),
        provenance: all.flatMap((item) => item.provenance ?? []),
        metadata: {
            ...(primary.metadata ?? {}),
            seenOrigins: [...new Set(all.map((item) => item.origin))].sort(),
            duplicateIds: duplicates.map((item) => item.id),
        },
    };
}
function findNearDuplicates(candidates) {
    const reviews = [];
    for (let left = 0; left < candidates.length; left += 1) {
        for (let right = left + 1; right < candidates.length; right += 1) {
            const a = candidates[left];
            const b = candidates[right];
            if (!a || !b)
                continue;
            const similarity = jaccardSimilarity(a.text, b.text);
            if (similarity >= 0.82) {
                reviews.push({
                    ids: [a.id, b.id],
                    reason: similarity >= 0.92 ? "near-text" : "semantic-review",
                    similarity,
                });
            }
        }
    }
    return reviews;
}
//# sourceMappingURL=dedupe.js.map