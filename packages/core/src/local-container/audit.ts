import { appendFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
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

const LOCAL_MEMORY_EDIT_OVERLAY_FILE = ".recallweave/local-memory-edits.jsonl";
const LOCAL_MEMORY_MATERIALIZE_AUDIT_FILE = ".recallweave/local-memory-materialize-audit.jsonl";
const LOCAL_MEMORY_BACKUP_DIR = ".recallweave/backups";

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
  overlays?: LocalMemoryEditOverlay[];
}

export interface LocalMemoryEditOverlay {
  action: string;
  reason: string;
  sourceFile: LocalContainerBrowseFileName;
  line: number;
  sourceId?: string;
  createdAt?: string;
  replacementPreview?: string;
  redactionCount: number;
  contentIncluded: boolean;
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
  editOverlay: {
    path: typeof LOCAL_MEMORY_EDIT_OVERLAY_FILE;
    exists: boolean;
    bytes?: number;
    inspectedLines?: number;
    applied: number;
    skippedPrivate: number;
    redactionCount: number;
    skippedReason?: "missing" | "oversize" | "read_error";
  };
  items: LocalContainerBrowseItem[];
  totals: {
    filesInspected: number;
    linesInspected: number;
    itemsReturned: number;
    skippedPrivate: number;
    redactionCount: number;
    editOverlayCount: number;
    editOverlayRedactionCount: number;
  };
}

export interface LocalMemoryMaterializeInput {
  rootDir: string;
  maxFileBytes?: number;
}

export interface LocalMemoryMaterializeReport {
  schemaVersion: 1;
  mode: "local-memory-edit-materialize";
  writesRealFiles: true;
  rootPathRedacted: true;
  sourceFile: "memories.jsonl";
  editOverlay: {
    path: typeof LOCAL_MEMORY_EDIT_OVERLAY_FILE;
    exists: boolean;
    bytes?: number;
    inspectedLines: number;
    skippedReason?: "missing" | "oversize" | "read_error";
  };
  backup: {
    path?: string;
    written: boolean;
  };
  auditLog: {
    path: typeof LOCAL_MEMORY_MATERIALIZE_AUDIT_FILE;
    entriesWritten: number;
  };
  totals: {
    inspectedOverlays: number;
    applied: number;
    replaced: number;
    appended: number;
    suppressed: number;
    skipped: number;
    redactionCount: number;
  };
  actions: Array<{
    action: "replace" | "append_correction" | "suppress";
    sourceFile: "memories.jsonl";
    line: number;
    sourceId?: string;
    reason: string;
    status: "applied" | "skipped";
    skippedReason?: "unsupported_action" | "private_or_key_shaped" | "target_missing" | "parse_error" | "already_materialized";
  }>;
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
  const editOverlay = await readLocalMemoryEditOverlay(input.rootDir, maxFileBytes);
  redactionCount += editOverlay.report.redactionCount;

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
      const overlays = overlaysForItem(item, editOverlay);
      if (overlays.length > 0) item.overlays = overlays;
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

export async function materializeLocalMemoryEdits(input: LocalMemoryMaterializeInput): Promise<LocalMemoryMaterializeReport> {
  const maxFileBytes = input.maxFileBytes ?? 1_000_000;
  const sourceFile = "memories.jsonl";
  const sourcePath = join(input.rootDir, sourceFile);
  const overlayPath = join(input.rootDir, ".recallweave", "local-memory-edits.jsonl");
  const auditPath = join(input.rootDir, ".recallweave", "local-memory-materialize-audit.jsonl");
  const backupRelativePath = join(LOCAL_MEMORY_BACKUP_DIR, `memories-${fileSafeTimestamp(new Date())}.jsonl`);
  const backupPath = join(input.rootDir, backupRelativePath);
  const emptyActions: LocalMemoryMaterializeReport["actions"] = [];

  let sourceSize = 0;
  try {
    const info = await stat(sourcePath);
    if (!info.isFile() || info.size > maxFileBytes) {
      return materializeReport({
        editOverlay: { exists: false, inspectedLines: 0, skippedReason: info.isFile() ? "oversize" : "missing" },
        backupWritten: false,
        actions: emptyActions,
      });
    }
    sourceSize = info.size;
  } catch {
    return materializeReport({
      editOverlay: { exists: false, inspectedLines: 0, skippedReason: "missing" },
      backupWritten: false,
      actions: emptyActions,
    });
  }

  let overlaySize = 0;
  let overlayText = "";
  try {
    const info = await stat(overlayPath);
    if (!info.isFile()) {
      return materializeReport({
        editOverlay: { exists: false, inspectedLines: 0, skippedReason: "missing" },
        backupWritten: false,
        actions: emptyActions,
      });
    }
    overlaySize = info.size;
    if (overlaySize > maxFileBytes) {
      return materializeReport({
        editOverlay: { exists: true, bytes: overlaySize, inspectedLines: 0, skippedReason: "oversize" },
        backupWritten: false,
        actions: emptyActions,
      });
    }
    overlayText = await readFile(overlayPath, "utf8");
  } catch {
    return materializeReport({
      editOverlay: { exists: true, bytes: overlaySize, inspectedLines: 0, skippedReason: "read_error" },
      backupWritten: false,
      actions: emptyActions,
    });
  }

  const sourceText = sourceSize > 0 ? await readFile(sourcePath, "utf8") : "";
  const sourceLines = sourceText
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  const overlayLines = overlayText
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  const actions: LocalMemoryMaterializeReport["actions"] = [];
  const previouslyMaterializedRefs = await readMaterializedOverlayRefs(auditPath, maxFileBytes);
  const appliedOverlayRefs: string[] = [];
  let redactionCount = 0;

  for (const line of overlayLines) {
    const overlay = materializeOverlayFromLine(line);
    redactionCount += overlay.redactionCount;
    if (!overlay.ok) {
      actions.push({
        action: overlay.action,
        sourceFile,
        line: overlay.line,
        reason: overlay.reason,
        status: "skipped",
        skippedReason: overlay.skippedReason,
      });
      continue;
    }

    const overlayRef = stableShortHash(line);
    if (previouslyMaterializedRefs.has(overlayRef)) {
      actions.push(actionFromOverlay(overlay, "skipped", "already_materialized"));
      continue;
    }

    if (overlay.action === "append_correction") {
      sourceLines.push(JSON.stringify(correctionMemoryFromOverlay(overlay)));
      actions.push(actionFromOverlay(overlay, "applied"));
      appliedOverlayRefs.push(overlayRef);
      continue;
    }

    const target = findMemoryLine(sourceLines, overlay);
    if (target.index < 0) {
      actions.push(actionFromOverlay(overlay, "skipped", "target_missing"));
      continue;
    }

    const targetLine = sourceLines[target.index];
    const parsed = targetLine ? parseJsonLine(targetLine) : undefined;
    if (!parsed) {
      actions.push(actionFromOverlay(overlay, "skipped", "parse_error"));
      continue;
    }

    if (overlay.action === "replace") {
      sourceLines[target.index] = JSON.stringify(replaceMemoryText(parsed, overlay));
      actions.push(actionFromOverlay(overlay, "applied"));
      appliedOverlayRefs.push(overlayRef);
      continue;
    }

    if (overlay.action === "suppress") {
      sourceLines[target.index] = JSON.stringify(suppressMemoryText(parsed, overlay));
      actions.push(actionFromOverlay(overlay, "applied"));
      appliedOverlayRefs.push(overlayRef);
      continue;
    }

    actions.push(actionFromOverlay(overlay, "skipped", "unsupported_action"));
  }

  const applied = actions.filter((action) => action.status === "applied").length;
  if (applied > 0) {
    await mkdir(dirname(backupPath), { recursive: true });
    await writeFile(backupPath, sourceText, "utf8");
    await writeFile(sourcePath, `${sourceLines.join("\n")}\n`, "utf8");
  }

  await mkdir(dirname(auditPath), { recursive: true });
  await appendFile(
    auditPath,
    `${JSON.stringify({
      schemaVersion: 1,
      event: "local_memory_materialize",
      createdAt: new Date().toISOString(),
      writesRealFiles: applied > 0,
      sourceFile,
      editOverlayPath: LOCAL_MEMORY_EDIT_OVERLAY_FILE,
      backupPath: applied > 0 ? backupRelativePath : "",
      inspectedOverlays: overlayLines.length,
      applied,
      skipped: actions.length - applied,
      redactionCount,
      appliedOverlayRefs,
      contentIncludedInAudit: false,
    })}\n`,
    "utf8",
  );

  const reportInput: Parameters<typeof materializeReport>[0] = {
    editOverlay: { exists: true, bytes: overlaySize, inspectedLines: overlayLines.length },
    backupWritten: applied > 0,
    actions,
    redactionCount,
  };
  if (applied > 0) reportInput.backupPath = backupRelativePath;
  return materializeReport(reportInput);
}

async function readMaterializedOverlayRefs(auditPath: string, maxFileBytes: number): Promise<Set<string>> {
  const refs = new Set<string>();
  let size = 0;
  try {
    const info = await stat(auditPath);
    if (!info.isFile() || info.size > maxFileBytes) return refs;
    size = info.size;
  } catch {
    return refs;
  }

  try {
    const text = size > 0 ? await readFile(auditPath, "utf8") : "";
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const parsed = parseJsonLine(line);
      const rawRefs = parsed && typeof parsed === "object" ? (parsed as { appliedOverlayRefs?: unknown }).appliedOverlayRefs : undefined;
      if (!Array.isArray(rawRefs)) continue;
      for (const ref of rawRefs) {
        if (typeof ref === "string" && /^[a-f0-9]{8}$/.test(ref)) refs.add(ref);
      }
    }
  } catch {
    return refs;
  }
  return refs;
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

async function readLocalMemoryEditOverlay(
  rootDir: string,
  maxFileBytes: number,
): Promise<{
  report: LocalContainerBrowseReport["editOverlay"];
  byLine: Map<string, LocalMemoryEditOverlay[]>;
  bySourceId: Map<string, LocalMemoryEditOverlay[]>;
}> {
  const path = join(rootDir, ".recallweave", "local-memory-edits.jsonl");
  const empty = (skippedReason: LocalContainerBrowseReport["editOverlay"]["skippedReason"], bytes?: number): {
    report: LocalContainerBrowseReport["editOverlay"];
    byLine: Map<string, LocalMemoryEditOverlay[]>;
    bySourceId: Map<string, LocalMemoryEditOverlay[]>;
  } => {
    const report: LocalContainerBrowseReport["editOverlay"] = {
      path: LOCAL_MEMORY_EDIT_OVERLAY_FILE,
      exists: skippedReason !== "missing",
      applied: 0,
      skippedPrivate: 0,
      redactionCount: 0,
    };
    if (bytes !== undefined) report.bytes = bytes;
    if (skippedReason !== undefined) report.skippedReason = skippedReason;
    return {
      report,
      byLine: new Map(),
      bySourceId: new Map(),
    };
  };

  let size = 0;
  try {
    const info = await stat(path);
    if (!info.isFile()) return empty("missing");
    size = info.size;
  } catch {
    return empty("missing");
  }

  if (size > maxFileBytes) return empty("oversize", size);

  try {
    const text = await readFile(path, "utf8");
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const byLine = new Map<string, LocalMemoryEditOverlay[]>();
    const bySourceId = new Map<string, LocalMemoryEditOverlay[]>();
    let skippedPrivate = 0;
    let redactionCount = 0;
    let applied = 0;

    for (const line of lines) {
      const overlay = overlayFromLine(line);
      if (!overlay) continue;
      redactionCount += overlay.redactionCount;
      if (overlay.redactionCount > 0 && !overlay.contentIncluded && overlay.action !== "suppress") skippedPrivate += 1;
      addOverlay(byLine, `${overlay.sourceFile}:${overlay.line}`, overlay);
      if (overlay.sourceId) addOverlay(bySourceId, `${overlay.sourceFile}:${overlay.sourceId}`, overlay);
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
  } catch {
    return empty("read_error", size);
  }
}

function overlayFromLine(line: string): LocalMemoryEditOverlay | undefined {
  const parsed = parseJsonLine(line);
  if (!parsed) return undefined;
  const sourceFile = safeBrowseFileName(parsed.sourceFile);
  if (!sourceFile) return undefined;
  const lineNumber = clampInteger(Number.parseInt(stringifyScalar(parsed.line), 10), 1, 1_000_000);
  const action = sanitizeScalar(entryValue(parsed, ["action"]) ?? "needs_review") || "needs_review";
  const reason = sanitizeScalar(entryValue(parsed, ["reason"]) ?? "manual_correction") || "manual_correction";
  const sourceId = sanitizeOptionalScalar(entryValue(parsed, ["sourceId"]));
  const createdAt = sanitizeOptionalScalar(entryValue(parsed, ["createdAt"]));
  const replacementValue = entryValue(parsed, ["replacementText"]);
  const replacement = redactPrivate(stringifyScalar(replacementValue));
  const hasReplacement = replacementValue !== undefined && stringifyScalar(replacementValue).trim().length > 0;
  const overlay: LocalMemoryEditOverlay = {
    action,
    reason,
    sourceFile,
    line: lineNumber,
    redactionCount: replacement.redactionCount,
    contentIncluded: hasReplacement && !replacement.fullyPrivate && replacement.text.trim().length > 0 && action !== "suppress",
  };
  if (sourceId) overlay.sourceId = sourceId;
  if (createdAt) overlay.createdAt = createdAt;
  if (overlay.contentIncluded) overlay.replacementPreview = truncate(replacement.text, 180);
  return overlay;
}

function overlaysForItem(
  item: LocalContainerBrowseItem,
  overlays: Awaited<ReturnType<typeof readLocalMemoryEditOverlay>>,
): LocalMemoryEditOverlay[] {
  const matches = [
    ...(overlays.byLine.get(`${item.sourceFile}:${item.line}`) ?? []),
    ...(item.sourceId ? overlays.bySourceId.get(`${item.sourceFile}:${item.sourceId}`) ?? [] : []),
  ];
  const seen = new Set<string>();
  return matches
    .filter((overlay) => {
      const key = `${overlay.sourceFile}:${overlay.line}:${overlay.sourceId ?? ""}:${overlay.action}:${overlay.createdAt ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

function addOverlay(map: Map<string, LocalMemoryEditOverlay[]>, key: string, overlay: LocalMemoryEditOverlay): void {
  const existing = map.get(key) ?? [];
  existing.push(overlay);
  map.set(key, existing);
}

function safeBrowseFileName(value: unknown): LocalContainerBrowseFileName | undefined {
  const name = sanitizeScalar(value);
  return DEFAULT_LOCAL_CONTAINER_BROWSE_FILES.includes(name as LocalContainerBrowseFileName)
    ? (name as LocalContainerBrowseFileName)
    : undefined;
}

type MaterializeOverlay =
  | {
      ok: true;
      action: "replace" | "append_correction" | "suppress";
      sourceFile: "memories.jsonl";
      line: number;
      sourceId?: string;
      reason: string;
      replacementText: string;
      createdAt?: string;
      redactionCount: number;
    }
  | {
      ok: false;
      action: "replace" | "append_correction" | "suppress";
      line: number;
      reason: string;
      redactionCount: number;
      skippedReason: "unsupported_action" | "private_or_key_shaped" | "target_missing" | "parse_error";
    };

function materializeOverlayFromLine(line: string): MaterializeOverlay {
  const parsed = parseJsonLine(line);
  const action = safeMaterializeAction(entryValue(parsed, ["action"]));
  const reason = sanitizeScalar(entryValue(parsed, ["reason"]) ?? "manual_correction") || "manual_correction";
  const lineNumber = clampInteger(Number.parseInt(stringifyScalar(entryValue(parsed, ["line"])), 10), 1, 1_000_000);
  const replacementValue = stringifyScalar(entryValue(parsed, ["replacementText"]));
  const replacement = redactPrivate(replacementValue);
  const redactionCount = replacement.redactionCount;

  if (!parsed || !action) {
    return {
      ok: false,
      action: "replace",
      line: lineNumber,
      reason,
      redactionCount,
      skippedReason: "parse_error",
    };
  }

  const sourceFile = safeBrowseFileName(parsed.sourceFile);
  if (sourceFile !== "memories.jsonl") {
    return {
      ok: false,
      action,
      line: lineNumber,
      reason,
      redactionCount,
      skippedReason: "unsupported_action",
    };
  }

  if (replacement.redacted) {
    return {
      ok: false,
      action,
      line: lineNumber,
      reason,
      redactionCount,
      skippedReason: "private_or_key_shaped",
    };
  }

  const needsReplacement = action === "replace" || action === "append_correction";
  if (needsReplacement && replacement.text.trim().length === 0) {
    return {
      ok: false,
      action,
      line: lineNumber,
      reason,
      redactionCount,
      skippedReason: "target_missing",
    };
  }

  const overlay: MaterializeOverlay = {
    ok: true,
    action,
    sourceFile,
    line: lineNumber,
    reason,
    replacementText: action === "suppress" ? "" : replacement.text.trim(),
    redactionCount,
  };
  const sourceId = sanitizeOptionalScalar(entryValue(parsed, ["sourceId"]));
  const createdAt = sanitizeOptionalScalar(entryValue(parsed, ["createdAt"]));
  if (sourceId) overlay.sourceId = sourceId;
  if (createdAt) overlay.createdAt = createdAt;
  return overlay;
}

function materializeReport(input: {
  editOverlay: Omit<LocalMemoryMaterializeReport["editOverlay"], "path">;
  backupWritten: boolean;
  backupPath?: string;
  actions: LocalMemoryMaterializeReport["actions"];
  redactionCount?: number;
}): LocalMemoryMaterializeReport {
  const applied = input.actions.filter((action) => action.status === "applied");
  const backup: LocalMemoryMaterializeReport["backup"] = { written: input.backupWritten };
  if (input.backupPath) backup.path = input.backupPath;
  return {
    schemaVersion: 1,
    mode: "local-memory-edit-materialize",
    writesRealFiles: true,
    rootPathRedacted: true,
    sourceFile: "memories.jsonl",
    editOverlay: {
      path: LOCAL_MEMORY_EDIT_OVERLAY_FILE,
      ...input.editOverlay,
    },
    backup,
    auditLog: {
      path: LOCAL_MEMORY_MATERIALIZE_AUDIT_FILE,
      entriesWritten: input.editOverlay.exists ? 1 : 0,
    },
    totals: {
      inspectedOverlays: input.editOverlay.inspectedLines,
      applied: applied.length,
      replaced: applied.filter((action) => action.action === "replace").length,
      appended: applied.filter((action) => action.action === "append_correction").length,
      suppressed: applied.filter((action) => action.action === "suppress").length,
      skipped: input.actions.length - applied.length,
      redactionCount: input.redactionCount ?? 0,
    },
    actions: input.actions,
  };
}

function actionFromOverlay(
  overlay: Extract<MaterializeOverlay, { ok: true }>,
  status: "applied" | "skipped",
  skippedReason?: LocalMemoryMaterializeReport["actions"][number]["skippedReason"],
): LocalMemoryMaterializeReport["actions"][number] {
  const action: LocalMemoryMaterializeReport["actions"][number] = {
    action: overlay.action,
    sourceFile: "memories.jsonl",
    line: overlay.line,
    reason: overlay.reason,
    status,
  };
  if (overlay.sourceId) action.sourceId = overlay.sourceId;
  if (skippedReason) action.skippedReason = skippedReason;
  return action;
}

function findMemoryLine(lines: string[], overlay: Extract<MaterializeOverlay, { ok: true }>): { index: number } {
  if (overlay.sourceId) {
    const index = lines.findIndex((line) => sanitizeOptionalScalar(entryValue(parseJsonLine(line), ["id", "sourceId"])) === overlay.sourceId);
    if (index >= 0) return { index };
  }
  const index = overlay.line - 1;
  return index >= 0 && index < lines.length ? { index } : { index: -1 };
}

function replaceMemoryText(entry: Record<string, unknown>, overlay: Extract<MaterializeOverlay, { ok: true }>): Record<string, unknown> {
  return {
    ...entry,
    text: overlay.replacementText,
    updatedAt: new Date().toISOString(),
    materializedEdit: {
      action: overlay.action,
      reason: overlay.reason,
      sourceId: overlay.sourceId ?? "",
      createdAt: overlay.createdAt ?? "",
      contentIncluded: true,
    },
  };
}

function suppressMemoryText(entry: Record<string, unknown>, overlay: Extract<MaterializeOverlay, { ok: true }>): Record<string, unknown> {
  return {
    ...entry,
    text: "[SUPPRESSED_LOCAL_MEMORY]",
    suppressed: true,
    updatedAt: new Date().toISOString(),
    materializedEdit: {
      action: "suppress",
      reason: overlay.reason,
      sourceId: overlay.sourceId ?? "",
      createdAt: overlay.createdAt ?? "",
      contentIncluded: false,
    },
  };
}

function correctionMemoryFromOverlay(overlay: Extract<MaterializeOverlay, { ok: true }>): Record<string, unknown> {
  const baseId = overlay.sourceId || `line-${overlay.line}`;
  return {
    id: `${baseId}-correction-${stableShortHash(`${overlay.replacementText}:${overlay.createdAt ?? ""}`)}`,
    kind: "correction",
    text: overlay.replacementText,
    sourceId: overlay.sourceId ?? "",
    sourceLine: overlay.line,
    createdAt: new Date().toISOString(),
    materializedEdit: {
      action: "append_correction",
      reason: overlay.reason,
      createdAt: overlay.createdAt ?? "",
      contentIncluded: true,
    },
  };
}

function safeMaterializeAction(value: unknown): "replace" | "append_correction" | "suppress" | undefined {
  const action = sanitizeScalar(value);
  return action === "replace" || action === "append_correction" || action === "suppress" ? action : undefined;
}

function fileSafeTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

function stableShortHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
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
