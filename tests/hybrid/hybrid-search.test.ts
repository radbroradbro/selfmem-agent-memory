import { describe, expect, it } from "vitest";
import { makeStaticHybridSource, searchHybrid } from "../../packages/core/src/index.js";

describe("hybrid search runtime context", () => {
  it("rehydrates atomic context from matching source chunks without changing ranked ids", async () => {
    const sourceChunkId = "session-123#chunk-001";
    const atomicId = "session-123#atom-001-01";
    const result = await searchHybrid({
      query: "What is the latest Mark Brody demand status?",
      topK: 2,
      ranker: (_query, candidates) => candidates.filter((candidate) => candidate.id === atomicId),
      rankerMode: "fixture-atomic-only",
      sources: [
        makeStaticHybridSource({
          id: "runtime-memory",
          origin: "local",
          candidates: [
            {
              id: sourceChunkId,
              origin: "local",
              score: 0.5,
              text: [
                "Contextual memory: Mark Brody demand",
                "Source excerpt:",
                "In April, Bradley prepared the SOPO financial statement packet for counsel.",
                "In May, Mark Brody sent a follow-up 220 demand that extended the same SOPO records issue.",
              ].join("\n"),
              metadata: {
                kind: "contextual_source_chunk",
                retrievalRole: "source",
                title: "Mark Brody demand",
                topic: "SOPO legal records",
                privatePath: "/Users/private/raw-session.jsonl",
                keyShape: `sk-${"A".repeat(36)}`,
              },
            },
            {
              id: atomicId,
              origin: "local",
              score: 1,
              text: "The latest Mark Brody issue is a May follow-up demand connected to SOPO records.",
              metadata: {
                kind: "atomic_memory",
                retrievalRole: "index",
                sourceChunkId,
                rehydrateId: sourceChunkId,
                parentSessionId: "session-123",
                date: "2026-05-31",
                title: "Mark Brody demand",
                topic: "SOPO legal records",
              },
            },
          ],
        }),
      ],
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.id).toBe(atomicId);
    expect(result.context.citations).toEqual([atomicId]);
    expect(result.context.text).toContain("Atomic match:");
    expect(result.context.text).toContain("Rehydrated source chunk:");
    expect(result.context.text).toContain("April, Bradley prepared the SOPO financial statement packet");
    expect(result.context.text).toContain("In May, Mark Brody sent a follow-up 220 demand");
    expect(result.context.text).toContain("kind=atomic_memory");
    expect(result.context.text).toContain("role=index");
    expect(result.context.text).toContain(`rehydrate=${sourceChunkId}`);
    expect(result.trace.context).toEqual({
      rehydratedAtomicCount: 1,
      missingSourceCount: 0,
    });
    expect(JSON.stringify(result.context)).not.toContain("/Users/private");
    expect(JSON.stringify(result.context)).not.toMatch(/sk-A/);
  });

  it("falls back to atomic text when a rehydration source chunk is missing", async () => {
    const result = await searchHybrid({
      query: "What is the latest Mark Brody demand status?",
      topK: 1,
      sources: [
        makeStaticHybridSource({
          id: "atomic",
          origin: "local",
          candidates: [
            {
              id: "session-123#atom-001-01",
              origin: "local",
              score: 1,
              text: "The latest Mark Brody issue is a May follow-up demand connected to SOPO records.",
              metadata: {
                kind: "atomic_memory",
                retrievalRole: "index",
                sourceChunkId: "session-123#chunk-missing",
                rehydrateId: "session-123#chunk-missing",
              },
            },
          ],
        }),
      ],
    });

    expect(result.context.text).toContain("The latest Mark Brody issue is a May follow-up demand");
    expect(result.context.text).not.toContain("Rehydrated source chunk:");
    expect(result.trace.context).toEqual({
      rehydratedAtomicCount: 0,
      missingSourceCount: 1,
    });
  });

  it("carries atomic provenance into compiled context without unsafe metadata", async () => {
    const result = await searchHybrid({
      query: "What is the latest Mark Brody demand status?",
      topK: 1,
      sources: [
        makeStaticHybridSource({
          id: "atomic",
          origin: "local",
          candidates: [
            {
              id: "session-123#atom-001-01",
              origin: "local",
              score: 1,
              sourceId: "/Users/private/raw-session.jsonl",
              text: "The latest Mark Brody issue is a May follow-up demand connected to SOPO records.",
              metadata: {
                kind: "atomic_memory",
                retrievalRole: "index",
                sourceId: "source-ledger-safe-id",
                date: "2026-05-31",
                eventDate: "May 2026",
                title: "Mark Brody demand",
                topic: "SOPO legal records",
                sourceChunkId: "session-123#chunk-001",
                parentSessionId: "session-123",
                rehydrateId: "session-123#chunk-001",
                privatePath: "/Users/private/raw-session.jsonl",
                keyShape: `AIza${"A".repeat(36)}`,
              },
            },
          ],
        }),
      ],
    });

    expect(result.context.text).toContain("kind=atomic_memory");
    expect(result.context.text).toContain("role=index");
    expect(result.context.text).toContain("title=Mark_Brody_demand");
    expect(result.context.text).toContain("topic=SOPO_legal_records");
    expect(result.context.text).toContain("source=session-123#chunk-001");
    expect(result.context.text).toContain("parent=session-123");
    expect(result.context.text).toContain("rehydrate=session-123#chunk-001");
    expect(JSON.stringify(result.context)).not.toContain("/Users/private");
    expect(JSON.stringify(result.context)).not.toMatch(/AIzaA/);
  });

  it("groups current atomic truth ahead of superseded atomic history", async () => {
    const result = await searchHybrid({
      query: "What is my latest favorite database?",
      topK: 2,
      ranker: (_query, candidates) => candidates.sort((left, right) => right.score - left.score),
      rankerMode: "fixture-current-truth",
      sources: [
        makeStaticHybridSource({
          id: "atomic",
          origin: "local",
          candidates: [
            {
              id: "session-a#atom-old",
              origin: "local",
              score: 0.9,
              text: "Atomic fact: My favorite database is Postgres.",
              metadata: {
                kind: "atomic_memory",
                atomicKind: "preference",
                confidence: "high",
                lifecycleStatus: "superseded",
                validFrom: "2026-05-01",
                validUntil: "2026-05-03",
                supersededBy: "session-c#atom-current",
              },
            },
            {
              id: "session-c#atom-current",
              origin: "local",
              score: 1,
              text: "Atomic fact: I changed my mind; my favorite database is SQLite now.",
              metadata: {
                kind: "atomic_memory",
                atomicKind: "update",
                confidence: "high",
                lifecycleStatus: "current",
                validFrom: "2026-05-03",
                supersedes: ["session-a#atom-old"],
              },
            },
          ],
        }),
      ],
    });

    expect(result.context.text).toContain("Current truth:");
    expect(result.context.text).toContain("update: I changed my mind; my favorite database is SQLite now.");
    expect(result.context.text).toContain("Superseded or historical facts:");
    expect(result.context.text).toContain("preference: My favorite database is Postgres.");
    expect(result.context.text).toContain("status=current");
    expect(result.context.text).toContain("status=superseded");
    expect(result.context.text.indexOf("SQLite")).toBeLessThan(result.context.text.indexOf("Postgres"));
  });

  it("preserves safe metadata source ids when the candidate field is absent", async () => {
    const result = await searchHybrid({
      query: "What status should the source ledger show?",
      topK: 1,
      sources: [
        makeStaticHybridSource({
          id: "source-ledger",
          origin: "local",
          candidates: [
            {
              id: "atom-safe-source",
              origin: "local",
              score: 1,
              text: "The source ledger status is current and source-backed.",
              metadata: {
                kind: "atomic_memory",
                sourceId: "source-ledger-safe-id",
              },
            },
          ],
        }),
      ],
    });

    expect(result.context.text).toContain("source=source-ledger-safe-id");
  });
});
