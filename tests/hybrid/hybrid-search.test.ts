import { describe, expect, it } from "vitest";
import { makeStaticHybridSource, searchHybrid } from "../../packages/core/src/index.js";

describe("hybrid search runtime context", () => {
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
