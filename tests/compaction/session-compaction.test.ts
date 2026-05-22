import { describe, expect, it } from "vitest";
import { compactSession } from "../../packages/core/src/compaction/session.js";

describe("session compaction", () => {
  it("extracts chronological durable memories and redacts private content", () => {
    const result = compactSession({
      sessionId: "fixture-session",
      source: "codex",
      startedAt: "2026-05-22T08:00:00.000Z",
      events: [
        {
          id: "e1",
          role: "user",
          timestamp: "2026-05-22T08:01:00.000Z",
          content: "ok lol",
        },
        {
          id: "e2",
          role: "user",
          timestamp: "2026-05-22T08:02:00.000Z",
          content: "Decision: use RecallWeave local writes as default and keep hosted Supermemory read-only.",
        },
        {
          id: "e3",
          role: "assistant",
          timestamp: "2026-05-22T08:03:00.000Z",
          content: "Fix: patched the memory plugin and verified smoke tests passed with <private>secret</private> hidden.",
        },
        {
          id: "e4",
          role: "user",
          timestamp: "2026-05-22T08:04:00.000Z",
          content: "Spring 2026 law school notes and course outlines are over; remember only high-level class context.",
        },
        {
          id: "e5",
          role: "system",
          timestamp: "2026-05-22T08:05:00.000Z",
          content: "<private>only private</private>",
        },
      ],
    });

    const serialized = JSON.stringify(result);

    expect(result.metrics.inputEvents).toBe(5);
    expect(result.metrics.skippedFullyPrivate).toBe(1);
    expect(result.metrics.chronological).toBe(true);
    expect(result.metrics.outputCandidates).toBeGreaterThanOrEqual(3);
    expect(result.metrics.noiseReductionRatio).toBeGreaterThan(0);
    expect(serialized).not.toContain("secret");
    expect(result.candidates.map((candidate) => candidate.kind)).toContain("decision");
    expect(result.candidates.map((candidate) => candidate.kind)).toContain("fix");
    expect(result.candidates.some((candidate) => candidate.stale)).toBe(true);
    expect(result.candidates.find((candidate) => candidate.stale)?.text).toContain("stale background");

    const ids = result.candidates.map((candidate) => candidate.id).join(" ");
    expect(result.candidates.every((candidate) => /^compact:[a-f0-9]{24}$/.test(candidate.id))).toBe(true);
    for (const candidate of result.candidates) {
      expect(ids).not.toContain(Buffer.from(candidate.text).toString("base64url").slice(0, 10));
      expect(ids).not.toContain(Buffer.from(`${candidate.kind}:${candidate.text}`).toString("base64url").slice(0, 10));
    }
  });

  it("supports caller-provided stale rules without hardwiring one user context", () => {
    const result = compactSession({
      sessionId: "custom-stale-rule",
      source: "claude",
      startedAt: "2026-05-22T08:00:00.000Z",
      staleRules: [
        {
          id: "archived-project",
          pattern: /\bArchived Project Atlas\b/i,
          detailPattern: /\b(notes|archive)\b/i,
          replacementText: "Archived Project Atlas is stale background. Keep only strategic context.",
        },
      ],
      events: [
        {
          id: "e1",
          role: "user",
          timestamp: "2026-05-22T08:01:00.000Z",
          content: "Archived Project Atlas notes are historical archive material.",
        },
      ],
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.stale).toBe(true);
    expect(result.candidates[0]?.text).toBe("Archived Project Atlas is stale background. Keep only strategic context.");
    expect(result.candidates[0]?.reasons).toContain("stale:archived-project");
  });

  it("treats explicit Fix labels as fixes even when other durable patterns appear", () => {
    const result = compactSession({
      sessionId: "explicit-fix-label",
      source: "hermes",
      startedAt: "2026-05-22T08:00:00.000Z",
      events: [
        {
          id: "e1",
          role: "assistant",
          timestamp: "2026-05-22T08:01:00.000Z",
          content: "Fix: preserve exact identifier RW-4827 during memory update checks.",
        },
      ],
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.kind).toBe("fix");
    expect(result.candidates[0]?.text).toContain("RW-4827");
  });

  it("keeps ticket-style identifiers as durable facts even without bug or fix wording", () => {
    const result = compactSession({
      sessionId: "identifier-fact",
      source: "codex",
      startedAt: "2026-05-22T08:00:00.000Z",
      events: [
        {
          id: "e1",
          role: "user",
          timestamp: "2026-05-22T08:01:00.000Z",
          content: "Track ticket RW-4827 for the next recall validation pass.",
        },
      ],
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.kind).toBe("fact");
    expect(result.candidates[0]?.text).toContain("RW-4827");
  });
});
