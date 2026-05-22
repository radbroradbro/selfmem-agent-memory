import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  compileNucleusWikiVault,
  lintCompiledWikiVault,
  syncCompiledWikiVault,
  type NucleusIndexSnapshot,
} from "../../packages/core/src/index.js";

describe("wiki vault compiler", () => {
  it("compiles a sanitized Nucleus snapshot into Obsidian-style wiki files", () => {
    const snapshot: NucleusIndexSnapshot = {
      schemaVersion: 1,
      generatedAt: "2026-05-22T10:00:00.000Z",
      roots: {
        indexPageId: "wiki:index",
        methodologyPageId: "wiki:methodology",
      },
      nodes: [
        {
          id: "decision:native-memory",
          kind: "decision",
          title: "Use native memory <private>secret agent</private>",
          createdAt: "2026-05-22T09:00:00.000Z",
          updatedAt: "2026-05-22T09:10:00.000Z",
          tags: ["memory", "AIza" + "A".repeat(36)],
          confidence: 0.91,
          metadata: {
            path: "/Users/private/wiki/native-memory.md",
            body: "Use host-native lifecycle hooks and local writes. <private>hidden strategy</private>",
          },
          provenance: [
            {
              sourceId: "source sm_" + "B".repeat(42),
              quote: "public source <private>hidden quote</private>",
              createdAt: "2026-05-22T09:00:00.000Z",
            },
          ],
        },
        {
          id: "research:wiki",
          kind: "research_query",
          title: "How should wiki sync work?",
          createdAt: "2026-05-22T09:05:00.000Z",
          updatedAt: "2026-05-22T09:12:00.000Z",
          tags: ["research"],
          metadata: {
            body: "Compile sanitized Nucleus records into markdown, then lint wikilinks.",
          },
        },
      ],
      edges: [
        {
          id: "edge:research-informs-decision",
          from: "research:wiki",
          to: "decision:native-memory",
          kind: "informs",
          createdAt: "2026-05-22T09:12:00.000Z",
        },
      ],
    };

    const vault = compileNucleusWikiVault(snapshot);
    const serialized = JSON.stringify(vault);

    expect(vault.files.map((file) => file.path)).toContain("wiki/index.md");
    expect(vault.files.map((file) => file.path)).toContain("wiki/log.md");
    expect(vault.files.map((file) => file.path)).toContain("wiki/methodology.md");
    expect(vault.files.map((file) => file.path)).toContain("nucleus.json");
    expect(vault.files.map((file) => file.path)).toContain(".manifest.json");
    const decisionPath = vault.files.find((file) => file.path.startsWith("wiki/decisions/use-native-memory-"))?.path;
    expect(decisionPath).toBeDefined();
    expect(lintCompiledWikiVault(vault)).toEqual([]);

    const decisionPage = vault.files.find((file) => file.path === decisionPath);
    expect(decisionPage?.contents).toContain("reviewed: false");
    expect(decisionPage?.contents).toContain("[[How should wiki sync work?]]");
    expect(decisionPage?.contents).toContain("Use host-native lifecycle hooks");
    expect(decisionPage?.contents).not.toContain("/Users/private");

    expect(serialized).toContain("Use native memory");
    expect(serialized).not.toContain("secret agent");
    expect(serialized).not.toContain("hidden strategy");
    expect(serialized).not.toContain("hidden quote");
    expect(serialized).not.toMatch(/AIzaA/);
    expect(serialized).not.toMatch(/sm_B/);
  });

  it("reports broken wikilinks and unsafe paths in compiled vaults", () => {
    const snapshot: NucleusIndexSnapshot = {
      schemaVersion: 1,
      generatedAt: "2026-05-22T10:00:00.000Z",
      roots: {},
      nodes: [],
      edges: [],
    };
    const vault = compileNucleusWikiVault(snapshot, { includeNucleusJson: false, includeManifest: false });
    vault.files.push({
      path: "/tmp/private.md",
      kind: "wiki_page",
      contents: "---\ntitle: \"Unsafe\"\n---\n\n[[Missing Page]]\n",
    });

    expect(lintCompiledWikiVault(vault).map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["unsafe_path", "broken_wikilink"]),
    );
  });

  it("syncs compiled files to a vault directory without overwriting reviewed pages", async () => {
    const snapshot: NucleusIndexSnapshot = {
      schemaVersion: 1,
      generatedAt: "2026-05-22T10:00:00.000Z",
      roots: {},
      nodes: [
        {
          id: "decision:reviewed-page",
          kind: "decision",
          title: "Reviewed Manual Page",
          createdAt: "2026-05-22T09:00:00.000Z",
          updatedAt: "2026-05-22T09:10:00.000Z",
          metadata: {
            path: "wiki/decisions/reviewed-manual-page.md",
            body: "Generated sanitized update.\n\n```ts\nconst safe = true;\n```",
          },
        },
      ],
      edges: [],
    };

    const vault = compileNucleusWikiVault(snapshot, { includeNucleusJson: false });
    const rootDir = await mkdtemp(join(tmpdir(), "recallweave-wiki-sync-"));
    const reviewedPath = join(rootDir, "wiki/decisions/reviewed-manual-page.md");
    await mkdir(join(rootDir, "wiki/decisions"), { recursive: true });
    await writeFile(
      reviewedPath,
      "---\ntitle: \"Reviewed Manual Page\"\nreviewed: true\n---\n\nHuman-reviewed text stays put.\n",
      "utf8",
    );

    const report = await syncCompiledWikiVault(vault, { rootDir, auditLogPath: ".recallweave/wiki-sync-audit.jsonl" });
    const actions = new Map(report.actions.map((action) => [action.path, action]));

    expect(report.ok).toBe(true);
    expect(report.auditLog?.path).toBe(".recallweave/wiki-sync-audit.jsonl");
    expect(actions.get("wiki/index.md")?.action).toBe("write");
    expect(actions.get("wiki/decisions/reviewed-manual-page.md")?.action).toBe("write_conflict_note");
    await expect(readFile(reviewedPath, "utf8")).resolves.toContain("Human-reviewed text stays put.");

    const conflictPath = actions.get("wiki/decisions/reviewed-manual-page.md")?.conflictPath;
    expect(conflictPath).toMatch(/^wiki\/_conflicts\/reviewed-manual-page-/);
    const conflictNote = await readFile(join(rootDir, conflictPath!), "utf8");
    expect(conflictNote).toContain("Generated sanitized update.");
    expect(conflictNote).toContain("````markdown");
    expect(conflictNote).toContain("````");
    expect(conflictNote).not.toContain("Human-reviewed text stays put.");
    const auditLog = await readFile(join(rootDir, ".recallweave/wiki-sync-audit.jsonl"), "utf8");
    const auditEntries = auditLog.trim().split(/\r?\n/).map((line) => JSON.parse(line));
    expect(report.auditLog?.entriesWritten).toBe(auditEntries.length);
    expect(auditEntries.length).toBe(report.actions.filter((action) => action.action === "write" || action.action === "write_conflict_note").length);
    expect(auditEntries.every((entry) => entry.event === "wiki_vault_sync_write_intent")).toBe(true);
    expect(auditLog).not.toContain(rootDir);
    expect(auditLog).not.toContain("Generated sanitized update.");
  });

  it("keeps dry-runs dry, supports skip policy, and rejects unsafe sync input", async () => {
    const snapshot: NucleusIndexSnapshot = {
      schemaVersion: 1,
      generatedAt: "2026-05-22T10:00:00.000Z",
      roots: {},
      nodes: [
        {
          id: "decision:skip-page",
          kind: "decision",
          title: "Skip Policy Page",
          createdAt: "2026-05-22T09:00:00.000Z",
          updatedAt: "2026-05-22T09:10:00.000Z",
          metadata: {
            path: "wiki/decisions/skip-policy-page.md",
            body: "Generated replacement.",
          },
        },
      ],
      edges: [],
    };
    const vault = compileNucleusWikiVault(snapshot, { includeNucleusJson: false });
    const rootDir = await mkdtemp(join(tmpdir(), "recallweave-wiki-sync-edge-"));

    const dryRun = await syncCompiledWikiVault(vault, { rootDir, dryRun: true });
    expect(dryRun.actions.some((action) => action.action === "write")).toBe(true);
    await expect(readFile(join(rootDir, "wiki/index.md"), "utf8")).rejects.toThrow();

    await mkdir(join(rootDir, "wiki/decisions"), { recursive: true });
    await writeFile(
      join(rootDir, "wiki/decisions/skip-policy-page.md"),
      "---\ntitle: \"Skip Policy Page\"\nreviewed: true\n---\n\nKeep this page.\n",
      "utf8",
    );
    const skipReport = await syncCompiledWikiVault(vault, { rootDir, conflictPolicy: "skip" });
    expect(skipReport.actions.find((action) => action.path === "wiki/decisions/skip-policy-page.md")?.action).toBe("skip_reviewed");
    expect(skipReport.actions.some((action) => action.action === "write_conflict_note")).toBe(false);

    const unsafeVault = compileNucleusWikiVault(snapshot, { includeNucleusJson: false });
    unsafeVault.files.push({
      path: "../escape.md",
      kind: "wiki_page",
      contents: "---\ntitle: \"Escape\"\n---\n\nNope.\n",
    });
    await expect(syncCompiledWikiVault(unsafeVault, { rootDir })).rejects.toThrow(/lint issues/);
  });
});
