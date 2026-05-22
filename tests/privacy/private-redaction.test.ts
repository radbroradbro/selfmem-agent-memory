import { describe, expect, it } from "vitest";
import { containsRedactionBoundaryText, redactPrivate } from "../../packages/core/src/redaction/private.js";

describe("private redaction", () => {
  it("stores public text and strips private spans", () => {
    const result = redactPrivate("remember <private>secret</private> public");
    expect(result.text).toContain("public");
    expect(result.text).not.toContain("secret");
    expect(result.fullyPrivate).toBe(false);
  });

  it("rejects fully private saves", () => {
    const result = redactPrivate("<private>secret</private>");
    expect(result.text).not.toContain("secret");
    expect(result.fullyPrivate).toBe(true);
  });

  it("redacts malformed private tags conservatively", () => {
    const result = redactPrivate("public <private>secret with no close");
    expect(result.text).toBe("public [REDACTED_PRIVATE]");
    expect(result.text).not.toContain("secret");
  });

  it("redacts private content inside code blocks", () => {
    const result = redactPrivate("```ts\nconst x = '<private>secret</private>';\n```");
    expect(result.text).not.toContain("secret");
    expect(result.redacted).toBe(true);
  });

  it("redacts common provider key shapes", () => {
    const result = redactPrivate([
      keyLike("pa-", "A", 44),
      keyLike("AIza", "B", 36),
      keyLike("jina_", "C", 34),
      keyLike("sk-ant-", "D", 44),
      keyLike("sk-or-v1-", "D", 44),
      keyLike("sk-", "E", 34),
      keyLike("sm_", "F", 42),
      keyLike("nvapi-", "G", 34),
      keyLike("AKIA", "H", 16),
      keyLike("ghp_", "I", 30),
      `123456789:${"J".repeat(32)}`,
      keyLike("xoxb-", "K", 20),
    ].join(" "));

    expect(result.text).not.toMatch(/pa-[A-Z]/);
    expect(result.text).not.toMatch(/AIza[A-Z]/);
    expect(result.text).not.toMatch(/jina_[A-Z]/);
    expect(result.text).not.toMatch(/sk-ant-[A-Z]/);
    expect(result.text).not.toMatch(/sk-or-v1-[A-Z]/);
    expect(result.text).not.toMatch(/sk-[A-Z]/);
    expect(result.text).not.toMatch(/sm_[A-Z]/);
    expect(result.text).not.toMatch(/nvapi-[A-Z]/);
    expect(result.text).not.toMatch(/AKIA[A-Z]/);
    expect(result.text).not.toMatch(/ghp_[A-Z]/);
    expect(result.text).not.toMatch(/\d{8,12}:[A-Z]/);
    expect(result.text).not.toMatch(/xoxb-[A-Z]/);
    expect(result.redactionCount).toBe(12);
    expect(containsRedactionBoundaryText(keyLike("sm_", "F", 42))).toBe(true);
    expect(containsRedactionBoundaryText("ordinary public memory text")).toBe(false);
  });
});

function keyLike(prefix: string, char: string, count: number): string {
  return prefix + char.repeat(count);
}
