import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditLocalContainer, browseLocalContainer, materializeLocalMemoryEdits } from "../../packages/core/src/index.js";

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
    await mkdir(join(rootDir, ".recallweave"), { recursive: true });
    await writeFile(
      join(rootDir, ".recallweave/local-memory-edits.jsonl"),
      [
        JSON.stringify({
          event: "local_memory_edit_overlay",
          sourceFile: "memories.jsonl",
          line: 1,
          sourceId: "mem_1",
          action: "replace",
          reason: "manual_correction",
          replacementText: "Use overlay-corrected local-only write mode.",
        }),
        JSON.stringify({
          event: "local_memory_edit_overlay",
          sourceFile: "memories.jsonl",
          line: 2,
          sourceId: "mem_2",
          action: "replace",
          reason: "privacy",
          replacementText: `safe ${keyLike}`,
        }),
      ].join("\n"),
      "utf8",
    );

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
    expect(report.editOverlay.exists).toBe(true);
    expect(report.editOverlay.applied).toBe(2);
    expect(report.totals.editOverlayCount).toBe(2);
    expect(report.totals.editOverlayRedactionCount).toBeGreaterThanOrEqual(1);
    expect(report.items.some((item) => item.summary.includes("Use local-only write mode"))).toBe(true);
    expect(report.items.some((item) => item.overlays?.some((overlay) => overlay.replacementPreview?.includes("overlay-corrected")))).toBe(true);
    expect(report.items.some((item) => item.event === "search")).toBe(true);
    expect(serialized).not.toContain(rootDir);
    expect(serialized).not.toContain("hidden");
    expect(serialized).not.toContain(keyLike);
  });

  it("materializes safe local edit overlays with backup and content-free audit", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "recallweave-local-materialize-"));
    const keyLike = `sm_${"C".repeat(42)}`;
    await writeFile(
      join(rootDir, "memories.jsonl"),
      [
        JSON.stringify({ id: "mem_1", kind: "decision", text: "old fixture memory text" }),
        JSON.stringify({ id: "mem_2", kind: "preference", text: "keep fixture memory text" }),
      ].join("\n"),
      "utf8",
    );
    await mkdir(join(rootDir, ".recallweave"), { recursive: true });
    await writeFile(
      join(rootDir, ".recallweave/local-memory-edits.jsonl"),
      [
        JSON.stringify({
          event: "local_memory_edit_overlay",
          sourceFile: "memories.jsonl",
          line: 1,
          sourceId: "mem_1",
          action: "replace",
          reason: "manual_correction",
          replacementText: "new fixture memory text",
        }),
        JSON.stringify({
          event: "local_memory_edit_overlay",
          sourceFile: "memories.jsonl",
          line: 2,
          sourceId: "mem_2",
          action: "append_correction",
          reason: "manual_correction",
          replacementText: "appended fixture correction",
        }),
        JSON.stringify({
          event: "local_memory_edit_overlay",
          sourceFile: "memories.jsonl",
          line: 2,
          sourceId: "mem_2",
          action: "replace",
          reason: "privacy",
          replacementText: `public ${keyLike}`,
        }),
      ].join("\n"),
      "utf8",
    );

    const report = await materializeLocalMemoryEdits({ rootDir });
    const memoryText = await readFile(join(rootDir, "memories.jsonl"), "utf8");
    const auditText = await readFile(join(rootDir, ".recallweave/local-memory-materialize-audit.jsonl"), "utf8");
    const serialized = JSON.stringify(report);
    const rerunReport = await materializeLocalMemoryEdits({ rootDir });
    const rerunMemoryText = await readFile(join(rootDir, "memories.jsonl"), "utf8");

    expect(report.mode).toBe("local-memory-edit-materialize");
    expect(report.writesRealFiles).toBe(true);
    expect(report.rootPathRedacted).toBe(true);
    expect(report.backup.written).toBe(true);
    expect(report.backup.path).toMatch(/^\.recallweave\/backups\/memories-/);
    expect(report.auditLog.entriesWritten).toBe(1);
    expect(report.totals.inspectedOverlays).toBe(3);
    expect(report.totals.applied).toBe(2);
    expect(report.totals.replaced).toBe(1);
    expect(report.totals.appended).toBe(1);
    expect(report.totals.skipped).toBe(1);
    expect(report.totals.redactionCount).toBeGreaterThanOrEqual(1);
    expect(report.actions.some((action) => action.skippedReason === "private_or_key_shaped")).toBe(true);
    expect(memoryText).toContain("new fixture memory text");
    expect(memoryText).toContain("appended fixture correction");
    expect(memoryText).not.toContain(keyLike);
    expect(auditText).toContain("local_memory_materialize");
    expect(auditText).not.toContain("new fixture memory text");
    expect(auditText).not.toContain("appended fixture correction");
    expect(serialized).not.toContain(rootDir);
    expect(serialized).not.toContain(keyLike);
    expect(serialized).not.toContain("new fixture memory text");
    expect(rerunReport.totals.applied).toBe(0);
    expect(rerunReport.actions.some((action) => action.skippedReason === "already_materialized")).toBe(true);
    expect(rerunMemoryText).toBe(memoryText);
  });
});
