import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditLocalContainer, browseLocalContainer, materializeLocalMemoryEdits } from "../core/dist/index.js";

const rootDir = await mkdtemp(join(tmpdir(), "recallweave-local-container-audit-smoke-"));
const keyLike = `pa-${"A".repeat(44)}`;

await writeFile(join(rootDir, "memories.jsonl"), "{\"kind\":\"decision\",\"text\":\"Use local writes.\"}\n", "utf8");
await writeFile(
  join(rootDir, "raw_events.jsonl"),
  `{"event":"store","text":"public <private>hidden</private> ${keyLike}"}\n`,
  "utf8",
);
await writeFile(
  join(rootDir, "trace.jsonl"),
  "{\"event\":\"search\",\"count\":1}\n{\"event\":\"store\",\"text\":\"public <private>hidden</private>\"}\n",
  "utf8",
);
await mkdir(join(rootDir, ".recallweave"), { recursive: true });
await writeFile(
  join(rootDir, ".recallweave/local-memory-edits.jsonl"),
  `${JSON.stringify({
    event: "local_memory_edit_overlay",
    sourceFile: "memories.jsonl",
    line: 1,
    action: "replace",
    reason: "manual_correction",
    replacementText: "Use local writes with overlay visibility.",
  })}\n`,
  "utf8",
);

const report = await auditLocalContainer({
  rootDir,
  containerLabel: `fixture ${keyLike}`,
});
const browse = await browseLocalContainer({
  rootDir,
  containerLabel: `fixture ${keyLike}`,
  maxItems: 8,
});
const materialized = await materializeLocalMemoryEdits({ rootDir });
const materializedMemory = await readFile(join(rootDir, "memories.jsonl"), "utf8");
const serialized = JSON.stringify(report);
const browseSerialized = JSON.stringify(browse);
const materializedSerialized = JSON.stringify(materialized);

assert.equal(report.ok, undefined);
assert.equal(report.mode, "local-container-audit");
assert.equal(report.writesRealFiles, false);
assert.equal(report.rootPathRedacted, true);
assert.equal(report.totals.existingFiles, 3);
assert.equal(report.totals.lines, 4);
assert.ok(report.totals.redactionCount >= 2);
assert.equal(report.health.status, "needs-review");
assert.ok(report.health.reasons.includes("private_or_key_shaped_text_detected"));
assert.doesNotMatch(serialized, /hidden|pa-[A-Z]{10,}/);
assert.doesNotMatch(serialized, new RegExp(rootDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.equal(browse.mode, "local-container-browse-preview");
assert.equal(browse.writesRealFiles, false);
assert.equal(browse.rootPathRedacted, true);
assert.ok(browse.items.some((item) => item.summary.includes("Use local writes")));
assert.ok(browse.items.some((item) => item.overlays?.some((overlay) => overlay.replacementPreview?.includes("overlay visibility"))));
assert.ok(browse.items.some((item) => item.event === "search"));
assert.equal(browse.editOverlay.applied, 1);
assert.equal(browse.totals.editOverlayCount, 1);
assert.ok(browse.totals.redactionCount >= 1);
assert.doesNotMatch(browseSerialized, /hidden|pa-[A-Z]{10,}/);
assert.doesNotMatch(browseSerialized, new RegExp(rootDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.equal(materialized.mode, "local-memory-edit-materialize");
assert.equal(materialized.writesRealFiles, true);
assert.equal(materialized.rootPathRedacted, true);
assert.equal(materialized.totals.applied, 1);
assert.equal(materialized.totals.replaced, 1);
assert.equal(materialized.backup.written, true);
assert.match(materializedMemory, /overlay visibility/);
assert.doesNotMatch(materializedSerialized, /overlay visibility|hidden|pa-[A-Z]{10,}/);
assert.doesNotMatch(materializedSerialized, new RegExp(rootDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

console.log(
  JSON.stringify(
    {
      ok: true,
      mode: report.mode,
      writesRealFiles: report.writesRealFiles,
      rootPathRedacted: report.rootPathRedacted,
      existingFiles: report.totals.existingFiles,
      lines: report.totals.lines,
      redactionCount: report.totals.redactionCount,
      status: report.health.status,
      reasons: report.health.reasons,
      browseMode: browse.mode,
      browseItems: browse.totals.itemsReturned,
      browseRedactionCount: browse.totals.redactionCount,
      browseOverlayCount: browse.totals.editOverlayCount,
      materializeApplied: materialized.totals.applied,
      materializeBackup: materialized.backup.written,
    },
    null,
    2,
  ),
);
