import { describe, expect, it } from "vitest";
import { buildQueryExpansionRequest } from "../../packages/core/src/query-expansion/request.js";

describe("query expansion boundary", () => {
  it("only carries the redacted user query and rewrite instruction", () => {
    const request = buildQueryExpansionRequest({
      query: "find <private>secret project codename</private> public recall facts",
      maxRewrites: 3,
    });

    expect(Object.keys(request).sort()).toEqual(["instruction", "maxRewrites", "query"]);
    expect(request.query).toContain("public recall facts");
    expect(request.query).not.toContain("secret project codename");
    expect(JSON.stringify(request)).not.toContain("stored memory");
  });

  it("rejects fully private query expansion", () => {
    expect(() => buildQueryExpansionRequest({ query: "<private>secret</private>" })).toThrow(
      "fully private query",
    );
  });
});
