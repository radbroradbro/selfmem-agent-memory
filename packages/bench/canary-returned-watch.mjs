import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { basename, delimiter, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const inputRoots = normalizeInputRoots(args);
const iterations = Math.max(1, Number(args.iterations ?? 1));
const intervalMs = Math.max(0, Number(args.intervalMs ?? 0));
const requireFound = Boolean(args.requireFound);
const expectedCommit = normalizedExpectedCommit(args.expectedCommit ?? process.env.RECALLWEAVE_CANARY_EXPECTED_COMMIT ?? "");
const outputPath = args.output ? resolvePath(args.output) : null;

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|\/tmp\/|[A-Za-z]:\\Users\\)/;

for (const inputRoot of inputRoots) {
  assert.ok(existsSync(inputRoot), `input folder is missing: ${basename(inputRoot)}`);
}

const scans = [];
let found = false;
let failed = false;

for (let iteration = 1; iteration <= iterations; iteration += 1) {
  const rootsForIteration = inputRoots.length ? inputRoots : [null];
  for (const inputRoot of rootsForIteration) {
    const scan = runInboxScan(inputRoot, iteration);
    scans.push(scan);
    found = found || scan.productionEvidencePackets > 0;
    failed = failed || scan.parseOk === false;
  }
  if (found) break;
  if (iteration < iterations && intervalMs > 0) sleep(intervalMs);
}

const latestScans = latestByRoot(scans);
const output = {
  ok: !failed && (!requireFound || found),
  mode: "canary-returned-watch",
  writesRealFiles: Boolean(outputPath),
  metricsOnly: true,
  publicLaunchAllowed: false,
  fleetRolloutAllowed: false,
  requireFound,
  sourceControl: {
    expectedCommit: expectedCommit || null,
  },
  iterationsRequested: iterations,
  iterationsCompleted: scans.length ? Math.max(...scans.map((scan) => scan.iteration)) : 0,
  intervalMs,
  inputRootCount: inputRoots.length,
  inputRootsHash: sha256(inputRoots.map((item) => basename(item)).join("\n")),
  status: found
    ? "PRODUCTION_CANARY_EVIDENCE_FOUND"
    : failed
      ? "WATCH_SCAN_FAILED"
      : "AWAITING_RETURNED_PRODUCTION_CANARY",
  counts: {
    scanCount: scans.length,
    rootsWithProductionEvidence: latestScans.filter((scan) => scan.productionEvidencePackets > 0).length,
    productionEvidencePackets: latestScans.reduce((sum, scan) => sum + scan.productionEvidencePackets, 0),
    returnedEvidencePackets: latestScans.reduce((sum, scan) => sum + scan.returnedEvidencePackets, 0),
    handoffPackets: latestScans.reduce((sum, scan) => sum + scan.handoffPackets, 0),
    diagnosticBundles: latestScans.reduce((sum, scan) => sum + scan.diagnosticBundles, 0),
    unknownPackets: latestScans.reduce((sum, scan) => sum + scan.unknownPackets, 0),
    unreadablePackets: latestScans.reduce((sum, scan) => sum + scan.unreadablePackets, 0),
  },
  latestScans,
  nextActions: found
    ? [
        "Run canary:returned-packet on the matching returned evidence packet if an explicit packet review is still needed.",
        "Keep public launch and fleet rollout blocked until maintainer approval.",
      ]
    : [
        "Keep waiting for a returned metrics-only canary evidence packet.",
        "Do not count handoff packets, diagnostic bundles, or unknown zips as production canary evidence.",
        "Use canary:returned-inbox with --expose-labels only for local operator-only review if a human needs to locate a file.",
      ],
};

const serialized = `${JSON.stringify(output, null, 2)}\n`;
assertSafeText(serialized, "returned watch output");
if (outputPath) writeFileSync(outputPath, serialized, { encoding: "utf8", mode: 0o600 });
process.stdout.write(serialized);
if (!output.ok) process.exitCode = 1;

function runInboxScan(inputRoot, iteration) {
  const scanArgs = ["packages/bench/canary-returned-inbox.mjs", "--require-production-canary"];
  if (inputRoot) scanArgs.push("--input-root", inputRoot);
  if (args.includeAllZips) scanArgs.push("--include-all-zips");
  if (expectedCommit) scanArgs.push("--expected-commit", expectedCommit);

  const run = spawnSync("node", scanArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    assertSafeText(run.stdout, "returned inbox stdout");
    const report = JSON.parse(run.stdout);
    return {
      iteration,
      rootLabel: inputRoot ? basename(inputRoot) : "generated-fixture",
      parseOk: true,
      inboxOk: Boolean(report.ok),
      status: report.status ?? "UNKNOWN",
      candidateCount: numberValue(report.input?.candidateCount),
      scannedZipCount: numberValue(report.counts?.scannedZipCount),
      returnedEvidencePackets: numberValue(report.counts?.returnedEvidencePackets),
      productionEvidencePackets: numberValue(report.counts?.productionEvidencePackets),
      handoffPackets: numberValue(report.counts?.handoffPackets),
      diagnosticBundles: numberValue(report.counts?.diagnosticBundles),
      unreadablePackets: numberValue(report.counts?.unreadablePackets),
      unknownPackets: numberValue(report.counts?.unknownPackets),
      labelMode: report.input?.broadFolderLabelsRedacted === false ? "exposed" : "hash-redacted",
      triage: normalizeTriage(report.triage),
    };
  } catch (error) {
    return {
      iteration,
      rootLabel: inputRoot ? basename(inputRoot) : "generated-fixture",
      parseOk: false,
      inboxOk: false,
      status: "UNREADABLE_INBOX_OUTPUT",
      candidateCount: 0,
      scannedZipCount: 0,
      returnedEvidencePackets: 0,
      productionEvidencePackets: 0,
      handoffPackets: 0,
      diagnosticBundles: 0,
      unreadablePackets: 0,
      unknownPackets: 0,
      labelMode: "hash-redacted",
      triage: normalizeTriage(null),
      error: sanitizeForOutput(error instanceof Error ? error.message : String(error)),
    };
  }
}

function latestByRoot(items) {
  const byRoot = new Map();
  for (const item of items) byRoot.set(item.rootLabel, item);
  return [...byRoot.values()].sort((a, b) => a.rootLabel.localeCompare(b.rootLabel));
}

function normalizeInputRoots(parsed) {
  const values = [...(parsed.inputRoot ?? [])];
  if (parsed.folder) values.push(parsed.folder);
  if (process.env.RECALLWEAVE_RETURNED_CANARY_INBOX) {
    values.push(...process.env.RECALLWEAVE_RETURNED_CANARY_INBOX.split(delimiter));
  }
  return values.filter(Boolean).map(resolvePath);
}

function parseArgs(argv) {
  const parsed = { inputRoot: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item === "--include-all-zips") parsed.includeAllZips = true;
    else if (item === "--require-found") parsed.requireFound = true;
    else if (item === "--input-root") {
      parsed.inputRoot.push(argv[index + 1] ?? "");
      index += 1;
    } else if (item.startsWith("--")) {
      parsed[toCamel(item.slice(2))] = argv[index + 1] ?? "";
      index += 1;
    }
  }
  parsed.inputRoot = parsed.inputRoot.filter(Boolean);
  return parsed;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function resolvePath(value) {
  return isAbsolute(value) ? value : resolve(process.cwd(), value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function numberValue(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function normalizeTriage(triage) {
  return {
    labelMode: triage?.labelMode === "exposed" ? "exposed" : "hash-redacted",
    metricsOnly: true,
    unknown: normalizeTriageGroup(triage?.unknown),
    unreadable: normalizeTriageGroup(triage?.unreadable),
  };
}

function normalizeTriageGroup(group) {
  return {
    count: numberValue(group?.count),
    statusCounts: sanitizeCountMap(group?.statusCounts),
    failedCheckCounts: sanitizeCountMap(group?.failedCheckCounts),
    reasonCounts: sanitizeCountMap(group?.reasonCounts),
    sampleIds: Array.isArray(group?.sampleIds)
      ? group.sampleIds.slice(0, 5).map((item) => sanitizeForOutput(String(item)))
      : [],
  };
}

function sanitizeCountMap(value) {
  const output = {};
  if (!value || typeof value !== "object") return output;
  for (const [key, count] of Object.entries(value)) {
    output[sanitizeForOutput(key)] = numberValue(count);
  }
  return output;
}

function normalizedExpectedCommit(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  assert.match(text, /^[a-f0-9]{7,40}$/i, "--expected-commit must be a git SHA prefix or full SHA");
  return text.toLowerCase();
}

function sleep(ms) {
  const signal = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(signal, 0, 0, ms);
}

function assertSafeText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a raw local path`);
}

function sanitizeForOutput(text) {
  return String(text)
    .replace(/(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|\/tmp\/)[^\s"']+/g, "<local-path>")
    .replace(/[A-Za-z]:\\Users\\[^\s"']+/g, "<local-path>");
}
