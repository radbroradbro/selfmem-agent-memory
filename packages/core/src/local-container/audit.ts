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
