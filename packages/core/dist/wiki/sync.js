import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, relative, resolve, sep } from "node:path";
import { lintCompiledWikiVault } from "./compiler.js";
export async function syncCompiledWikiVault(vault, options) {
    const rootDir = resolve(options.rootDir);
    const lint = lintCompiledWikiVault(vault);
    if (lint.length > 0) {
        throw new Error(`Cannot sync wiki vault with lint issues: ${lint.map((issue) => `${issue.code}:${issue.path}`).join(", ")}`);
    }
    const dryRun = options.dryRun ?? false;
    const conflictPolicy = options.conflictPolicy ?? "write_conflict_note";
    const actions = [];
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
                    await mkdir(dirname(conflictTargetPath), { recursive: true });
                    await writeFile(conflictTargetPath, renderConflictNote(file), "utf8");
                }
            }
            else {
                actions.push({ path: file.path, action: "skip_reviewed", kind: file.kind });
            }
            continue;
        }
        actions.push({ path: file.path, action: "write", kind: file.kind });
        if (!dryRun) {
            await mkdir(dirname(targetPath), { recursive: true });
            await writeFile(targetPath, file.contents, "utf8");
        }
    }
    return { ok: true, dryRun, rootDir, actions };
}
function safeTargetPath(rootDir, vaultPath) {
    const targetPath = resolve(rootDir, vaultPath);
    const rel = relative(rootDir, targetPath);
    if (!rel || rel.startsWith("..") || rel.includes(`..${sep}`) || resolve(rootDir, rel) !== targetPath) {
        throw new Error(`Unsafe wiki vault output path: ${vaultPath}`);
    }
    return targetPath;
}
async function readExisting(path) {
    try {
        return await readFile(path, "utf8");
    }
    catch (error) {
        if (typeof error === "object" && error && "code" in error && error.code === "ENOENT")
            return undefined;
        throw error;
    }
}
function isReviewedPage(contents) {
    const frontmatter = extractFrontmatter(contents);
    return Boolean(frontmatter && /^reviewed:\s*true\s*$/m.test(frontmatter));
}
function conflictNotePath(file) {
    const hash = createHash("sha256").update(file.path).update(file.contents).digest("hex").slice(0, 12);
    const leaf = (file.path.split("/").at(-1)?.replace(/\.md$/i, "") || "page").replace(/[^A-Za-z0-9._-]+/g, "-");
    return `wiki/_conflicts/${leaf}-${hash}.md`;
}
function renderConflictNote(file) {
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
function extractFrontmatter(contents) {
    if (!contents.startsWith("---\n"))
        return undefined;
    const end = contents.indexOf("\n---", 4);
    if (end === -1)
        return undefined;
    return contents.slice(4, end);
}
function markdownFence(contents) {
    const runs = [...contents.matchAll(/`{3,}/g)].map((match) => match[0].length);
    const length = Math.max(3, ...runs) + 1;
    return "`".repeat(length);
}
//# sourceMappingURL=sync.js.map