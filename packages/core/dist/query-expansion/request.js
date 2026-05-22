import { redactPrivate } from "../redaction/private.js";
const DEFAULT_REWRITE_INSTRUCTION = "Rewrite the user query into short recall/search queries. Preserve exact identifiers, names, dates, and negations. Return only rewritten queries.";
export function buildQueryExpansionRequest(input) {
    const redacted = redactPrivate(input.query);
    if (redacted.fullyPrivate) {
        throw new Error("Cannot build query expansion request from fully private query.");
    }
    return {
        query: redacted.text,
        instruction: input.instruction ?? DEFAULT_REWRITE_INSTRUCTION,
        maxRewrites: input.maxRewrites ?? 3,
    };
}
//# sourceMappingURL=request.js.map