import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const outputPath = args.output ?? process.env.RECALLWEAVE_BASELINE_SOURCE_ALIGNMENT_OUTPUT_JSON ?? null;
const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern =
  /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*)/i;
const sourceMatch = loadSourceMatch(args.sourceMatch ?? args.sourceMatchReport);
const localMap = loadLocalMap(args.localMap ?? args.containerMap);
const privateMap = loadPrivateMap(args.privateMap);
const requestedCandidateId = args.candidateId ?? process.env.RECALLWEAVE_BASELINE_CANDIDATE_ID ?? null;

const sourceLabelHash = localMap?.sourceLabelHash ?? null;
const candidate = selectCandidate(privateMap, requestedCandidateId, sourceLabelHash);
const hostedLabelHash = candidate?.rawLabelHash ?? null;
const labelAligned = Boolean(sourceLabelHash && hostedLabelHash && sourceLabelHash === hostedLabelHash);
const contentAligned = Boolean(sourceMatch.sourceMatchReady);
const output = {
  ok: labelAligned && contentAligned,
  mode: "baseline-source-alignment",
  schemaVersion: 1,
  fixtureOnly: Boolean(sourceMatch.fixtureOnly || localMap?.fixtureOnly || privateMap?.fixtureOnly),
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
  status: statusFor({ labelAligned, contentAligned, sourceMatch }),
  labelAlignment: {
    checked: Boolean(localMap && privateMap),
    labelAligned,
    localSourceLabelHash: sourceLabelHash,
    hostedSourceLabelHash: hostedLabelHash,
    selectedCandidateId: candidate?.candidateId ?? null,
    selectedDocumentCount: candidate?.documentCount ?? null,
    selectedRawLabelLength: candidate?.rawLabelLength ?? null,
    localAgentHash: localMap?.agentHash ?? null,
    localContainerHash: localMap?.localContainerHash ?? null,
  },
  contentAlignment: {
    sourceMatchReady: contentAligned,
    queryCount: numberValue(sourceMatch.sourceMatchEvidence?.queryCount),
    sourceMatchedQueryCount: numberValue(sourceMatch.sourceMatchEvidence?.sourceMatchedQueryCount),
    collectableQueryCount: numberValue(sourceMatch.sourceMatchEvidence?.collectableQueryCount),
    missingQueryCount: numberValue(sourceMatch.sourceMatchEvidence?.missingQueryCount),
    matchedSourceRefCount: numberValue(sourceMatch.sourceMatchEvidence?.matchedSourceRefCount),
    matchedCollectableRefCount: numberValue(sourceMatch.sourceMatchEvidence?.matchedCollectableRefCount),
    failedChecks: sourceMatch.failedChecks ?? [],
  },
  benchmarkGate: {
    matchedBaselineRunAllowed: labelAligned && contentAligned,
    publicBenchmarkClaimsAllowed: false,
    requiresReviewerApproval: true,
    reason: reasonFor({ labelAligned, contentAligned, sourceMatch }),
  },
  nextActions: nextActionsFor({ labelAligned, contentAligned, sourceMatch }),
  safety: {
    printsCredentialValues: false,
    printsRawContainerLabels: false,
    printsMemoryText: false,
    readsPrivateMap: Boolean(privateMap?.entries.length),
    readsLocalContainerMap: Boolean(localMap),
    attachPrivateMap: false,
    attachLocalMemories: false,
  },
};

const serialized = `${JSON.stringify(output, null, 2)}\n`;
assertSafePublicText(serialized, "source alignment report");
if (outputPath) writeFileSync(resolvePath(outputPath), serialized, { encoding: "utf8", mode: 0o600 });
process.stdout.write(serialized);
if (!output.ok && (args.strict || args.requireReady)) process.exitCode = 1;

function loadSourceMatch(inputPath) {
  if (inputPath) {
    const path = resolvePath(inputPath);
    assert.ok(existsSync(path), "source-match report missing");
    const raw = readFileSync(path, "utf8");
    assertSafePublicText(raw, "source-match report");
    const parsed = JSON.parse(raw);
    assert.equal(parsed.mode, "baseline-source-match-preflight", "source-match report mode mismatch");
    assert.equal(parsed.metricsOnly, true, "source-match report must be metrics-only");
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

function loadLocalMap(inputPath) {
  if (!inputPath) {
    return {
      fixtureOnly: true,
      agentHash: shortHash("fixture-agent"),
      localContainerHash: shortHash("fixture-local"),
      sourceLabelHash: shortHash("fixture-personal"),
    };
  }
  const path = resolvePath(inputPath);
  assert.ok(existsSync(path), "local container map missing");
  assert.ok(statSync(path).size <= 200_000, "local container map too large");
  const raw = readFileSync(path, "utf8");
  assert.doesNotMatch(raw, secretPattern, "local container map contains a key-shaped secret");
  const parsed = JSON.parse(raw);
  const sourceLabel = firstString(parsed.source_supermemory_container, parsed.sourceSupermemoryContainer, parsed.sourceContainer);
  assert.ok(sourceLabel, "local container map needs a source Supermemory container label");
  assert.doesNotMatch(sourceLabel, secretPattern, "source Supermemory container label looks like a secret");
  return {
    fixtureOnly: false,
    fileName: basename(path),
    agentHash: shortHash(firstString(parsed.agent_identity, parsed.agentIdentity, parsed.agentId, "unknown-agent")),
    localContainerHash: shortHash(firstString(parsed.local_container, parsed.localContainer, parsed.localSelfmemContainer, "unknown-local")),
    sourceLabelHash: shortHash(sourceLabel),
  };
}

function loadPrivateMap(inputPath) {
  if (!inputPath) {
    return {
      fixtureOnly: true,
      entries: [
        {
          candidateId: "c_8f4ad3c9e3efb8c1",
          rawLabelHash: shortHash("fixture-personal"),
          rawLabelLength: "fixture-personal".length,
          documentCount: 2,
        },
      ],
    };
  }
  const path = resolvePath(inputPath);
  assertOutsideRepository(path, "private hosted container map");
  assert.ok(existsSync(path), "private hosted container map missing");
  assert.equal(statSync(path).mode & 0o777, 0o600, "private hosted container map must use 0600 permissions");
  const lines = readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean);
  const entries = lines.map((line, index) => {
    const parsed = JSON.parse(line);
    const candidateId = String(parsed.candidateId ?? "");
    const rawContainerTag = String(parsed.rawContainerTag ?? "");
    assert.match(candidateId, /^c_[a-f0-9]{16}$/, `private map line ${index + 1} has invalid candidate id`);
    assert.ok(rawContainerTag, `private map line ${index + 1} needs rawContainerTag`);
    assert.doesNotMatch(rawContainerTag, secretPattern, "raw hosted container label looks like a secret");
    return {
      candidateId,
      rawLabelHash: shortHash(rawContainerTag),
      rawLabelLength: rawContainerTag.length,
      documentCount: numberOrNull(parsed.documentCount),
    };
  });
  assert.ok(entries.length > 0, "private hosted container map is empty");
  return { fixtureOnly: false, entries };
}

function selectCandidate(privateMap, requestedCandidateId, sourceLabelHash) {
  if (!privateMap) return null;
  if (requestedCandidateId) return privateMap.entries.find((entry) => entry.candidateId === requestedCandidateId) ?? null;
  if (sourceLabelHash) return privateMap.entries.find((entry) => entry.rawLabelHash === sourceLabelHash) ?? null;
  return privateMap.entries[0] ?? null;
}

function statusFor({ labelAligned, contentAligned, sourceMatch }) {
  if (!labelAligned) return "BLOCKED_LABEL_MISMATCH";
  if (!contentAligned && sourceMatch.sourceMatchEvidence?.queryCount > 0) return "BLOCKED_CONTENT_DIVERGENT";
  if (!contentAligned) return "BLOCKED_SOURCE_MATCH_UNKNOWN";
  return sourceMatch.fixtureOnly ? "READY_FOR_MATCHED_BASELINE_FIXTURE" : "READY_FOR_MATCHED_BASELINE_REVIEW";
}

function reasonFor({ labelAligned, contentAligned }) {
  if (!labelAligned) return "Hosted and local container labels are not the same source.";
  if (!contentAligned) return "Hosted and local container labels match, but the reviewed expected refs are not collectable from the local source.";
  return "Hosted and local labels match, and every reviewed query has collectable local expected evidence.";
}

function nextActionsFor({ labelAligned, contentAligned }) {
  if (!labelAligned) {
    return [
      "Select the hosted candidate that matches the local container map source label before authoring a benchmark query set.",
      "Do not run hosted/local quality comparison from a label-mismatched source.",
    ];
  }
  if (!contentAligned) {
    return [
      "Do not run the full hosted/local baseline yet.",
      "Mirror the selected hosted source into the local RecallWeave container or rebuild the reviewed query labels from the local source.",
      "Rerun baseline:source-match and this source-alignment gate before spending hosted comparison calls.",
    ];
  }
  return [
    "Run baseline:run with the reviewed query set, selected hosted container, and source-matched local container.",
    "Attach this source-alignment report with the baseline evidence packet.",
    "Keep public benchmark claims blocked until reviewer approval is recorded.",
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

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function shortHash(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

function resolvePath(inputPath) {
  return isAbsolute(inputPath) ? inputPath : resolve(root, inputPath);
}

function assertOutsideRepository(path, label) {
  const rel = relative(root, path).replaceAll("\\", "/");
  assert.ok(rel.startsWith("../") || rel === ".." || isAbsolute(rel), `${label} must be outside the repository`);
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a private path`);
  assert.doesNotMatch(text, /rawContainerTag|source_supermemory_container|sourceSupermemoryContainer/, `${label} contains raw container label fields`);
  assert.doesNotMatch(text, /"q"\s*:/, `${label} contains raw query text`);
  assert.doesNotMatch(text, /"text"\s*:/, `${label} contains raw memory text`);
}
