import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compactSession } from "../core/dist/index.js";

const fixtureUrl = new URL("./fixtures/session-compaction.fixture.json", import.meta.url);
const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
const result = compactSession(fixture);
const serialized = JSON.stringify(result);

assert.equal(result.metrics.inputEvents, fixture.events.length);
assert.equal(result.metrics.skippedFullyPrivate, 0);
assert.equal(result.metrics.chronological, true);
assert.ok(result.metrics.outputCandidates >= 5, "expected at least five durable candidates");
assert.ok(result.metrics.noiseReductionRatio > 0, "expected some noise reduction");
assert.ok(result.candidates.some((candidate) => candidate.kind === "decision"));
assert.ok(result.candidates.some((candidate) => candidate.kind === "fix"));
assert.ok(result.candidates.some((candidate) => candidate.kind === "methodology"));
assert.ok(result.candidates.some((candidate) => candidate.kind === "procedure"));
assert.ok(result.candidates.some((candidate) => candidate.stale));
assert.doesNotMatch(serialized, /fixture secret|<private>|pa-|AIza|sm_|nvapi-|jina_|ghp_|github_pat_/);

console.log(JSON.stringify({
  ok: true,
  sessionId: result.sessionId,
  candidates: result.candidates.map((candidate) => ({
    kind: candidate.kind,
    salience: candidate.salience,
    stale: Boolean(candidate.stale),
    text: candidate.text,
  })),
  sessionMap: {
    topicLinkCount: result.sessionMap.topicLinks.length,
    lifecycleEventCount: result.sessionMap.lifecycleEvents.length,
    linkedCandidateCount: result.sessionMap.telemetry.counters.linkedCandidates,
    unlinkedCandidateCount: result.sessionMap.telemetry.counters.unlinkedCandidates,
    wasteSignals: result.sessionMap.telemetry.wasteSignals,
    warnings: result.sessionMap.telemetry.warnings,
  },
  metrics: result.metrics,
}, null, 2));
