import { readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { redactPrivate } from "../redaction/private.js";

export const DEFAULT_LOCAL_CONTAINER_AUDIT_FILES = [
  "memories.jsonl",
  "raw_events.jsonl",
  "lossless_context.jsonl",
  "trace.jsonl",
] as const;

export type LocalContainerAuditFileName = (typeof DEFAULT_LOCAL_CONTAINER_AUDIT_FILES)[number];

export const DEFAULT_LOCAL_CONTAINER_BROWSE_FILES = [
  "memories.jsonl",
  "trace.jsonl",
  "lossless_context.jsonl",
] as const;

export type LocalContainerBrowseFileName = (typeof DEFAULT_LOCAL_CONTAINER_BROWSE_FILES)[number];

export interface LocalContainerAuditInput {
  rootDir: string;
  containerLabel?: string;
  maxFileBytes?: number;
  inspectFiles?: readonly string[];
}

export interface LocalContainerAuditFile {
  name: string;
  exists: boolean;
  bytes?: number;
  lineCount?: number;
  redactionCount?: number;
  skippedReason?: "missing" | "unsafe_name" | "oversize" | "read_error";
}

export interface LocalContainerAuditReport {
  schemaVersion: 1;
  mode: "local-container-audit";
  writesRealFiles: false;
  rootPathRedacted: true;
  containerLabel: string;
  maxFileBytes: number;
  files: LocalContainerAuditFile[];
  totals: {
    existingFiles: number;
    inspectedFiles: number;
    bytes: number;
    lines: number;
    redactionCount: number;
    skippedFiles: number;
  };
  health: {
    status: "healthy" | "needs-review";
    reasons: string[];
  };
}

export interface LocalContainerBrowseInput {
  rootDir: string;
  containerLabel?: string;
  maxFileBytes?: number;
  maxItems?: number;
  inspectFiles?: readonly string[];
}

export interface LocalContainerBrowseItem {
  sourceFile: LocalContainerBrowseFileName;
  line: number;
  kind: string;
  event?: string;
  sourceId?: string;
  summary: string;
  redactionCount: number;
}

export interface LocalContainerBrowseReport {
  schemaVersion: 1;
  mode: "local-container-browse-preview";
  writesRealFiles: false;
  rootPathRedacted: true;
  containerLabel: string;
  maxFileBytes: number;
  maxItems: number;
  files: Array<{
    name: string;
    exists: boolean;
    bytes?: number;
    inspectedLines?: number;
    skippedReason?: "missing" | "unsafe_name" | "oversize" | "read_error";
  }>;
  items: LocalContainerBrowseItem[];
  totals: {
    filesInspected: number;
    linesInspected: number;
    itemsReturned: number;
    skippedPrivate: number;
    redactionCount: number;
  };
}

export async function auditLocalContainer(input: LocalContainerAuditInput): Promise<LocalContainerAuditReport> {
  const maxFileBytes = input.maxFileBytes ?? 1_000_000;
  const inspectFiles = input.inspectFiles ?? DEFAULT_LOCAL_CONTAINER_AUDIT_FILES;
  const files: LocalContainerAuditFile[] = [];

  for (const fileName of inspectFiles) {
    files.push(await auditFile(input.rootDir, fileName, maxFileBytes));
  }

  const totals = files.reduce(
    (acc, file) => {
      if (file.exists) acc.existingFiles += 1;
      if (file.exists && !file.skippedReason) acc.inspectedFiles += 1;
      acc.bytes += file.bytes ?? 0;
      acc.lines += file.lineCount ?? 0;
      acc.redactionCount += file.redactionCount ?? 0;
      if (file.skippedReason && file.skippedReason !== "missing") acc.skippedFiles += 1;
      return acc;
    },
    {
      existingFiles: 0,
      inspectedFiles: 0,
      bytes: 0,
      lines: 0,
      redactionCount: 0,
      skippedFiles: 0,
    },
  );
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

export async function browseLocalContainer(input: LocalContainerBrowseInput): Promise<LocalContainerBrowseReport> {
  const maxFileBytes = input.maxFileBytes ?? 256_000;
  const maxItems = clampInteger(input.maxItems ?? 12, 1, 50);
  const inspectFiles = input.inspectFiles ?? DEFAULT_LOCAL_CONTAINER_BROWSE_FILES;
  const files: LocalContainerBrowseReport["files"] = [];
  const items: LocalContainerBrowseItem[] = [];
  let linesInspected = 0;
  let skippedPrivate = 0;
  let redactionCount = 0;

  for (const fileName of inspectFiles) {
    const name = basename(fileName);
    if (name !== fileName || !DEFAULT_LOCAL_CONTAINER_BROWSE_FILES.includes(name as LocalContainerBrowseFileName)) {
      files.push({ name: sanitizeFileName(fileName), exists: false, skippedReason: "unsafe_name" });
      continue;
    }

    const file = await readBrowseFile(input.rootDir, name as LocalContainerBrowseFileName, maxFileBytes);
    files.push(file.report);
    if (!file.text) continue;

    const lines = file.text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    linesInspected += lines.length;
    for (const [index, line] of lines.entries()) {
      if (items.length >= maxItems) break;
      const item = browseItemFromLine(name as LocalContainerBrowseFileName, index + 1, line);
      redactionCount += item.redactionCount;
      if (!item.summary) {
        skippedPrivate += 1;
        continue;
      }
      items.push(item);
    }
    if (items.length >= maxItems) break;
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
    items,
    totals: {
      filesInspected: files.filter((file) => file.exists && !file.skippedReason).length,
      linesInspected,
      itemsReturned: items.length,
      skippedPrivate,
      redactionCount,
    },
  };
}

async function auditFile(rootDir: string, fileName: string, maxFileBytes: number): Promise<LocalContainerAuditFile> {
  const name = basename(fileName);
  if (name !== fileName || !DEFAULT_LOCAL_CONTAINER_AUDIT_FILES.includes(name as LocalContainerAuditFileName)) {
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
  } catch {
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
  } catch {
    return { name, exists: true, bytes: size, skippedReason: "read_error" };
  }
}

async function readBrowseFile(
  rootDir: string,
  name: LocalContainerBrowseFileName,
  maxFileBytes: number,
): Promise<{
  report: LocalContainerBrowseReport["files"][number];
  text?: string;
}> {
  const path = join(rootDir, name);
  let size = 0;
  try {
    const info = await stat(path);
    if (!info.isFile()) {
      return { report: { name, exists: false, skippedReason: "missing" } };
    }
    size = info.size;
  } catch {
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
  } catch {
    return { report: { name, exists: true, bytes: size, skippedReason: "read_error" } };
  }
}

function browseItemFromLine(sourceFile: LocalContainerBrowseFileName, line: number, rawLine: string): LocalContainerBrowseItem {
  const parsed = parseJsonLine(rawLine);
  const redaction = redactPrivate(summarizeEntry(parsed ?? rawLine));
  const item: LocalContainerBrowseItem = {
    sourceFile,
    line,
    kind: sanitizeScalar(entryValue(parsed, ["kind", "type"]) ?? sourceFile.replace(/\.jsonl$/, "")),
    summary: redaction.fullyPrivate ? "" : truncate(redaction.text, 280),
    redactionCount: redaction.redactionCount,
  };
  const event = sanitizeOptionalScalar(entryValue(parsed, ["event", "hook", "action"]));
  if (event) item.event = event;
  const sourceId = sanitizeOptionalScalar(entryValue(parsed, ["id", "memoryId", "sourceId", "sessionId"]));
  if (sourceId) item.sourceId = sourceId;
  return item;
}

function parseJsonLine(line: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(line);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function summarizeEntry(entry: Record<string, unknown> | string): string {
  if (typeof entry === "string") return entry;
  const direct = entryValue(entry, ["text", "content", "summary", "message", "query", "title"]);
  if (direct !== undefined) return stringifyScalar(direct);

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

function entryValue(entry: Record<string, unknown> | undefined, keys: string[]): unknown {
  if (!entry) return undefined;
  for (const key of keys) {
    const value = entry[key];
    if (value !== undefined && value !== null && stringifyScalar(value).trim()) return value;
  }
  return undefined;
}

function stringifyScalar(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(stringifyScalar).filter(Boolean).join(", ");
  if (typeof value === "object" && value) return JSON.stringify(value);
  return "";
}

function sanitizeOptionalScalar(value: unknown): string | undefined {
  const safe = sanitizeScalar(value);
  return safe || undefined;
}

function sanitizeScalar(value: unknown): string {
  const redacted = redactPrivate(stringifyScalar(value));
  return redacted.fullyPrivate ? "" : truncate(redacted.text, 96);
}

function healthReasons(files: LocalContainerAuditFile[], totals: LocalContainerAuditReport["totals"]): string[] {
  const reasons: string[] = [];
  if (totals.existingFiles === 0) reasons.push("no_known_container_files");
  if (totals.redactionCount > 0) reasons.push("private_or_key_shaped_text_detected");
  if (files.some((file) => file.skippedReason === "oversize")) reasons.push("file_exceeds_safe_audit_size");
  if (files.some((file) => file.skippedReason === "read_error")) reasons.push("file_read_error");
  if (files.some((file) => file.skippedReason === "unsafe_name")) reasons.push("unsafe_audit_file_name_rejected");
  return reasons;
}

function sanitizeContainerLabel(value: string | undefined): string {
  const label = value?.trim() || "selected-local-container";
  const redacted = redactPrivate(label);
  if (redacted.fullyPrivate) return "selected-local-container";
  return redacted.text;
}

function sanitizeFileName(value: string): string {
  return redactPrivate(basename(value)).text || "rejected";
}

function countJsonlLines(text: string): number {
  return text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function truncate(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength - 1)}…`;
}
