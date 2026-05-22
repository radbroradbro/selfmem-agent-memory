import { describe, expect, it } from "vitest";
import {
  createNucleusRetrievalTraceNode,
  createResearchLineageNodes,
  sanitizeNucleusSnapshot,
  type NucleusIndexSnapshot,
} from "../../packages/core/src/nucleus/index.js";

describe("nucleus index", () => {
  it("redacts private and key-shaped content from public snapshots", () => {
    const snapshot: NucleusIndexSnapshot = {
      schemaVersion: 1,
      generatedAt: "2026-05-22T08:00:00.000Z",
      roots: {
        indexPageId: "wiki/index",
      },
      nodes: [
        {
          id: "memory-1",
          kind: "memory",
          title: "public title <private>secret title</private>",
          createdAt: "2026-05-22T08:00:00.000Z",
          updatedAt: "2026-05-22T08:00:00.000Z",
          containerTag: "container sm_" + "A".repeat(42),
          tags: ["public", "AIza" + "B".repeat(36)],
          provenance: [
            {
              sourceId: "source pa-" + "C".repeat(44),
              quote: "keep public <private>hidden quote</private>",
              createdAt: "2026-05-22T08:00:00.000Z",
            },
          ],
          metadata: {
            note: "token nvapi-" + "D".repeat(34),
            nested: ["safe", "jina_" + "E".repeat(34)],
          },
        },
      ],
      edges: [
        {
          id: "edge-1",
          from: "memory-1",
          to: "wiki-1",
          kind: "derived_from",
          createdAt: "2026-05-22T08:00:00.000Z",
          metadata: {
            reason: "mentions <private>private project</private> public project",
          },
        },
      ],
    };

    const sanitized = sanitizeNucleusSnapshot(snapshot);
    const serialized = JSON.stringify(sanitized);

    expect(serialized).toContain("public");
    expect(serialized).not.toContain("secret title");
    expect(serialized).not.toContain("hidden quote");
    expect(serialized).not.toContain("private project");
    expect(serialized).not.toMatch(/sm_A/);
    expect(serialized).not.toMatch(/AIzaB/);
    expect(serialized).not.toMatch(/pa-C/);
    expect(serialized).not.toMatch(/nvapi-D/);
    expect(serialized).not.toMatch(/jina_E/);
  });

  it("creates retrieval trace nodes that expose hybrid channel coverage", () => {
    const node = createNucleusRetrievalTraceNode({
      id: "trace-1",
      createdAt: "2026-05-22T08:00:00.000Z",
      trace: {
        query: "project decision",
        channels: [
          { name: "dense", candidateIds: ["a", "b"], elapsedMs: 8 },
          { name: "sparse", candidateIds: ["b", "c"], elapsedMs: 4 },
          { name: "graph", candidateIds: ["d"], elapsedMs: 2 },
          { name: "temporal", candidateIds: ["a"], elapsedMs: 1 },
        ],
        fusion: [],
        rerank: [{ id: "a", beforeRank: 2, afterRank: 1, score: 0.91 }],
        amplification: [],
      },
    });

    expect(node.kind).toBe("retrieval_trace");
    expect(node.tags).toContain("hybrid-search");
    expect(node.metadata).toMatchObject({
      channels: "dense, sparse, graph, temporal",
      candidateCount: 4,
      rerankCount: 1,
    });
  });

  it("models research lineage without leaking private query or source content", () => {
    const lineage = createResearchLineageNodes({
      id: "research-1",
      query: "should we use <private>secret vendor</private> graph memory?",
      createdAt: "2026-05-22T08:00:00.000Z",
      updatedAt: "2026-05-22T09:00:00.000Z",
      status: "testing",
      hypothesis: "typed graph links improve multi-hop recall",
      pros: ["better provenance", "source quote <private>hidden</private>"],
      cons: ["more maintenance"],
      sourceRefs: [
        {
          sourceId: "source sm_" + "A".repeat(42),
          quote: "public claim <private>private quote</private>",
          createdAt: "2026-05-22T08:00:00.000Z",
        },
      ],
      decision: "test graph links on fixture corpus before production",
      nextQuestions: ["which lifecycle events should emit graph edges?"],
    });

    const serialized = JSON.stringify(lineage);

    expect(lineage.queryNode.kind).toBe("research_query");
    expect(lineage.hypothesisNode.kind).toBe("hypothesis");
    expect(lineage.decisionNode?.kind).toBe("decision");
    expect(lineage.edges.map((edge) => edge.kind)).toEqual(["answers", "informs"]);
    expect(serialized).toContain("typed graph links");
    expect(serialized).not.toContain("secret vendor");
    expect(serialized).not.toContain("hidden");
    expect(serialized).not.toMatch(/sm_A/);
  });
});
