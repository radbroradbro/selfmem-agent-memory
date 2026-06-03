import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { lintCompiledWikiVault, type CompiledWikiVault, type WikiVaultFile } from "./compiler.js";

export interface WikiVaultSyncOptions {
  rootDir: string;
  dryRun?: boolean;
  conflictPolicy?: "skip" | "write_conflict_note";
  auditLogPath?: string;
}

export interface WikiVaultSyncAction {
  path: string;
  action: "write" | "skip_unchanged" | "skip_reviewed" | "write_conflict_note";
  kind: WikiVaultFile["kind"] | "conflict_note";
  conflictPath?: string;
}

export interface WikiVaultSyncReport {
  ok: boolean;
  dryRun: boolean;
  rootDir: string;
  actions: WikiVaultSyncAction[];
  auditLog?: {
    path: string;
    entriesWritten: number;
  };
}

export async function syncCompiledWikiVault(
  vault: CompiledWikiVault,
  options: WikiVaultSyncOptions,
): Promise<WikiVaultSyncReport> {
  const rootDir = resolve(options.rootDir);
  const lint = lintCompiledWikiVault(vault);
  if (lint.length > 0) {
    throw new Error(`Cannot sync wiki vault with lint issues: ${lint.map((issue) => `${issue.code}:${issue.path}`).join(", ")}`);
  }

  const dryRun = options.dryRun ?? false;
  const conflictPolicy = options.conflictPolicy ?? "write_conflict_note";
  const auditLog = createAuditLogger(rootDir, options.auditLogPath, dryRun);
  const actions: WikiVaultSyncAction[] = [];

  for (const file of vault.files) {
    const targetPath = safeTargetPath(rootDir, file.path);
    const existing = await readExisting(targetPath);

    if (existing === file.contents) {
      actions.push({ path: file.path, action: "skip_unchanged", kind: file.kind });
      continue;
    }

    if (existing && file.path.endsWith(".md") && isReviewedPage(existing)) {
      if (conflictPolicy === "write_conflict_note") {
        const conflictPath = conflictNotePath(file);
        const conflictTargetPath = safeTargetPath(rootDir, conflictPath);
        actions.push({ path: file.path, action: "write_conflict_note", kind: "conflict_note", conflictPath });
        if (!dryRun) {
          await auditLog.writeIntent({ path: conflictPath, action: "write_conflict_note", kind: "conflict_note" });
          await mkdir(dirname(conflictTargetPath), { recursive: true });
          await writeFile(conflictTargetPath, renderConflictNote(file), "utf8");
        }
      } else {
        actions.push({ path: file.path, action: "skip_reviewed", kind: file.kind });
      }
      continue;
    }

    actions.push({ path: file.path, action: "write", kind: file.kind });
    if (!dryRun) {
      await auditLog.writeIntent({ path: file.path, action: "write", kind: file.kind });
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, file.contents, "utf8");
    }
  }

  const auditReport = auditLog.report();
  return {
    ok: true,
    dryRun,
    rootDir,
    actions,
    ...(auditReport ? { auditLog: auditReport } : {}),
  };
}

function createAuditLogger(rootDir: string, auditLogPath: string | undefined, dryRun: boolean) {
  let entriesWritten = 0;
  if (!auditLogPath || dryRun) {
    return {
      async writeIntent(_entry: Omit<WikiVaultSyncAction, "conflictPath">) {},
      report() {
        return undefined;
      },
    };
  }

  const targetPath = safeAuditLogPath(rootDir, auditLogPath);
  const publicPath = normalizeAuditLogPath(rootDir, targetPath);

  return {
    async writeIntent(entry: Omit<WikiVaultSyncAction, "conflictPath">) {
      const payload = {
        schemaVersion: 1,
        event: "wiki_vault_sync_write_intent",
        createdAt: new Date().toISOString(),
        path: entry.path,
        action: entry.action,
        kind: entry.kind,
        contentHash: createHash("sha256").update(`${entry.kind}:${entry.action}:${entry.path}`).digest("hex"),
      };
      await mkdir(dirname(targetPath), { recursive: true });
      await appendFile(targetPath, `${JSON.stringify(payload)}\n`, "utf8");
      entriesWritten += 1;
    },
    report() {
      return { path: publicPath, entriesWritten };
    },
  };
}

function safeTargetPath(rootDir: string, vaultPath: string): string {
  const targetPath = resolve(rootDir, vaultPath);
  const rel = relative(rootDir, targetPath);
  if (!rel || rel.startsWith("..") || rel.includes(`..${sep}`) || resolve(rootDir, rel) !== targetPath) {
    throw new Error(`Unsafe wiki vault output path: ${vaultPath}`);
  }
  return targetPath;
}

function safeAuditLogPath(rootDir: string, auditLogPath: string): string {
  const path = auditLogPath.trim();
  if (!path) throw new Error("Audit log path cannot be empty");
  const targetPath = isAbsolute(path) ? resolve(path) : resolve(rootDir, path);
  const rel = relative(rootDir, targetPath);
  if (!rel || rel.startsWith("..") || rel.includes(`..${sep}`) || resolve(rootDir, rel) !== targetPath) {
    throw new Error(`Unsafe wiki vault audit log path: ${auditLogPath}`);
  }
  return targetPath;
}

function normalizeAuditLogPath(rootDir: string, targetPath: string): string {
  return relative(rootDir, targetPath).split(sep).join("/");
}

async function readExisting(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}

function isReviewedPage(contents: string): boolean {
  const frontmatter = extractFrontmatter(contents);
  return Boolean(frontmatter && /^reviewed:\s*true\s*$/m.test(frontmatter));
}

function conflictNotePath(file: WikiVaultFile): string {
  const hash = createHash("sha256").update(file.path).update(file.contents).digest("hex").slice(0, 12);
  const leaf = (file.path.split("/").at(-1)?.replace(/\.md$/i, "") || "page").replace(/[^A-Za-z0-9._-]+/g, "-");
  return `wiki/_conflicts/${leaf}-${hash}.md`;
}

function renderConflictNote(file: WikiVaultFile): string {
  const fence = markdownFence(file.contents);
  return [
    "---",
    `title: ${JSON.stringify(`Sync conflict for ${file.path}`)}`,
    'type: "sync_conflict"',
    'category: "operations"',
    'tags: ["sync", "conflict"]',
    "aliases: []",
    "sources: []",
    "confidence: 1",
    "version: 1",
    "provenance:",
    "  extracted: []",
    "  inferred: []",
    "  ambiguous: []",
    "reviewed: false",
    "---",
    "",
    "# Sync Conflict",
    "",
    `Reviewed page not overwritten: \`${file.path}\`.`,
    "",
    "## Proposed Sanitized Update",
    "",
    `${fence}markdown`,
    file.contents.trim(),
    fence,
    "",
  ].join("\n");
}

function extractFrontmatter(contents: string): string | undefined {
  if (!contents.startsWith("---\n")) return undefined;
  const end = contents.indexOf("\n---", 4);
  if (end === -1) return undefined;
  return contents.slice(4, end);
}

function markdownFence(contents: string): string {
  const runs = [...contents.matchAll(/`{3,}/g)].map((match) => match[0].length);
  const length = Math.max(3, ...runs) + 1;
  return "`".repeat(length);
}
