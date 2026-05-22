import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const brainRoot = join(root, "packages/brain-ui");

const index = read("src/index.html");
const app = read("src/app.js");
const model = read("src/model.js");
const styles = read("src/styles.css");
const fixture = JSON.parse(read("fixtures/nucleus.fixture.json"));
const releaseReadiness = JSON.parse(read("fixtures/release-readiness.json"));
const promptContext = JSON.parse(read("fixtures/prompt-context-preview.json"));

const requiredSections = {
  graph: "Interactive Nucleus graph",
  timeline: "Low-noise memory timeline",
  provenance: "Provenance",
  lifecycleTrail: "Lifecycle Trail",
  nucleusSnapshot: "Nucleus Snapshot",
  researchLineage: "Research Lineage",
  compactionAudit: "Compaction Audit",
  benchmarkDashboard: "Benchmark Dashboard",
  canaryRollout: "Canary Rollout",
  contextPreview: "Context Preview",
  releaseReadiness: "Release Readiness",
  lifecyclePolicy: "Lifecycle Policy",
  reviewQueue: "Review Queue",
  wikiVault: "Wiki Vault Preview",
  selectedSync: "Selected local vault sync dry run",
  selectedBrowse: "Selected local container browse",
  localEdit: "Selected local memory edit",
  localMaterialize: "Selected local memory materialize",
  selectedAudit: "Selected local container audit",
};

const requiredControls = [
  "searchInput",
  "graphNodeJump",
  "centerSelected",
  "policyForm",
  "policyApplyForm",
  "reviewQueueForm",
  "reviewQueueApplyForm",
  "selectedSyncForm",
  "selectedSyncApplyForm",
  "selectedBrowseForm",
  "localEditForm",
  "localMaterializeForm",
  "selectedAuditForm",
];

const requiredRenderers = [
  "renderGraph",
  "renderGraphNavigation",
  "renderLifecycleTrail",
  "buildLifecycleTrail",
  "renderLifecyclePolicy",
  "renderReviewQueue",
  "renderVaultPreview",
  "renderSelectedSync",
  "renderLocalBrowse",
  "renderLocalEdit",
  "renderLocalMaterialize",
  "renderSelectedAudit",
  "buildPromptContextPreview",
  "buildReleaseReadinessConsole",
];

const sectionChecks = Object.fromEntries(
  Object.entries(requiredSections).map(([name, marker]) => [name, index.includes(marker)]),
);
const controlChecks = Object.fromEntries(requiredControls.map((id) => [id, index.includes(`id="${id}"`)]));
const rendererChecks = Object.fromEntries(
  requiredRenderers.map((name) => [name, app.includes(name) || model.includes(name)]),
);

const allText = [
  index,
  app,
  model,
  styles,
  JSON.stringify(fixture),
  JSON.stringify(releaseReadiness),
  JSON.stringify(promptContext),
].join("\n");

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|Bearer [A-Za-z0-9._-]{20,})/;

assertAll(sectionChecks, "section");
assertAll(controlChecks, "control");
assertAll(rendererChecks, "renderer");
assert.equal(fixture.roots.container.writeMode, "local-only");
assert.equal(fixture.roots.container.privacyLeakCount, 0);
assert.equal(releaseReadiness.productionReady, false);
assert.equal(releaseReadiness.safetyBoundary.enablesHostedWriteBack, false);
assert.equal(promptContext.safety.privacyLeakCount, 0);
assert.equal(secretPattern.test(allText), false);

const nodeKinds = [...new Set(fixture.nodes.map((node) => node.kind))].sort();
const report = {
  ok: true,
  mode: "fixture-brain-ui-static-evidence",
  writesRealFiles: false,
  metricsOnly: true,
  nodeCount: fixture.nodes.length,
  edgeCount: fixture.edges.length,
  nodeKinds,
  sectionChecks,
  controlChecks,
  rendererChecks,
  releaseVerdict: releaseReadiness.publicLaunchVerdict,
  productionReady: releaseReadiness.productionReady,
  hostedWriteBackEnabled: releaseReadiness.safetyBoundary.enablesHostedWriteBack,
  privacyLeakCount: fixture.roots.container.privacyLeakCount + promptContext.safety.privacyLeakCount,
};

console.log(JSON.stringify(report, null, 2));

function read(relativePath) {
  return readFileSync(join(brainRoot, relativePath), "utf8");
}

function assertAll(checks, label) {
  for (const [name, value] of Object.entries(checks)) {
    assert.equal(value, true, `missing Brain UI ${label}: ${name}`);
  }
}
