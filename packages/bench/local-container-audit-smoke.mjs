import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditLocalContainer } from "../core/dist/index.js";

const rootDir = await mkdtemp(join(tmpdir(), "recallweave-local-container-audit-smoke-"));
const keyLike = `pa-${"A".repeat(44)}`;

await writeFile(join(rootDir, "memories.jsonl"), "{\"kind\":\"decision\",\"text\":\"Use local writes.\"}\n", "utf8");
await writeFile(
  join(rootDir, "raw_events.jsonl"),
  `{"event":"store","text":"public <private>hidden</private> ${keyLike}"}\n`,
  "utf8",
);
await writeFile(join(rootDir, "trace.jsonl"), "{\"event\":\"search\",\"count\":1}\n", "utf8");

const report = await auditLocalContainer({
  rootDir,
  containerLabel: `fixture ${keyLike}`,
});
const serialized = JSON.stringify(report);

assert.equal(report.ok, undefined);
assert.equal(report.mode, "local-container-audit");
assert.equal(report.writesRealFiles, false);
assert.equal(report.rootPathRedacted, true);
assert.equal(report.totals.existingFiles, 3);
assert.equal(report.totals.lines, 3);
assert.ok(report.totals.redactionCount >= 2);
assert.equal(report.health.status, "needs-review");
assert.ok(report.health.reasons.includes("private_or_key_shaped_text_detected"));
assert.doesNotMatch(serialized, /hidden|pa-[A-Z]{10,}/);
assert.doesNotMatch(serialized, new RegExp(rootDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

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
    },
    null,
    2,
  ),
);
