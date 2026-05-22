import { readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { redactPrivate } from "../redaction/private.js";
export const DEFAULT_LOCAL_CONTAINER_AUDIT_FILES = [
    "memories.jsonl",
    "raw_events.jsonl",
    "lossless_context.jsonl",
    "trace.jsonl",
];
export const DEFAULT_LOCAL_CONTAINER_BROWSE_FILES = [
    "memories.jsonl",
    "trace.jsonl",
    "lossless_context.jsonl",
];
const LOCAL_MEMORY_EDIT_OVERLAY_FILE = ".recallweave/local-memory-edits.jsonl";
export async function auditLocalContainer(input) {
    const maxFileBytes = input.maxFileBytes ?? 1_000_000;
    const inspectFiles = input.inspectFiles ?? DEFAULT_LOCAL_CONTAINER_AUDIT_FILES;
    const files = [];
    for (const fileName of inspectFiles) {
        files.push(await auditFile(input.rootDir, fileName, maxFileBytes));
    }
    const totals = files.reduce((acc, file) => {
        if (file.exists)
            acc.existingFiles += 1;
        if (file.exists && !file.skippedReason)
            acc.inspectedFiles += 1;
        acc.bytes += file.bytes ?? 0;
        acc.lines += file.lineCount ?? 0;
        acc.redactionCount += file.redactionCount ?? 0;
        if (file.skippedReason && file.skippedReason !== "missing")
            acc.skippedFiles += 1;
        return acc;
    }, {
        existingFiles: 0,
        inspectedFiles: 0,
        bytes: 0,
        lines: 0,
        redactionCount: 0,
        skippedFiles: 0,
    });
    const reasons = healthReasons(files, totals);
    return {
        schemaVersion: 1,
        mode: "local-container-audit",
        writesRealFiles: false,
        rootPathRedacted: true,
        containerLabel: sanitizeContainerLabel(input.containerLabel),
        maxFileBytes,
        files,
        totals,
        health: {
            status: reasons.length === 0 ? "healthy" : "needs-review",
            reasons,
        },
    };
}
export async function browseLocalContainer(input) {
    const maxFileBytes = input.maxFileBytes ?? 256_000;
    const maxItems = clampInteger(input.maxItems ?? 12, 1, 50);
    const inspectFiles = input.inspectFiles ?? DEFAULT_LOCAL_CONTAINER_BROWSE_FILES;
    const files = [];
    const items = [];
    let linesInspected = 0;
    let skippedPrivate = 0;
    let redactionCount = 0;
    const editOverlay = await readLocalMemoryEditOverlay(input.rootDir, maxFileBytes);
    redactionCount += editOverlay.report.redactionCount;
    for (const fileName of inspectFiles) {
        const name = basename(fileName);
        if (name !== fileName || !DEFAULT_LOCAL_CONTAINER_BROWSE_FILES.includes(name)) {
            files.push({ name: sanitizeFileName(fileName), exists: false, skippedReason: "unsafe_name" });
            continue;
        }
        const file = await readBrowseFile(input.rootDir, name, maxFileBytes);
        files.push(file.report);
        if (!file.text)
            continue;
        const lines = file.text.split(/\r?\n/).filter((line) => line.trim().length > 0);
        linesInspected += lines.length;
        for (const [index, line] of lines.entries()) {
            if (items.length >= maxItems)
                break;
            const item = browseItemFromLine(name, index + 1, line);
            const overlays = overlaysForItem(item, editOverlay);
            if (overlays.length > 0)
                item.overlays = overlays;
            redactionCount += item.redactionCount;
            if (!item.summary) {
                skippedPrivate += 1;
                continue;
            }
            items.push(item);
        }
        if (items.length >= maxItems)
            break;
    }
    return {
        schemaVersion: 1,
        mode: "local-container-browse-preview",
        writesRealFiles: false,
        rootPathRedacted: true,
        containerLabel: sanitizeContainerLabel(input.containerLabel),
        maxFileBytes,
        maxItems,
        files,
        editOverlay: editOverlay.report,
        items,
        totals: {
            filesInspected: files.filter((file) => file.exists && !file.skippedReason).length,
            linesInspected,
            itemsReturned: items.length,
            skippedPrivate,
            redactionCount,
            editOverlayCount: editOverlay.report.applied,
            editOverlayRedactionCount: editOverlay.report.redactionCount,
        },
    };
}
async function auditFile(rootDir, fileName, maxFileBytes) {
    const name = basename(fileName);
    if (name !== fileName || !DEFAULT_LOCAL_CONTAINER_AUDIT_FILES.includes(name)) {
        return { name: sanitizeFileName(fileName), exists: false, skippedReason: "unsafe_name" };
    }
    const path = join(rootDir, name);
    let size = 0;
    try {
        const info = await stat(path);
        if (!info.isFile()) {
            return { name, exists: false, skippedReason: "missing" };
        }
        size = info.size;
    }
    catch {
        return { name, exists: false, skippedReason: "missing" };
    }
    if (size > maxFileBytes) {
        return { name, exists: true, bytes: size, skippedReason: "oversize" };
    }
    try {
        const text = await readFile(path, "utf8");
        const redaction = redactPrivate(text);
        return {
            name,
            exists: true,
            bytes: size,
            lineCount: countJsonlLines(text),
            redactionCount: redaction.redactionCount,
        };
    }
    catch {
        return { name, exists: true, bytes: size, skippedReason: "read_error" };
    }
}
async function readBrowseFile(rootDir, name, maxFileBytes) {
    const path = join(rootDir, name);
    let size = 0;
    try {
        const info = await stat(path);
        if (!info.isFile()) {
            return { report: { name, exists: false, skippedReason: "missing" } };
        }
        size = info.size;
    }
    catch {
        return { report: { name, exists: false, skippedReason: "missing" } };
    }
    if (size > maxFileBytes) {
        return { report: { name, exists: true, bytes: size, skippedReason: "oversize" } };
    }
    try {
        const text = await readFile(path, "utf8");
        return {
            report: {
                name,
                exists: true,
                bytes: size,
                inspectedLines: countJsonlLines(text),
            },
            text,
        };
    }
    catch {
        return { report: { name, exists: true, bytes: size, skippedReason: "read_error" } };
    }
}
function browseItemFromLine(sourceFile, line, rawLine) {
    const parsed = parseJsonLine(rawLine);
    const redaction = redactPrivate(summarizeEntry(parsed ?? rawLine));
    const item = {
        sourceFile,
        line,
        kind: sanitizeScalar(entryValue(parsed, ["kind", "type"]) ?? sourceFile.replace(/\.jsonl$/, "")),
        summary: redaction.fullyPrivate ? "" : truncate(redaction.text, 280),
        redactionCount: redaction.redactionCount,
    };
    const event = sanitizeOptionalScalar(entryValue(parsed, ["event", "hook", "action"]));
    if (event)
        item.event = event;
    const sourceId = sanitizeOptionalScalar(entryValue(parsed, ["id", "memoryId", "sourceId", "sessionId"]));
    if (sourceId)
        item.sourceId = sourceId;
    return item;
}
async function readLocalMemoryEditOverlay(rootDir, maxFileBytes) {
    const path = join(rootDir, ".recallweave", "local-memory-edits.jsonl");
    const empty = (skippedReason, bytes) => {
        const report = {
            path: LOCAL_MEMORY_EDIT_OVERLAY_FILE,
            exists: skippedReason !== "missing",
            applied: 0,
            skippedPrivate: 0,
            redactionCount: 0,
        };
        if (bytes !== undefined)
            report.bytes = bytes;
        if (skippedReason !== undefined)
            report.skippedReason = skippedReason;
        return {
            report,
            byLine: new Map(),
            bySourceId: new Map(),
        };
    };
    let size = 0;
    try {
        const info = await stat(path);
        if (!info.isFile())
            return empty("missing");
        size = info.size;
    }
    catch {
        return empty("missing");
    }
    if (size > maxFileBytes)
        return empty("oversize", size);
    try {
        const text = await readFile(path, "utf8");
        const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
        const byLine = new Map();
        const bySourceId = new Map();
        let skippedPrivate = 0;
        let redactionCount = 0;
        let applied = 0;
        for (const line of lines) {
            const overlay = overlayFromLine(line);
            if (!overlay)
                continue;
            redactionCount += overlay.redactionCount;
            if (overlay.redactionCount > 0 && !overlay.contentIncluded && overlay.action !== "suppress")
                skippedPrivate += 1;
            addOverlay(byLine, `${overlay.sourceFile}:${overlay.line}`, overlay);
            if (overlay.sourceId)
                addOverlay(bySourceId, `${overlay.sourceFile}:${overlay.sourceId}`, overlay);
            applied += 1;
        }
        return {
            report: {
                path: LOCAL_MEMORY_EDIT_OVERLAY_FILE,
                exists: true,
                bytes: size,
                inspectedLines: lines.length,
                applied,
                skippedPrivate,
                redactionCount,
            },
            byLine,
            bySourceId,
        };
    }
    catch {
        return empty("read_error", size);
    }
}
function overlayFromLine(line) {
    const parsed = parseJsonLine(line);
    if (!parsed)
        return undefined;
    const sourceFile = safeBrowseFileName(parsed.sourceFile);
    if (!sourceFile)
        return undefined;
    const lineNumber = clampInteger(Number.parseInt(stringifyScalar(parsed.line), 10), 1, 1_000_000);
    const action = sanitizeScalar(entryValue(parsed, ["action"]) ?? "needs_review") || "needs_review";
    const reason = sanitizeScalar(entryValue(parsed, ["reason"]) ?? "manual_correction") || "manual_correction";
    const sourceId = sanitizeOptionalScalar(entryValue(parsed, ["sourceId"]));
    const createdAt = sanitizeOptionalScalar(entryValue(parsed, ["createdAt"]));
    const replacementValue = entryValue(parsed, ["replacementText"]);
    const replacement = redactPrivate(stringifyScalar(replacementValue));
    const hasReplacement = replacementValue !== undefined && stringifyScalar(replacementValue).trim().length > 0;
    const overlay = {
        action,
        reason,
        sourceFile,
        line: lineNumber,
        redactionCount: replacement.redactionCount,
        contentIncluded: hasReplacement && !replacement.fullyPrivate && replacement.text.trim().length > 0 && action !== "suppress",
    };
    if (sourceId)
        overlay.sourceId = sourceId;
    if (createdAt)
        overlay.createdAt = createdAt;
    if (overlay.contentIncluded)
        overlay.replacementPreview = truncate(replacement.text, 180);
    return overlay;
}
function overlaysForItem(item, overlays) {
    const matches = [
        ...(overlays.byLine.get(`${item.sourceFile}:${item.line}`) ?? []),
        ...(item.sourceId ? overlays.bySourceId.get(`${item.sourceFile}:${item.sourceId}`) ?? [] : []),
    ];
    const seen = new Set();
    return matches
        .filter((overlay) => {
        const key = `${overlay.sourceFile}:${overlay.line}:${overlay.sourceId ?? ""}:${overlay.action}:${overlay.createdAt ?? ""}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    })
        .slice(0, 5);
}
function addOverlay(map, key, overlay) {
    const existing = map.get(key) ?? [];
    existing.push(overlay);
    map.set(key, existing);
}
function safeBrowseFileName(value) {
    const name = sanitizeScalar(value);
    return DEFAULT_LOCAL_CONTAINER_BROWSE_FILES.includes(name)
        ? name
        : undefined;
}
function parseJsonLine(line) {
    try {
        const parsed = JSON.parse(line);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : undefined;
    }
    catch {
        return undefined;
    }
}
function summarizeEntry(entry) {
    if (typeof entry === "string")
        return entry;
    const direct = entryValue(entry, ["text", "content", "summary", "message", "query", "title"]);
    if (direct !== undefined)
        return stringifyScalar(direct);
    const parts = [
        ["kind", entryValue(entry, ["kind", "type"])],
        ["event", entryValue(entry, ["event", "hook", "action"])],
        ["source", entryValue(entry, ["sourceId", "sessionId", "memoryId", "id"])],
        ["count", entryValue(entry, ["count", "resultCount", "lineCount"])],
    ]
        .filter(([, value]) => value !== undefined)
        .map(([label, value]) => `${label}: ${stringifyScalar(value)}`);
    return parts.length > 0 ? parts.join("; ") : "structured entry";
}
function entryValue(entry, keys) {
    if (!entry)
        return undefined;
    for (const key of keys) {
        const value = entry[key];
        if (value !== undefined && value !== null && stringifyScalar(value).trim())
            return value;
    }
    return undefined;
}
function stringifyScalar(value) {
    if (typeof value === "string")
        return value;
    if (typeof value === "number" || typeof value === "boolean")
        return String(value);
    if (Array.isArray(value))
        return value.map(stringifyScalar).filter(Boolean).join(", ");
    if (typeof value === "object" && value)
        return JSON.stringify(value);
    return "";
}
function sanitizeOptionalScalar(value) {
    const safe = sanitizeScalar(value);
    return safe || undefined;
}
function sanitizeScalar(value) {
    const redacted = redactPrivate(stringifyScalar(value));
    return redacted.fullyPrivate ? "" : truncate(redacted.text, 96);
}
function healthReasons(files, totals) {
    const reasons = [];
    if (totals.existingFiles === 0)
        reasons.push("no_known_container_files");
    if (totals.redactionCount > 0)
        reasons.push("private_or_key_shaped_text_detected");
    if (files.some((file) => file.skippedReason === "oversize"))
        reasons.push("file_exceeds_safe_audit_size");
    if (files.some((file) => file.skippedReason === "read_error"))
        reasons.push("file_read_error");
    if (files.some((file) => file.skippedReason === "unsafe_name"))
        reasons.push("unsafe_audit_file_name_rejected");
    return reasons;
}
function sanitizeContainerLabel(value) {
    const label = value?.trim() || "selected-local-container";
    const redacted = redactPrivate(label);
    if (redacted.fullyPrivate)
        return "selected-local-container";
    return redacted.text;
}
function sanitizeFileName(value) {
    return redactPrivate(basename(value)).text || "rejected";
}
function countJsonlLines(text) {
    return text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}
function clampInteger(value, min, max) {
    if (!Number.isFinite(value))
        return min;
    return Math.min(max, Math.max(min, Math.trunc(value)));
}
function truncate(value, maxLength) {
    const compact = value.replace(/\s+/g, " ").trim();
    return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength - 1)}…`;
}
//# sourceMappingURL=audit.js.map