import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, statSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const fixtureModeByArgs = Boolean(args.fixture) || (!args.privateMap && !args.discovery);
const privateMapPath = args.privateMap ?? process.env.RECALLWEAVE_BASELINE_PRIVATE_MAP ?? null;
const discoveryPath = args.discovery ?? process.env.RECALLWEAVE_BASELINE_DISCOVERY_OUTPUT_JSON ?? null;
const outputPath = args.output ?? null;
const envOutput = args.envOutput ?? process.env.RECALLWEAVE_BASELINE_SELECTION_ENV_OUTPUT ?? join(tmpdir(), "recallweave-hosted-baseline.private.env");
const requestedCandidateId = args.candidateId ?? process.env.RECALLWEAVE_BASELINE_CANDIDATE_ID ?? null;

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;

if (!fixtureModeByArgs) {
  assert.ok(privateMapPath, "live container selection requires --private-map pointing outside the repository");
}

const discovery = discoveryPath ? loadDiscovery(discoveryPath) : fixtureDiscovery();
const privateMap = privateMapPath ? loadPrivateMap(privateMapPath) : fixturePrivateMap();
const fixtureOnly = fixtureModeByArgs || discovery.fixtureOnly === true;
const candidateId = requestedCandidateId ?? discovery.recommendedCandidateId ?? privateMap[0]?.candidateId ?? null;
assert.ok(candidateId, "no candidate id available for hosted baseline container selection");

const selected = privateMap.find((entry) => entry.candidateId === candidateId);
assert.ok(selected, `candidate ${candidateId} was not found in the private container map`);
const publicDiscoveryCandidate = findPublicCandidate(discovery, candidateId);
if (discoveryPath) assert.ok(publicDiscoveryCandidate, `candidate ${candidateId} was not found in the public discovery report`);

validateRawContainerTag(selected.rawContainerTag);
const privateEnvPath = writePrivateEnv(envOutput, selected);

const report = {
  ok: true,
  mode: "hosted-baseline-container-select",
  schemaVersion: 1,
  fixtureOnly,
  evidenceType: fixtureOnly ? "fixture-hosted-baseline-container-select" : "live-hosted-baseline-container-select",
  writesRealFiles: true,
  callsHostedProvider: false,
  publicSafe: true,
  metricsOnly: true,
  rawLabelsIncluded: false,
  rawTitlesIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPromptIncluded: false,
  rawAnswerIncluded: false,
  privacyLeakCount: 0,
  redactionFailureCount: 0,
  selectedCandidate: {
    candidateId,
    documentCount: numberOrNull(publicDiscoveryCandidate?.documentCount ?? selected.documentCount),
    firstCreatedAt: stringOrNull(publicDiscoveryCandidate?.firstCreatedAt ?? selected.firstCreatedAt),
    lastUpdatedAt: stringOrNull(publicDiscoveryCandidate?.lastUpdatedAt ?? selected.lastUpdatedAt),
    rawLabelLength: selected.rawContainerTag.length,
    selectionFingerprint: `sha256:${shortHash(`selection-v1:${candidateId}:${selected.rawContainerTag.length}`)}`,
  },
  privateEnv: {
    written: true,
    basename: basename(privateEnvPath),
    mode: "0600",
    containsRawLabels: true,
    attachToPublicEvidence: false,
  },
  source: {
    discoveryLoaded: Boolean(discoveryPath),
    privateMapLoaded: Boolean(privateMapPath),
    discoveryCandidateCount: Array.isArray(discovery.containerCandidates) ? discovery.containerCandidates.length : 0,
    privateMapEntryCount: privateMap.length,
    selectedFromRecommendedCandidate: candidateId === discovery.recommendedCandidateId,
  },
  nextActions: [
    "Source the private env file on this machine only; do not attach it to GitHub, PRs, issues, packets, or diagnostics.",
    "Run baseline:queryset with --strict on the frozen query set.",
    "Run baseline:collect with RECALLWEAVE_BASELINE_LIVE=1 and RECALLWEAVE_BASELINE_NO_RAW_TEXT=1.",
    "Keep using baseline:next-run -- --require-ready before claiming the hosted/local comparison is owner-review ready.",
  ],
  safety: {
    printsCredentialValues: false,
    printsRawContainerLabels: false,
    printsMemoryText: false,
    readsPrivateContainerMap: true,
    privateMapRejectedInsideRepository: true,
    privateEnvRejectedInsideRepository: true,
    liveHostedWriteBack: false,
  },
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
assertSafePublicText(serialized, "hosted baseline container selection report");
if (outputPath) writeOutput(outputPath, serialized);
process.stdout.write(serialized);

function loadDiscovery(inputPath) {
  const path = resolveInputPath(inputPath);
  const discovery = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(discovery.mode, "hosted-baseline-discovery", "discovery file must come from baseline:discover");
  assert.equal(discovery.publicSafe, true, "discovery file must be public-safe");
  assert.equal(discovery.metricsOnly, true, "discovery file must be metrics-only");
  assert.equal(discovery.rawLabelsIncluded, false, "discovery report must not include raw labels");
  assert.equal(discovery.rawMemoryIncluded, false, "discovery report must not include raw memory");
  return discovery;
}

function loadPrivateMap(inputPath) {
  const path = resolve(inputPath);
  assertOutsideRepository(path, "private container map");
  assert.ok(existsSync(path), "private container map does not exist");
  assert.equal(statSync(path).mode & 0o777, 0o600, "private container map must use 0600 permissions");
  const entries = readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => parsePrivateMapLine(line, index + 1));
  assert.ok(entries.length > 0, "private container map is empty");
  return entries;
}

function parsePrivateMapLine(line, lineNumber) {
  const parsed = JSON.parse(line);
  const candidateId = String(parsed.candidateId ?? "");
  const rawContainerTag = String(parsed.rawContainerTag ?? "");
  assert.match(candidateId, /^c_[a-f0-9]{16}$/, `private map line ${lineNumber} has invalid candidateId`);
  validateRawContainerTag(rawContainerTag);
  return {
    candidateId,
    rawContainerTag,
    documentCount: numberOrNull(parsed.documentCount),
    firstCreatedAt: stringOrNull(parsed.firstCreatedAt),
    lastUpdatedAt: stringOrNull(parsed.lastUpdatedAt),
  };
}

function fixtureDiscovery() {
  return {
    mode: "hosted-baseline-discovery",
    fixtureOnly: true,
    publicSafe: true,
    metricsOnly: true,
    rawLabelsIncluded: false,
    rawMemoryIncluded: false,
    recommendedCandidateId: "c_8f4ad3c9e3efb8c1",
    containerCandidates: [
      {
        candidateId: "c_8f4ad3c9e3efb8c1",
        documentCount: 2,
        firstCreatedAt: "2026-05-20T12:00:00.000Z",
        lastUpdatedAt: "2026-05-22T13:00:00.000Z",
      },
      {
        candidateId: "c_bacdd7642ccab47f",
        documentCount: 1,
        firstCreatedAt: "2026-05-22T10:00:00.000Z",
        lastUpdatedAt: "2026-05-22T14:00:00.000Z",
      },
    ],
  };
}

function fixturePrivateMap() {
  return [
    {
      candidateId: "c_8f4ad3c9e3efb8c1",
      rawContainerTag: "fixture-personal",
      documentCount: 2,
      firstCreatedAt: "2026-05-20T12:00:00.000Z",
      lastUpdatedAt: "2026-05-22T13:00:00.000Z",
    },
    {
      candidateId: "c_bacdd7642ccab47f",
      rawContainerTag: "fixture-agent",
      documentCount: 1,
      firstCreatedAt: "2026-05-22T10:00:00.000Z",
      lastUpdatedAt: "2026-05-22T14:00:00.000Z",
    },
  ];
}

function findPublicCandidate(discovery, candidateId) {
  return (discovery.containerCandidates ?? []).find((candidate) => candidate.candidateId === candidateId) ?? null;
}

function writePrivateEnv(inputPath, selected) {
  const path = resolve(inputPath);
  assertOutsideRepository(path, "private hosted baseline env");
  mkdirSync(dirname(path), { recursive: true });
  const text = [
    "# RecallWeave hosted baseline private selection. Do not commit or attach.",
    `export RECALLWEAVE_BASELINE_CONTAINER=${shellQuote(selected.rawContainerTag)}`,
    `export RECALLWEAVE_BASELINE_SELECTED_CANDIDATE=${shellQuote(selected.candidateId)}`,
    "export RECALLWEAVE_BASELINE_LIVE=1",
    "export RECALLWEAVE_BASELINE_NO_RAW_TEXT=1",
    "",
  ].join("\n");
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
  chmodSync(path, 0o600);
  assert.equal(statSync(path).mode & 0o777, 0o600, "private hosted baseline env must use 0600 permissions");
  return path;
}

function writeOutput(inputPath, serialized) {
  const path = isAbsolute(inputPath) ? inputPath : resolve(root, inputPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serialized, { encoding: "utf8", mode: 0o600 });
}

function resolveInputPath(inputPath) {
  return isAbsolute(inputPath) ? inputPath : resolve(root, inputPath);
}

function assertOutsideRepository(path, label) {
  const rel = relative(root, path).replaceAll("\\", "/");
  assert.ok(rel.startsWith("../") || rel === ".." || isAbsolute(rel), `${label} must be outside the repository`);
  assert.ok(!existsSync(path) || statSync(path).isFile(), `${label} path is not a file`);
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a private path`);
  assert.doesNotMatch(text, /fixture-personal|fixture-agent/, `${label} contains fixture raw container labels`);
}

function validateRawContainerTag(value) {
  assert.ok(value, "raw container tag is required");
  assert.doesNotMatch(value, /[\r\n\0]/, "raw container tag contains a control character");
  assert.doesNotMatch(value, secretPattern, "raw container tag looks like a credential");
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\"'\"'")}'`;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stringOrNull(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

function shortHash(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (!item.startsWith("--")) continue;
    const key = toCamel(item.slice(2));
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

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
