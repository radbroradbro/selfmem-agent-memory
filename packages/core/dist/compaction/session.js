import { createHash } from "node:crypto";
import { redactPrivate } from "../redaction/private.js";
const noisePattern = /\b(ok|okay|thanks|thank you|lol|lmao|status check|heartbeat|typing|running|done|looks good)\b/i;
const durablePatterns = [
    { kind: "decision", pattern: /\b(decided|decision|default|approved|use .* as|keep .* as)\b/i, reason: "decision", baseSalience: 0.86 },
    { kind: "preference", pattern: /\b(prefer|preference|want|don't want|do not want|do not write|never store|comfort|annoying|easier)\b/i, reason: "preference", baseSalience: 0.78 },
    { kind: "profile", pattern: /\b(remember|background|profile|identity|high-level|class context|school material)\b/i, reason: "profile", baseSalience: 0.7 },
    { kind: "procedure", pattern: /\b(procedure|run|install|setup|set up|wire|configure|update|doctor|smoke|test)\b/i, reason: "procedure", baseSalience: 0.82 },
    { kind: "bug", pattern: /\b(bug|error|failed|failure|issue|regression|broken|blocked)\b/i, reason: "bug", baseSalience: 0.75 },
    { kind: "fix", pattern: /\b(fixed|patched|resolved|clean|passed|working|verified)\b/i, reason: "fix", baseSalience: 0.76 },
    { kind: "methodology", pattern: /\b(benchmark|hypothesis|research|lineage|source-lock|review|evidence|gate)\b/i, reason: "methodology", baseSalience: 0.8 },
    { kind: "source", pattern: /\b(source|paper|docs|github|plugin|gbrain|wiki|obsidian)\b/i, reason: "source", baseSalience: 0.69 },
];
const defaultStaleRules = [
    {
        id: "completed-academic-term",
        pattern: /\b(Spring|Summer|Fall|Winter)\s+20\d{2}\b/i,
        detailPattern: /\b(class|course|school|notes|outline|exam)\b/i,
        replacementText: "Completed academic-term material is stale background. Keep only high-level profile context, not bulk notes.",
        saliencePenalty: 0.32,
    },
];
export function compactSession(input) {
    const maxCandidates = input.maxCandidates ?? 40;
    const sortedEvents = [...input.events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const candidates = new Map();
    let redactionCount = 0;
    let skippedFullyPrivate = 0;
    let skippedNoise = 0;
    for (const event of sortedEvents) {
        const redacted = redactPrivate(event.content);
        redactionCount += redacted.redactionCount;
        if (redacted.fullyPrivate) {
            skippedFullyPrivate += 1;
            continue;
        }
        const statements = splitStatements(redacted.text);
        for (const statement of statements) {
            const compacted = compactStatement({
                sessionId: input.sessionId,
                eventId: event.id,
                timestamp: event.timestamp,
                statement,
                staleRules: input.staleRules ?? defaultStaleRules,
            });
            if (!compacted) {
                skippedNoise += 1;
                continue;
            }
            const existing = candidates.get(compacted.id);
            if (existing) {
                existing.sourceEventIds.push(event.id);
                existing.salience = Math.max(existing.salience, compacted.salience);
                existing.reasons = [...new Set([...existing.reasons, ...compacted.reasons])];
                continue;
            }
            candidates.set(compacted.id, compacted);
            if (candidates.size >= maxCandidates)
                break;
        }
        if (candidates.size >= maxCandidates)
            break;
    }
    const output = [...candidates.values()].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
    return {
        sessionId: input.sessionId,
        source: input.source,
        candidates: output,
        metrics: {
            inputEvents: input.events.length,
            redactionCount,
            skippedFullyPrivate,
            skippedNoise,
            outputCandidates: output.length,
            chronological: isChronological(output),
            noiseReductionRatio: input.events.length === 0 ? 0 : 1 - output.length / input.events.length,
        },
    };
}
function compactStatement(input) {
    const text = normalizeStatement(input.statement);
    if (text.length < 24)
        return undefined;
    if (noisePattern.test(text) && text.length < 90)
        return undefined;
    const staleRule = findStaleRule(text, input.staleRules);
    const stale = Boolean(staleRule);
    const matches = durablePatterns.filter((item) => item.pattern.test(text));
    if (matches.length === 0 && !stale)
        return undefined;
    const selected = selectBestMatch(text, matches) ?? { kind: "profile", pattern: /\bprofile\b/i, reason: "profile", baseSalience: 0.7 };
    const salience = Math.max(0.1, selected.baseSalience + Math.min(matches.length, 3) * 0.03 - (stale ? staleRule?.saliencePenalty ?? 0.32 : 0));
    const rendered = stale && staleRule ? renderStaleMemory(text, staleRule) : text;
    return {
        id: `compact:${stableHash(`${selected.kind}:${rendered}`).slice(0, 24)}`,
        kind: stale ? "profile" : selected.kind,
        text: rendered,
        observedAt: input.timestamp,
        sourceSessionId: input.sessionId,
        sourceEventIds: [input.eventId],
        salience: Number(salience.toFixed(2)),
        reasons: [...new Set(matches.map((item) => item.reason).concat(staleRule ? [`stale:${staleRule.id}`] : []))],
        ...(stale ? { stale: true } : {}),
    };
}
function selectBestMatch(text, matches) {
    return [...matches].sort((a, b) => matchScore(text, b) - matchScore(text, a))[0];
}
function matchScore(text, pattern) {
    return pattern.baseSalience + (hasExplicitKindLabel(text, pattern.kind) ? 0.2 : 0);
}
function hasExplicitKindLabel(text, kind) {
    const labels = {
        decision: ["decision", "decided"],
        preference: ["preference"],
        procedure: ["procedure"],
        bug: ["bug", "issue"],
        fix: ["fix", "fixed"],
        methodology: ["methodology", "research hypothesis", "hypothesis"],
        source: ["source"],
    };
    const kindLabels = labels[kind] ?? [];
    return kindLabels.some((label) => new RegExp(`^\\s*${label}\\s*:`, "i").test(text));
}
function findStaleRule(text, rules) {
    return rules.find((rule) => rule.pattern.test(text) && (!rule.detailPattern || rule.detailPattern.test(text)));
}
function renderStaleMemory(_text, rule) {
    if (rule.replacementText)
        return rule.replacementText;
    return "Stale source material is background. Keep only high-level context, not bulk historical detail.";
}
function splitStatements(text) {
    return text
        .split(/(?<=[.!?])\s+|\n{2,}|(?:^|\n)\s*[-*]\s+/)
        .map((item) => item.trim())
        .filter(Boolean);
}
function normalizeStatement(text) {
    return text.replace(/\s+/g, " ").trim();
}
function stableHash(input) {
    return createHash("sha256").update(input).digest("hex");
}
function isChronological(candidates) {
    return candidates.every((candidate, index) => index === 0 || candidates[index - 1].observedAt <= candidate.observedAt);
}
//# sourceMappingURL=session.js.map