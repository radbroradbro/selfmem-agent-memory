import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compactSession, containsRedactionBoundaryText } from "../core/dist/index.js";

const suiteUrl = new URL("./fixtures/session-compaction-benchmark.fixture.json", import.meta.url);
const suite = JSON.parse(await readFile(suiteUrl, "utf8"));

const scenarioReports = suite.scenarios.map((scenario) => evaluateScenario(scenario));
const aggregate = summarize(scenarioReports);

assert.equal(aggregate.failedScenarios, 0, JSON.stringify(scenarioReports, null, 2));
assert.equal(aggregate.privacyLeakCount, 0, JSON.stringify(scenarioReports, null, 2));
assert.equal(aggregate.exactIdentifierAccuracy, 1);
assert.equal(aggregate.lifecycleCoverage, 1);
assert.equal(aggregate.unlinkedCandidateCount, 0);
assert.ok(aggregate.averageNoiseReductionRatio >= 0.2);

console.log(JSON.stringify({
  ok: true,
  suite: {
    schemaVersion: suite.schemaVersion,
    scenarioCount: suite.scenarios.length,
  },
  aggregate,
  scenarios: scenarioReports.map((report) => ({
    id: report.id,
    passed: report.passed,
    kindCoverage: report.kindCoverage,
    requiredTermCoverage: report.requiredTermCoverage,
    exactIdentifierAccuracy: report.exactIdentifierAccuracy,
    sessionMap: report.sessionMap,
    metrics: report.metrics,
    failures: report.failures,
  })),
}, null, 2));

function evaluateScenario(scenario) {
  const result = compactSession(scenario.input);
  const text = result.candidates.map((candidate) => candidate.text).join("\n");
  const expectConfig = scenario.expect ?? {};
  const failures = [];
  const requiredKinds = expectConfig.requiredKinds ?? [];
  const requiredTerms = expectConfig.requiredTerms ?? [];
  const exactIdentifierTerms = expectConfig.exactIdentifierTerms ?? [];
  const forbiddenTerms = expectConfig.forbiddenTerms ?? [];
  const kindHits = requiredKinds.filter((kind) => result.candidates.some((candidate) => candidate.kind === kind)).length;
  const termHits = requiredTerms.filter((term) => text.includes(term)).length;
  const exactHits = exactIdentifierTerms.filter((term) => text.includes(term)).length;
  const staleCandidates = result.candidates.filter((candidate) => candidate.stale).length;
  const mergedSourceEventMax = Math.max(0, ...result.candidates.map((candidate) => candidate.sourceEventIds.length));
  const lifecyclePhases = new Set(result.sessionMap.lifecycleEvents.map((event) => event.phase));
  const forbiddenHits = forbiddenTerms.filter((term) => text.includes(term));
  const serialized = JSON.stringify(result);
  const privateLeakHits = [
    ...(containsRedactionBoundaryText(serialized) ? ["redaction-boundary"] : []),
    ...(serialized.includes("fixture secret") ? ["fixture secret"] : []),
  ];

  if (result.metrics.chronological !== true) failures.push("not-chronological");
  if (result.metrics.outputCandidates < (expectConfig.minOutputCandidates ?? 0)) failures.push("too-few-candidates");
  if (expectConfig.maxOutputCandidates !== undefined && result.metrics.outputCandidates > expectConfig.maxOutputCandidates) {
    failures.push("too-many-candidates");
  }
  if (result.metrics.noiseReductionRatio + 1e-9 < (expectConfig.minNoiseReductionRatio ?? 0)) failures.push("noise-reduction-below-threshold");
  if (result.metrics.redactionCount < (expectConfig.minRedactionCount ?? 0)) failures.push("redaction-count-below-threshold");
  if (result.metrics.skippedFullyPrivate < (expectConfig.minSkippedFullyPrivate ?? 0)) failures.push("private-skip-below-threshold");
  if (staleCandidates < (expectConfig.minStaleCandidates ?? 0)) failures.push("stale-candidate-below-threshold");
  if (mergedSourceEventMax < (expectConfig.minMergedSourceEvents ?? 0)) failures.push("merged-source-events-below-threshold");
  if (kindHits < requiredKinds.length) failures.push("missing-required-kind");
  if (termHits < requiredTerms.length) failures.push("missing-required-term");
  if (exactIdentifierTerms.length > 0 && exactHits / exactIdentifierTerms.length < (expectConfig.minExactIdentifierAccuracy ?? 1)) {
    failures.push("exact-identifier-accuracy-below-threshold");
  }
  if (forbiddenHits.length > 0) failures.push(`forbidden-term:${forbiddenHits.join(",")}`);
  if (privateLeakHits.length > 0) failures.push(`private-leak:${privateLeakHits.join(",")}`);
  if (!lifecyclePhases.has("pre_compact") || !lifecyclePhases.has("session_map_ready")) failures.push("missing-lifecycle-map-phase");
  if (result.sessionMap.telemetry.counters.unlinkedCandidates > 0) failures.push("unlinked-session-map-candidates");

  return {
    id: scenario.id,
    description: scenario.description,
    passed: failures.length === 0,
    failures,
    metrics: result.metrics,
    candidateCount: result.candidates.length,
    kindCoverage: requiredKinds.length === 0 ? 1 : Number((kindHits / requiredKinds.length).toFixed(3)),
    requiredTermCoverage: requiredTerms.length === 0 ? 1 : Number((termHits / requiredTerms.length).toFixed(3)),
    exactIdentifierAccuracy: exactIdentifierTerms.length === 0 ? 1 : Number((exactHits / exactIdentifierTerms.length).toFixed(3)),
    sessionMap: {
      topicLinkCount: result.sessionMap.topicLinks.length,
      lifecycleEventCount: result.sessionMap.lifecycleEvents.length,
      lifecycleCoverage: lifecyclePhases.has("pre_compact") && lifecyclePhases.has("session_map_ready") ? 1 : 0,
      linkedCandidateCount: result.sessionMap.telemetry.counters.linkedCandidates,
      unlinkedCandidateCount: result.sessionMap.telemetry.counters.unlinkedCandidates,
      wasteSignals: result.sessionMap.telemetry.wasteSignals,
      warningCount: result.sessionMap.telemetry.warnings.length,
    },
    staleCandidates,
    mergedSourceEventMax,
    privacyLeakCount: privateLeakHits.length,
  };
}

function summarize(reports) {
  const exactReports = reports.filter((report) => report.exactIdentifierAccuracy !== 1 || report.id.includes("identifier"));
  return {
    passedScenarios: reports.filter((report) => report.passed).length,
    failedScenarios: reports.filter((report) => !report.passed).length,
    privacyLeakCount: reports.reduce((sum, report) => sum + report.privacyLeakCount, 0),
    exactIdentifierAccuracy: average(exactReports.map((report) => report.exactIdentifierAccuracy)),
    averageKindCoverage: average(reports.map((report) => report.kindCoverage)),
    averageRequiredTermCoverage: average(reports.map((report) => report.requiredTermCoverage)),
    averageNoiseReductionRatio: average(reports.map((report) => report.metrics.noiseReductionRatio)),
    totalOutputCandidates: reports.reduce((sum, report) => sum + report.candidateCount, 0),
    totalTopicLinks: reports.reduce((sum, report) => sum + report.sessionMap.topicLinkCount, 0),
    lifecycleCoverage: average(reports.map((report) => report.sessionMap.lifecycleCoverage)),
    unlinkedCandidateCount: reports.reduce((sum, report) => sum + report.sessionMap.unlinkedCandidateCount, 0),
    wasteSignalCounts: countBy(reports.flatMap((report) => report.sessionMap.wasteSignals)),
  };
}

function average(values) {
  if (values.length === 0) return 1;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3));
}

function countBy(values) {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}
