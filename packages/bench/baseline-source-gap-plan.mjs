import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const outputPath = args.output ?? process.env.RECALLWEAVE_BASELINE_SOURCE_GAP_OUTPUT_JSON ?? null;
const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern =
  /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*)/i;
const sourceMatch = loadSourceMatch(args.sourceMatch ?? args.sourceMatchReport);
const sourceAlignment = loadSourceAlignment(args.sourceAlignment ?? args.sourceAlignmentReport);

const sourceState = summarizeSourceState(sourceMatch, sourceAlignment);
const repairPlan = buildRepairPlan(sourceState);
const baselineRunBlocked = !sourceState.matchedBaselineRunAllowed;

const output = {
  ok: true,
  mode: "baseline-source-gap-plan",
  schemaVersion: 1,
  fixtureOnly: Boolean(sourceMatch.fixtureOnly || sourceAlignment.fixtureOnly),
  writesRealFiles: Boolean(outputPath),
  metricsOnly: true,
  publicSafe: true,
  rawLabelsIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPromptIncluded: false,
  rawAnswerIncluded: false,
  privateLeakCount: 0,
  hasSecretPattern: false,
  baselineRunBlocked,
  publicBenchmarkClaimsAllowed: false,
  sourceState,
  repairPlan,
  benchmarkGate: {
    matchedBaselineRunAllowed: sourceState.matchedBaselineRunAllowed,
    mayRunHostedBaseline: sourceState.matchedBaselineRunAllowed,
    publicBenchmarkClaimsAllowed: false,
    requiresReviewerApproval: true,
    reason: repairPlan.reason,
  },
  operatorCommands: buildOperatorCommands(),
  attachOnly: [
    "/tmp/recallweave-baseline-source-match.json",
    "/tmp/recallweave-baseline-source-alignment.json",
    "/tmp/recallweave-baseline-source-gap.json",
  ],
  forbidden: [
    "raw memories",
    "raw transcripts",
    "raw prompts",
    "raw answers",
    "provider keys",
    "private env files",
    "private query sets",
    "private container maps",
    "private local paths",
  ],
};

const serialized = `${JSON.stringify(output, null, 2)}\n`;
assertSafePublicText(serialized, "source-gap plan report");
if (outputPath) {
  const resolvedOutput = resolvePath(outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, serialized, { encoding: "utf8", mode: 0o600 });
}
process.stdout.write(serialized);
if (args.requireReady && baselineRunBlocked) process.exitCode = 1;

function loadSourceMatch(inputPath) {
  if (inputPath) {
    const path = resolvePath(inputPath);
    assert.ok(existsSync(path), "source-match report missing");
    const raw = readFileSync(path, "utf8");
    assertSafePublicText(raw, "source-match report");
    const parsed = JSON.parse(raw);
    assert.equal(parsed.mode, "baseline-source-match-preflight", "source-match report mode mismatch");
    assert.equal(parsed.metricsOnly, true, "source-match report must be metrics-only");
    assert.equal(parsed.publicSafe, true, "source-match report must be public-safe");
    assert.equal(parsed.rawMemoryIncluded, false, "source-match report must not include raw memory");
    return parsed;
  }
  const run = spawnSync("node", ["packages/bench/baseline-source-match-preflight.mjs", "--fixture"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(run.status, 0, "fixture source-match preflight failed");
  assertSafePublicText(run.stdout, "fixture source-match report");
  return JSON.parse(run.stdout);
}

function loadSourceAlignment(inputPath) {
  if (inputPath) {
    const path = resolvePath(inputPath);
    assert.ok(existsSync(path), "source-alignment report missing");
    const raw = readFileSync(path, "utf8");
    assertSafePublicText(raw, "source-alignment report");
    const parsed = JSON.parse(raw);
    assert.equal(parsed.mode, "baseline-source-alignment", "source-alignment report mode mismatch");
    assert.equal(parsed.metricsOnly, true, "source-alignment report must be metrics-only");
    assert.equal(parsed.publicSafe, true, "source-alignment report must be public-safe");
    assert.equal(parsed.rawLabelsIncluded, false, "source-alignment report must not include raw labels");
    assert.equal(parsed.rawMemoryIncluded, false, "source-alignment report must not include raw memory");
    return parsed;
  }
  const run = spawnSync("node", ["packages/bench/baseline-source-alignment.mjs"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(run.status, 0, "fixture source-alignment gate failed");
  assertSafePublicText(run.stdout, "fixture source-alignment report");
  return JSON.parse(run.stdout);
}

function summarizeSourceState(match, alignment) {
  const matchEvidence = match.sourceMatchEvidence ?? {};
  const contentAlignment = alignment.contentAlignment ?? {};
  const queryCount = numberValue(contentAlignment.queryCount ?? matchEvidence.queryCount);
  const sourceMatchedQueryCount = numberValue(contentAlignment.sourceMatchedQueryCount ?? matchEvidence.sourceMatchedQueryCount);
  const collectableQueryCount = numberValue(contentAlignment.collectableQueryCount ?? matchEvidence.collectableQueryCount);
  const missingQueryCount = numberValue(contentAlignment.missingQueryCount ?? matchEvidence.missingQueryCount);
  const nonCollectableQueryCount = numberValue(matchEvidence.nonCollectableQueryCount);
  const sourceIdOnlyMatchCount = numberValue(matchEvidence.sourceIdOnlyMatchCount);
  const failedChecks = uniqueStrings([...(match.failedChecks ?? []), ...(contentAlignment.failedChecks ?? [])]);
  return {
    status: String(alignment.status ?? "SOURCE_ALIGNMENT_UNKNOWN"),
    labelAligned: Boolean(alignment.labelAlignment?.labelAligned),
    sourceMatchReady: Boolean(match.sourceMatchReady && contentAlignment.sourceMatchReady),
    matchedBaselineRunAllowed: Boolean(alignment.benchmarkGate?.matchedBaselineRunAllowed),
    queryCount,
    sourceMatchedQueryCount,
    collectableQueryCount,
    missingQueryCount,
    nonCollectableQueryCount,
    sourceIdOnlyMatchCount,
    failedChecks,
    privateLeakCount: numberValue(match.privateLeakCount) + numberValue(alignment.privateLeakCount),
  };
}

function buildRepairPlan(state) {
  if (state.matchedBaselineRunAllowed) {
    return {
      status: "READY_FOR_MATCHED_BASELINE",
      recommendedPath: "run-matched-baseline",
      reason: "Hosted label, local container map, and collectable local evidence are aligned.",
      nextStep: "Run baseline:run with the reviewed query set, local map, private hosted map, and source-matched local container.",
      blocksHostedCalls: false,
    };
  }
  if (!state.labelAligned) {
    return {
      status: "BLOCKED_LABEL_MISMATCH",
      recommendedPath: "select-matching-hosted-candidate",
      reason: "The selected hosted label hash does not match the local container source label hash.",
      nextStep: "Select the hosted candidate that matches the agent local container map before authoring or running the query set.",
      blocksHostedCalls: true,
    };
  }
  if (state.sourceIdOnlyMatchCount > 0 && state.collectableQueryCount < state.queryCount) {
    return {
      status: "BLOCKED_SOURCE_ID_ONLY",
      recommendedPath: "convert-labels-to-content-hashes",
      reason: "Some reviewed labels match only source ids, which the current result export cannot score as collectable evidence.",
      nextStep: "Rebuild the reviewed query set with expected content hashes or export ids, then rerun source-match and source-align.",
      blocksHostedCalls: true,
    };
  }
  if (state.queryCount > 0 && state.sourceMatchedQueryCount < state.queryCount) {
    return {
      status: "BLOCKED_CONTENT_DIVERGENT",
      recommendedPath: "mirror-hosted-source-or-rebuild-queryset",
      reason: "The hosted/local labels may align, but the local RecallWeave source cannot satisfy every reviewed expected reference.",
      nextStep: "Mirror the selected hosted source into local RecallWeave or rebuild the query labels from the local source.",
      blocksHostedCalls: true,
    };
  }
  if (state.collectableQueryCount < state.queryCount) {
    return {
      status: "BLOCKED_NOT_COLLECTABLE",
      recommendedPath: "convert-labels-to-collectable-refs",
      reason: "The local source has some source evidence but cannot score every reviewed query with collectable refs.",
      nextStep: "Use export ids or content hashes that the RecallWeave result exporter can return, then rerun the source gates.",
      blocksHostedCalls: true,
    };
  }
  return {
    status: "BLOCKED_SOURCE_MATCH_UNKNOWN",
    recommendedPath: "rerun-source-match",
    reason: "The source reports do not prove a matched baseline run.",
    nextStep: "Rerun baseline:source-match and baseline:source-align with fresh reports before any hosted comparison run.",
    blocksHostedCalls: true,
  };
}

function buildOperatorCommands() {
  return [
    {
      id: "preflight-local-source-match",
      command:
        "RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 npm exec --yes pnpm@10.23.0 -- baseline:source-match -- --live --queryset /tmp/recallweave-hosted-baseline-queryset.json --container-dir <local-recallweave-container-dir> --strict --output /tmp/recallweave-baseline-source-match.json",
    },
    {
      id: "preflight-source-alignment",
      command:
        "npm exec --yes pnpm@10.23.0 -- baseline:source-align -- --source-match /tmp/recallweave-baseline-source-match.json --local-map <local-container-map.json> --private-map /tmp/recallweave-hosted-container-map.private.jsonl --strict --output /tmp/recallweave-baseline-source-alignment.json",
    },
    {
      id: "plan-source-gap",
      command:
        "npm exec --yes pnpm@10.23.0 -- baseline:source-gap -- --source-match /tmp/recallweave-baseline-source-match.json --source-alignment /tmp/recallweave-baseline-source-alignment.json --output /tmp/recallweave-baseline-source-gap.json",
    },
    {
      id: "run-matched-baseline",
      command:
        "RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 RECALLWEAVE_BASELINE_QUERYSET_REVIEWED=1 npm exec --yes pnpm@10.23.0 -- baseline:run -- --live --container-env /tmp/recallweave-hosted-baseline.private.env --queryset /tmp/recallweave-hosted-baseline-queryset.json --container-dir <local-recallweave-container-dir> --local-map <local-container-map.json> --private-map /tmp/recallweave-hosted-container-map.private.jsonl --reviewed-queryset --output /tmp/recallweave-baseline-run.json",
    },
  ];
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value)).filter(Boolean))];
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function resolvePath(inputPath) {
  return isAbsolute(inputPath) ? inputPath : resolve(root, inputPath);
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a private path`);
  assert.doesNotMatch(text, /rawContainerTag|source_supermemory_container|sourceSupermemoryContainer/, `${label} contains raw container label fields`);
  assert.doesNotMatch(text, /"q"\s*:/, `${label} contains raw query text`);
  assert.doesNotMatch(text, /"text"\s*:/, `${label} contains raw memory text`);
  assert.doesNotMatch(text, /expectedResultIds|expectedResultHashes/, `${label} contains raw expected refs`);
}
