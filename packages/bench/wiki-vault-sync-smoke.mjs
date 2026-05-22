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

const report = await syncCompiledWikiVault(vault, { rootDir });
const unchangedReviewed = await readFile(reviewedPath, "utf8");
assert.match(unchangedReviewed, /Human-reviewed fixture page remains unchanged/);
assert.ok(report.actions.some((action) => action.action === "write"));
const conflict = report.actions.find((action) => action.action === "write_conflict_note");
assert.ok(conflict?.conflictPath);
const conflictNote = await readFile(join(rootDir, conflict.conflictPath), "utf8");
assert.match(conflictNote, /Proposed Sanitized Update/);
assert.doesNotMatch(JSON.stringify({ report, conflictNote }), /<private>|pa-|AIza|sm_|nvapi-|jina_|ghp_|github_pat_/);

console.log(JSON.stringify({
  ok: true,
  rootDir,
  fileCount: vault.files.length,
  writeCount: report.actions.filter((action) => action.action === "write").length,
  conflictCount: report.actions.filter((action) => action.action === "write_conflict_note").length,
  dryRunCovered: dryRun.dryRun,
}, null, 2));
