import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const fixtureRequested = Boolean(args.fixture) || !args.queryset;
const strict = Boolean(args.strict);
const querySetPath = resolveInputPath(
  args.queryset ?? args.querySet ?? process.env.RECALLWEAVE_BASELINE_QUERYSET ?? (fixtureRequested ? "packages/bench/fixtures/hosted-baseline-queryset.fixture.json" : null),
);
const outputPath = args.output ?? process.env.RECALLWEAVE_BASELINE_QUERYSET_REPORT_JSON ?? null;

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;

assert.ok(querySetPath, "query set is required. Pass --queryset or RECALLWEAVE_BASELINE_QUERYSET");
assert.ok(existsSync(querySetPath), `query set missing: ${displayPath(querySetPath)}`);
assert.ok(statSync(querySetPath).size > 0, `query set empty: ${displayPath(querySetPath)}`);

const raw = readFileSync(querySetPath, "utf8");
assert.doesNotMatch(raw, secretPattern, `${displayPath(querySetPath)} contains a key-shaped secret`);
assert.doesNotMatch(raw, privatePathPattern, `${displayPath(querySetPath)} contains a private path`);
const querySet = JSON.parse(raw);
const queries = Array.isArray(querySet.queries) ? querySet.queries : [];
assert.ok(queries.length > 0, "query set must contain at least one query");

for (const query of queries) {
  assert.ok(typeof query.id === "string" && query.id.trim(), "each query needs an id");
  assert.ok(typeof query.q === "string" && query.q.trim(), `query ${query.id} needs q`);
}

const querySetEvidence = summarizeQuerySetEvidence(queries);
const report = {
  ok: querySetEvidence.publicBenchmarkReady,
  mode: "baseline-queryset-inspect",
  schemaVersion: 1,
  fixtureOnly: fixtureRequested || querySet.fixtureOnly === true || displayPath(querySetPath).includes("/fixtures/"),
  writesRealFiles: Boolean(outputPath),
  metricsOnly: true,
  publicSafe: true,
  rawQueryIncluded: false,
  rawExpectedIdsIncluded: false,
  rawExpectedHashesIncluded: false,
  privateLeakCount: 0,
  hasSecretPattern: false,
  source: {
    inputFile: displayPath(querySetPath),
    datasetSliceHash: querySet.datasetSlice ? `sha256:${shortHash(querySet.datasetSlice)}` : null,
    judgeModelHash: querySet.judgeModel ? `sha256:${shortHash(querySet.judgeModel)}` : null,
    answerModelHash: querySet.answerModel ? `sha256:${shortHash(querySet.answerModel)}` : null,
    querySetHash: `sha256:${stableHash({
      schemaVersion: querySet.schemaVersion ?? 1,
      datasetSlice: querySet.datasetSlice ?? null,
      queries: queries.map((query) => ({
        id: query.id,
        q: query.q,
        expectedResultIds: query.expectedResultIds ?? [],
        expectedResultHashes: query.expectedResultHashes ?? [],
      })),
    })}`,
  },
  querySetEvidence,
  queryFingerprints: queries.map((query) => ({
    queryIdHash: shortHash(query.id),
    queryHash: shortHash(query.q),
    expectedResultIdCount: arrayLength(query.expectedResultIds),
    expectedResultHashCount: arrayLength(query.expectedResultHashes),
    expectedResultRefCount: queryExpectedRefCount(query),
    labeled: queryExpectedRefCount(query) > 0,
  })),
  failedChecks: failedQuerySetChecks(querySetEvidence),
  nextActions: querySetEvidence.publicBenchmarkReady
    ? [
        "Use this query set for hosted and RecallWeave collection with the same judge, answer model, scoring code, and privacy settings.",
        "Attach this metrics-only report with hosted baseline evidence packets when reviewers need query-set proof.",
      ]
    : [
        "Add at least one expected result id or expected content hash entry to every query.",
        "Make every query text distinct before using the query set for a benchmark.",
        "Rerun baseline:queryset -- --queryset <path> --strict before collecting hosted or RecallWeave results.",
      ],
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
assertSafePublicText(serialized, "query-set inspection report");
if (outputPath) {
  const resolvedOutput = resolve(outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, serialized, { encoding: "utf8", mode: 0o600 });
}
process.stdout.write(serialized);
if (strict && !querySetEvidence.publicBenchmarkReady) process.exit(1);

function failedQuerySetChecks(querySetEvidence) {
  const checks = [];
  if (querySetEvidence.unlabeledQueryCount > 0 || querySetEvidence.minExpectedRefsPerQuery <= 0) checks.push("labeled-query-set");
  if (querySetEvidence.duplicateQueryCount > 0) checks.push("unique-query-text");
  return checks;
}

function summarizeQuerySetEvidence(queries) {
  const expectedRefCounts = queries.map(queryExpectedRefCount);
  const queryHashes = queries.map((query) => shortHash(query.q));
  const uniqueQueryCount = new Set(queryHashes).size;
  const duplicateQueryCount = queries.length - uniqueQueryCount;
  const labeled = expectedRefCounts.every((count) => count > 0);
  const unique = duplicateQueryCount === 0;
  return {
    queryCount: queries.length,
    uniqueQueryCount,
    duplicateQueryCount,
    labeledQueryCount: expectedRefCounts.filter((count) => count > 0).length,
    unlabeledQueryCount: expectedRefCounts.filter((count) => count === 0).length,
    expectedResultRefCount: expectedRefCounts.reduce((sum, count) => sum + count, 0),
    minExpectedRefsPerQuery: Math.min(...expectedRefCounts),
    maxExpectedRefsPerQuery: Math.max(...expectedRefCounts),
    usesExpectedIds: queries.some((query) => arrayLength(query.expectedResultIds) > 0),
    usesExpectedHashes: queries.some((query) => arrayLength(query.expectedResultHashes) > 0),
    publicBenchmarkReady: labeled && unique,
  };
}

function queryExpectedRefCount(query) {
  return arrayLength(query.expectedResultIds) + arrayLength(query.expectedResultHashes);
}

function arrayLength(value) {
  return Array.isArray(value) ? value.filter((item) => String(item).trim()).length : 0;
}

function displayPath(value) {
  const rel = relative(root, value).replaceAll("\\", "/");
  if (!rel.startsWith("../") && rel !== "..") return rel;
  return `external:${basename(value)}`;
}

function resolveInputPath(value) {
  if (!value) return null;
  return isAbsolute(value) ? value : resolve(root, value);
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a private path`);
  assert.doesNotMatch(text, /expectedResultIds|expectedResultHashes|"\s*q"\s*:|"\s*id"\s*:/, `${label} contains raw query-set fields`);
}

function stableHash(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(text).digest("hex");
}

function shortHash(value) {
  return stableHash(String(value)).slice(0, 16);
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
