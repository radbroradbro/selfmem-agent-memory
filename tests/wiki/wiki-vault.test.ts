import { describe, expect, it } from "vitest";
import {
  compileNucleusWikiVault,
  lintCompiledWikiVault,
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
});
