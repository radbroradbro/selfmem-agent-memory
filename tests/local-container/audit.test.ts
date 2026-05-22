import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditLocalContainer } from "../../packages/core/src/index.js";

describe("local container audit", () => {
  it("summarizes known local memory files without returning raw content or paths", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "recallweave-local-audit-"));
    const keyLike = `sm_${"A".repeat(42)}`;
    await writeFile(join(rootDir, "memories.jsonl"), "{\"kind\":\"decision\",\"text\":\"local-only write mode\"}\n", "utf8");
    await writeFile(
      join(rootDir, "raw_events.jsonl"),
      `{"event":"store","text":"public <private>hidden</private> ${keyLike}"}\n`,
      "utf8",
    );
    await writeFile(join(rootDir, "trace.jsonl"), "{\"event\":\"search\",\"count\":2}\n", "utf8");

    const report = await auditLocalContainer({
      rootDir,
      containerLabel: `agent ${keyLike}`,
    });
    const serialized = JSON.stringify(report);

    expect(report.mode).toBe("local-container-audit");
    expect(report.writesRealFiles).toBe(false);
    expect(report.rootPathRedacted).toBe(true);
    expect(report.containerLabel).not.toContain(keyLike);
    expect(report.totals.existingFiles).toBe(3);
    expect(report.totals.lines).toBe(3);
    expect(report.totals.redactionCount).toBeGreaterThanOrEqual(2);
    expect(report.health.status).toBe("needs-review");
    expect(report.health.reasons).toContain("private_or_key_shaped_text_detected");
    expect(serialized).not.toContain(rootDir);
    expect(serialized).not.toContain("hidden");
    expect(serialized).not.toContain(keyLike);
    expect(serialized).not.toContain("local-only write mode");
  });

  it("rejects unsafe file names and oversize reads in the report", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "recallweave-local-audit-edge-"));
    await writeFile(join(rootDir, "memories.jsonl"), "{}\n{}\n", "utf8");

    const report = await auditLocalContainer({
      rootDir,
      maxFileBytes: 1,
      inspectFiles: ["memories.jsonl", "../escape.jsonl"],
    });

    expect(report.files.find((file) => file.name === "memories.jsonl")?.skippedReason).toBe("oversize");
    expect(report.files.some((file) => file.skippedReason === "unsafe_name")).toBe(true);
    expect(report.health.status).toBe("needs-review");
    expect(report.health.reasons).toContain("file_exceeds_safe_audit_size");
    expect(report.health.reasons).toContain("unsafe_audit_file_name_rejected");
  });
});
