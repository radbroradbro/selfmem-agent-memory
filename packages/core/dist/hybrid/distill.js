import { createHash } from "node:crypto";
import { redactPrivate } from "../redaction/private.js";
import { normalizeHybridCandidate, tokenizeForSimilarity } from "./normalize.js";
export function createDeterministicCompactWriter() {
    return {
        id: "selfmem-deterministic-compact-v1",
        provider: "deterministic",
        async distill(input) {
            return distillDeterministically(input);
        },
    };
}
export function distillDeterministically(input) {
    const startedAt = performance.now();
    const maxMemories = input.maxMemories ?? 40;
    const maxPerCandidate = input.maxMemoriesPerCandidate ?? 3;
    const now = input.now ?? new Date().toISOString();
    const queryTokens = new Set(tokenizeForSimilarity(input.query ?? ""));
    const output = new Map();
    let skippedFullyPrivate = 0;
    let redactionCount = 0;
    for (const candidate of input.candidates) {
        const normalized = normalizeHybridCandidate(candidate);
        if (!normalized) {
            skippedFullyPrivate += 1;
            continue;
        }
        redactionCount += normalized.redactionCount;
        const statements = selectDistillableStatements(normalized.text, queryTokens, maxPerCandidate);
        for (const statement of statements) {
            const redacted = redactPrivate(statement.text);
            redactionCount += redacted.redactionCount;
            if (redacted.fullyPrivate) {
                skippedFullyPrivate += 1;
                continue;
            }
            const text = renderDistilledStatement(statement.kind, redacted.text);
            const hash = stableHash(`${statement.kind}:${text}`);
            if (output.has(hash))
                continue;
            const memory = {
                id: `distilled:${hash.slice(0, 24)}`,
                text,
                origin: normalized.origin,
                score: Math.max(normalized.score, statement.score),
                kind: statement.kind,
                scope: input.scope ?? normalized.scope ?? "user",
                sourceKind: "derived",
                sourceId: normalized.sourceId ?? normalized.id,
                confidence: statement.confidence,
                syncEligible: false,
                safeForRemote: false,
                observedAt: now,
                createdAt: now,
                metadata: {
                    ...(normalized.metadata ?? {}),
                    distilled: true,
                    distilledAt: now,
                    distilledBy: "selfmem-deterministic-compact-v1",
                    sourceCandidateIds: [normalized.id],
                    sourceOrigin: normalized.origin,
                    sourceKind: normalized.sourceKind,
                },
            };
            const containerTag = input.containerTag ?? normalized.containerTag;
            if (containerTag)
                memory.containerTag = containerTag;
            if (normalized.remoteSystem)
                memory.remoteSystem = normalized.remoteSystem;
            if (normalized.remoteId)
                memory.remoteId = normalized.remoteId;
            if (normalized.provenance)
                memory.provenance = normalized.provenance;
            const compact = normalizeHybridCandidate(memory);
            if (compact)
                output.set(hash, compact);
            if (output.size >= maxMemories)
                break;
        }
        if (output.size >= maxMemories)
            break;
    }
    return {
        memories: [...output.values()],
        trace: {
            provider: "deterministic",
            inputCandidates: input.candidates.length,
            outputMemories: output.size,
            skippedFullyPrivate,
            redactionCount,
            elapsedMs: performance.now() - startedAt,
            warnings: [],
        },
    };
}
export function createOpenAICompatibleCompactWriter(options) {
    return {
        id: options.id ?? `openai-compatible:${options.model}`,
        provider: "openai-compatible",
        async distill(input) {
            return distillWithOpenAICompatibleWriter(input, options);
        },
    };
}
async function distillWithOpenAICompatibleWriter(input, options) {
    const startedAt = performance.now();
    const now = input.now ?? new Date().toISOString();
    const maxMemories = input.maxMemories ?? 40;
    const maxChars = options.maxInputCharsPerCandidate ?? 1800;
    const normalized = [];
    let redactionCount = 0;
    let skippedFullyPrivate = 0;
    for (const candidate of input.candidates.slice(0, 20)) {
        const clean = normalizeHybridCandidate(candidate);
        if (!clean) {
            skippedFullyPrivate += 1;
            continue;
        }
        redactionCount += clean.redactionCount;
        normalized.push({
            ...clean,
            text: clean.text.slice(0, maxChars),
        });
    }
    const prompt = buildCompactWriterPrompt({
        ...(input.query ? { query: input.query } : {}),
        candidates: normalized,
        maxMemories,
    });
    const response = await fetch(`${options.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${options.apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: options.model,
            temperature: 0,
            max_tokens: 1600,
            messages: [
                {
                    role: "system",
                    content: "You distill agent memory. Return only compact JSON. Do not include secrets, raw logs, or unsupported claims.",
                },
                { role: "user", content: prompt },
            ],
        }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 45_000),
    });
    if (!response.ok) {
        throw new Error(`Compact writer failed with HTTP ${response.status}`);
    }
    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content ?? "";
    const parsed = parseCompactWriterJson(content);
    const sourceById = new Map(normalized.map((candidate) => [candidate.id, candidate]));
    const memories = [];
    for (const item of parsed.memories.slice(0, maxMemories)) {
        const textResult = redactPrivate(String(item.text ?? ""));
        redactionCount += textResult.redactionCount;
        if (textResult.fullyPrivate) {
            skippedFullyPrivate += 1;
            continue;
        }
        const sourceIds = Array.isArray(item.sourceCandidateIds)
            ? item.sourceCandidateIds.map(String).filter((id) => sourceById.has(id)).slice(0, 5)
            : [];
        if (sourceIds.length === 0)
            continue;
        const primaryId = sourceIds[0];
        if (!primaryId)
            continue;
        const primary = sourceById.get(primaryId);
        if (!primary)
            continue;
        const kind = coerceMemoryKind(item.kind);
        const text = renderDistilledStatement(kind, textResult.text);
        const memory = {
            id: `distilled:${stableHash(`${kind}:${text}`).slice(0, 24)}`,
            text,
            origin: primary.origin,
            score: Number(item.confidence ?? 0.75),
            kind,
            scope: input.scope ?? primary.scope ?? "user",
            sourceKind: "derived",
            sourceId: primary.sourceId ?? primary.id,
            confidence: clampConfidence(Number(item.confidence ?? 0.75)),
            syncEligible: false,
            safeForRemote: false,
            observedAt: now,
            createdAt: now,
            provenance: sourceIds.flatMap((id) => sourceById.get(id)?.provenance ?? []),
            metadata: {
                distilled: true,
                distilledAt: now,
                distilledBy: options.id ?? `openai-compatible:${options.model}`,
                sourceCandidateIds: sourceIds,
                sourceOrigin: primary.origin,
                llmModel: options.model,
            },
        };
        const containerTag = input.containerTag ?? primary.containerTag;
        if (containerTag)
            memory.containerTag = containerTag;
        if (primary.remoteSystem)
            memory.remoteSystem = primary.remoteSystem;
        if (primary.remoteId)
            memory.remoteId = primary.remoteId;
        const normalizedMemory = normalizeHybridCandidate(memory);
        if (normalizedMemory)
            memories.push(normalizedMemory);
    }
    return {
        memories,
        trace: {
            provider: "openai-compatible",
            inputCandidates: input.candidates.length,
            outputMemories: memories.length,
            skippedFullyPrivate,
            redactionCount,
            elapsedMs: performance.now() - startedAt,
            warnings: [],
        },
    };
}
function selectDistillableStatements(text, queryTokens, maxStatements) {
    return splitCandidateStatements(text)
        .map((statement) => {
        const kind = classifyStatement(statement);
        const score = statementScore(statement, kind, queryTokens);
        return {
            text: trimStatement(statement),
            kind,
            score,
            confidence: kind === "conversation" ? 0.55 : 0.82,
        };
    })
        .filter((statement) => statement.score > 0)
        .sort((a, b) => b.score - a.score || a.text.length - b.text.length)
        .slice(0, maxStatements);
}
function splitCandidateStatements(text) {
    return text
        .replace(/^---[\s\S]*?---/m, " ")
        .replace(/\r/g, "\n")
        .split(/\n+|(?<=[.!?])\s+(?=(?:user|assistant|[A-Z0-9"']))/)
        .map((line) => line.replace(/^\s*(?:[-*]|\d+\.)\s+/, "").replace(/\s+/g, " ").trim())
        .filter((line) => line.length >= 35 && line.length <= 900)
        .filter((line) => !isScaffold(line));
}
function isScaffold(line) {
    return [
        /^review the conversation above/i,
        /^we need answer/i,
        /^system:/i,
        /^developer:/i,
        /^tool:/i,
        /^analysis\b/i,
        /^commentary\b/i,
        /^final\b/i,
        /^chunk id:/i,
        /^wall time:/i,
        /^if something stands out, save it/i,
        /^if nothing is worth saving/i,
        /^nothing to save/i,
        /^has the user expressed/i,
        /^should this be preserved/i,
        /^save only durable/i,
        /^do not save raw credentials/i,
        /^(want me|would you like|do you want|should i|can i)\b/i,
        /^we'?re live\b/i,
        /^that'?ll show us\b/i,
        /\?\s*$/,
    ].some((pattern) => pattern.test(line));
}
function classifyStatement(text) {
    const lower = text.toLowerCase();
    if (/\b(prefer|preference|likes?|wants?|comfort|annoying|style|tone)\b/.test(lower))
        return "preference";
    if (/\b(decision|decided|default|keep|route|use .* as|do not|should|must|canonical|policy)\b/.test(lower))
        return "decision";
    if (/\b(command|install|setup|configure|run|workflow|hook|script|path|env|vm|gateway)\b/.test(lower))
        return "procedure";
    if (/\b(bug|error|failure|issue|blocked|quota|maxed|limit|leak|redact)\b/.test(lower))
        return "bug";
    if (/\b(fix|fixed|resolved|patched|hardened|fallback|degrade)\b/.test(lower))
        return "fix";
    if (/\b(benchmark|test|metric|latency|recall|precision|mrr|hit@|gate|goal)\b/.test(lower))
        return "methodology";
    if (/\b(is|are|means|container|model|provider|key|memory)\b/.test(lower))
        return "fact";
    return "conversation";
}
function statementScore(text, kind, queryTokens) {
    const lower = text.toLowerCase();
    let score = kind === "conversation" ? 0 : 1;
    if (/\b(remember|important|durable|preference|decision|workflow|gotcha|fixed|default)\b/.test(lower))
        score += 2;
    if (/\b(secret|api key|token|password|credential)\b/.test(lower))
        score -= 2;
    const tokens = new Set(tokenizeForSimilarity(text));
    for (const token of queryTokens) {
        if (tokens.has(token))
            score += 0.4;
    }
    return score;
}
function trimStatement(text, maxLength = 320) {
    const compact = text.replace(/\s+/g, " ").trim();
    if (compact.length <= maxLength)
        return compact;
    return `${compact.slice(0, maxLength - 4).trim()} ...`;
}
function renderDistilledStatement(kind, text) {
    const compact = trimStatement(text);
    const label = kind[0]?.toUpperCase() + kind.slice(1);
    if (compact.toLowerCase().startsWith(`${kind}:`))
        return compact;
    return `${label}: ${compact}`;
}
function buildCompactWriterPrompt(input) {
    const candidates = input.candidates.map((candidate) => ({
        id: candidate.id,
        origin: candidate.origin,
        kind: candidate.kind,
        sourceId: candidate.sourceId,
        text: candidate.text,
    }));
    return JSON.stringify({
        task: "Distill raw agent memory evidence into durable compact memories.",
        query: input.query ?? null,
        rules: [
            "Return JSON object with key memories.",
            "Each memory must have text, kind, confidence, and sourceCandidateIds.",
            "Do not include secrets, API keys, tokens, passwords, raw logs, or unsupported claims.",
            "Prefer user preferences, stable setup decisions, workflows, bug/fix facts, and benchmark findings.",
            "Keep each memory one sentence and under 240 characters.",
        ],
        allowedKinds: ["fact", "preference", "decision", "procedure", "bug", "fix", "conversation", "source", "profile", "methodology"],
        maxMemories: input.maxMemories,
        candidates,
    });
}
function parseCompactWriterJson(content) {
    const trimmed = content.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
    const jsonText = fenced ?? trimmed.slice(trimmed.indexOf("{"), trimmed.lastIndexOf("}") + 1);
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed.memories))
        return { memories: [] };
    return { memories: parsed.memories.filter((item) => typeof item === "object" && item !== null) };
}
function coerceMemoryKind(value) {
    const allowed = ["fact", "preference", "decision", "procedure", "bug", "fix", "conversation", "source", "profile", "methodology"];
    return allowed.includes(value) ? value : "fact";
}
function clampConfidence(value) {
    if (!Number.isFinite(value))
        return 0.75;
    return Math.min(0.99, Math.max(0.1, value));
}
function stableHash(value) {
    return createHash("sha256").update(value).digest("hex");
}
//# sourceMappingURL=distill.js.map