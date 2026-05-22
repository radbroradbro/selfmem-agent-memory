import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditLocalContainer, browseLocalContainer } from "../../packages/core/src/index.js";

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

  it("browses selected local memory files with redacted snippets and no raw root path", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "recallweave-local-browse-"));
    const keyLike = `pa-${"B".repeat(44)}`;
    await writeFile(
      join(rootDir, "memories.jsonl"),
      [
        JSON.stringify({ id: "mem_1", kind: "decision", text: "Use local-only write mode." }),
        JSON.stringify({ id: "mem_2", kind: "preference", text: `public <private>hidden</private> ${keyLike}` }),
        JSON.stringify({ id: "mem_3", kind: "secret", text: `<private>fully hidden</private>` }),
      ].join("\n"),
      "utf8",
    );
    await writeFile(join(rootDir, "trace.jsonl"), "{\"event\":\"search\",\"query\":\"local recall\",\"count\":2}\n", "utf8");

    const report = await browseLocalContainer({
      rootDir,
      containerLabel: `agent ${keyLike}`,
      maxItems: 10,
    });
    const serialized = JSON.stringify(report);

    expect(report.mode).toBe("local-container-browse-preview");
    expect(report.writesRealFiles).toBe(false);
    expect(report.rootPathRedacted).toBe(true);
    expect(report.containerLabel).not.toContain(keyLike);
    expect(report.totals.itemsReturned).toBe(3);
    expect(report.totals.skippedPrivate).toBe(1);
    expect(report.totals.redactionCount).toBeGreaterThanOrEqual(2);
    expect(report.items.some((item) => item.summary.includes("Use local-only write mode"))).toBe(true);
    expect(report.items.some((item) => item.event === "search")).toBe(true);
    expect(serialized).not.toContain(rootDir);
    expect(serialized).not.toContain("hidden");
    expect(serialized).not.toContain(keyLike);
  });
});
