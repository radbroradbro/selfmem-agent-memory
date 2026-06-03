import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compileNucleusWikiVault, lintCompiledWikiVault } from "../core/dist/index.js";

const fixtureUrl = new URL("../brain-ui/fixtures/nucleus.fixture.json", import.meta.url);
const snapshot = JSON.parse(await readFile(fixtureUrl, "utf8"));
const vault = compileNucleusWikiVault(snapshot);
const serialized = JSON.stringify(vault);
const paths = new Set(vault.files.map((file) => file.path));
const markdownFiles = vault.files.filter((file) => file.path.endsWith(".md"));

assert.equal(lintCompiledWikiVault(vault).length, 0, "compiled wiki vault should lint cleanly");
assert.ok(paths.has("wiki/index.md"));
assert.ok(paths.has("wiki/log.md"));
assert.ok(paths.has("wiki/methodology.md"));
assert.ok(paths.has("nucleus.json"));
assert.ok(paths.has(".manifest.json"));
assert.ok(markdownFiles.length >= 3, "expected markdown wiki files");
assert.ok(markdownFiles.every((file) => file.contents.startsWith("---\n")), "markdown files must have frontmatter");
assert.doesNotMatch(serialized, /<private>|pa-|AIza|sm_|nvapi-|jina_|ghp_|github_pat_|\/Users\//);

console.log(JSON.stringify({
  ok: true,
  fileCount: vault.files.length,
  markdownCount: markdownFiles.length,
  nodeCount: vault.manifest.nodeCount,
  edgeCount: vault.manifest.edgeCount,
  samplePaths: [...paths].slice(0, 8),
}, null, 2));
