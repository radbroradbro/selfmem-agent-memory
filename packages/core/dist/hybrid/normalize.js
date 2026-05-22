import { createHash } from "node:crypto";
import { redactPrivate } from "../redaction/private.js";
export function normalizeMemoryText(input) {
    const redacted = redactPrivate(input).text;
    return redacted
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/(^[^\w<]+|[^\w>]+$)/g, "")
        .trim();
}
export function normalizedHash(input) {
    return createHash("sha256").update(normalizeMemoryText(input)).digest("hex");
}
export function normalizeHybridCandidate(candidate) {
    const redacted = redactPrivate(candidate.text);
    if (redacted.fullyPrivate)
        return null;
    const hash = candidate.normalizedHash ?? normalizedHash(redacted.text);
    const provenance = candidate.provenance ?? [
        {
            origin: candidate.origin,
            sourceId: candidate.sourceId ?? candidate.id,
            observedAt: candidate.observedAt ?? new Date(0).toISOString(),
            ...(candidate.remoteSystem ? { remoteSystem: candidate.remoteSystem } : {}),
            ...(candidate.remoteId ? { remoteId: candidate.remoteId } : {}),
            ...(candidate.containerTag ? { containerTag: candidate.containerTag } : {}),
        },
    ];
    return {
        ...candidate,
        text: redacted.text,
        normalizedHash: hash,
        safeForRemote: Boolean(candidate.safeForRemote) && !redacted.redacted,
        redactionCount: redacted.redactionCount,
        provenance,
    };
}
export function tokenizeForSimilarity(input) {
    return normalizeMemoryText(input)
        .replace(/<[^>]+>/g, " ")
        .replace(/[^a-z0-9_/-]+/g, " ")
        .split(/\s+/)
        .filter((token) => token.length > 1);
}
export function jaccardSimilarity(a, b) {
    const aSet = new Set(tokenizeForSimilarity(a));
    const bSet = new Set(tokenizeForSimilarity(b));
    if (aSet.size === 0 && bSet.size === 0)
        return 1;
    let intersection = 0;
    for (const token of aSet) {
        if (bSet.has(token))
            intersection += 1;
    }
    const union = new Set([...aSet, ...bSet]).size;
    return union === 0 ? 0 : intersection / union;
}
//# sourceMappingURL=normalize.js.map