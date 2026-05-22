import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { compileNucleusWikiVault, syncCompiledWikiVault } from "../core/dist/index.js";

const fixturePath = fileURLToPath(new URL("../brain-ui/fixtures/nucleus.fixture.json", import.meta.url));
const snapshot = JSON.parse(await readFile(fixturePath, "utf8"));
const vault = compileNucleusWikiVault(snapshot);
const rootDir = await mkdtemp(join(tmpdir(), "recallweave-wiki-vault-sync-"));

const reviewedFile = vault.files.find((file) => file.path.endsWith(".md") && file.kind === "wiki_page");
assert.ok(reviewedFile, "fixture should include at least one wiki page");
const reviewedPath = join(rootDir, reviewedFile.path);
await mkdir(join(rootDir, reviewedFile.path.split("/").slice(0, -1).join("/")), { recursive: true });
await writeFile(
  reviewedPath,
  "---\ntitle: \"Fixture Reviewed Page\"\nreviewed: true\n---\n\nHuman-reviewed fixture page remains unchanged.\n",
  "utf8",
);

const dryRun = await syncCompiledWikiVault(vault, { rootDir, dryRun: true });
assert.equal(dryRun.dryRun, true);
assert.ok(dryRun.actions.some((action) => action.action === "write_conflict_note"));

const report = await syncCompiledWikiVault(vault, { rootDir, auditLogPath: ".recallweave/wiki-sync-audit.jsonl" });
const unchangedReviewed = await readFile(reviewedPath, "utf8");
assert.match(unchangedReviewed, /Human-reviewed fixture page remains unchanged/);
assert.ok(report.actions.some((action) => action.action === "write"));
const conflict = report.actions.find((action) => action.action === "write_conflict_note");
assert.ok(conflict?.conflictPath);
const conflictNote = await readFile(join(rootDir, conflict.conflictPath), "utf8");
assert.match(conflictNote, /Proposed Sanitized Update/);
const auditLog = await readFile(join(rootDir, ".recallweave/wiki-sync-audit.jsonl"), "utf8");
assert.equal(report.auditLog?.path, ".recallweave/wiki-sync-audit.jsonl");
assert.equal(report.auditLog?.entriesWritten, report.actions.filter((action) => action.action === "write" || action.action === "write_conflict_note").length);
assert.match(auditLog, /wiki_vault_sync_write_intent/);
assert.doesNotMatch(auditLog, new RegExp(rootDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.doesNotMatch(JSON.stringify({ report, conflictNote, auditLog }), /<private>|pa-|AIza|sm_|nvapi-|jina_|ghp_|github_pat_/);

console.log(JSON.stringify({
  ok: true,
  rootDir,
  fileCount: vault.files.length,
  writeCount: report.actions.filter((action) => action.action === "write").length,
  conflictCount: report.actions.filter((action) => action.action === "write_conflict_note").length,
  auditEntries: report.auditLog.entriesWritten,
  dryRunCovered: dryRun.dryRun,
}, null, 2));
