import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const requireFound = Boolean(args.requireFound);
const outputPath = args.output ? resolvePath(args.output) : null;
const findingsOutputPath = args.findingsOutput ? resolvePath(args.findingsOutput) : null;
const inputRoots = normalizeInputRoots(args);

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;

let watchReport = null;
let watchStdout = "";
let watchStatus = 0;
let watchError = null;

if (inputRoots.length > 0) {
  const watchArgs = ["packages/bench/canary-returned-watch.mjs"];
  for (const inputRoot of inputRoots) watchArgs.push("--input-root", inputRoot);
  if (!args.noIncludeAllZips) watchArgs.push("--include-all-zips");
  if (args.iterations) watchArgs.push("--iterations", String(args.iterations));
  if (args.intervalMs) watchArgs.push("--interval-ms", String(args.intervalMs));
  if (requireFound) watchArgs.push("--require-found");

  const run = spawnSync("node", watchArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  watchStatus = Number(run.status ?? 0);
  watchStdout = run.stdout;
  assertSafeText(watchStdout, "returned downloads child stdout");
  assertSafeText(run.stderr, "returned downloads child stderr");
  try {
    watchReport = JSON.parse(watchStdout);
  } catch (error) {
    watchError = sanitizeForOutput(error instanceof Error ? error.message : String(error));
  }
}

const noDefaultInboxes = inputRoots.length === 0;
const childOk = watchReport ? Boolean(watchReport.ok) : false;
const found = Number(watchReport?.counts?.productionEvidencePackets ?? 0) > 0;
const ok = noDefaultInboxes ? !requireFound : childOk && (!requireFound || found);
const status = noDefaultInboxes
  ? "NO_DEFAULT_INBOXES"
  : found
    ? "PRODUCTION_CANARY_EVIDENCE_FOUND"
    : watchReport?.status ?? "RETURNED_DOWNLOADS_SCAN_FAILED";

const output = {
  ok,
  mode: "canary-returned-downloads",
  defaultInboxScan: !args.skipDefaults,
  writesRealFiles: Boolean(outputPath || findingsOutputPath),
  metricsOnly: true,
  publicLaunchAllowed: false,
  fleetRolloutAllowed: false,
  requireFound,
  includeAllZips: !args.noIncludeAllZips,
  discoveredRootCount: inputRoots.length,
  rootLabels: inputRoots.map((inputRoot) => safeRootLabel(inputRoot)),
  rootLabelsHash: sha256(inputRoots.map((inputRoot) => safeRootLabel(inputRoot)).join("\n")),
  status,
  counts: noDefaultInboxes
    ? {
        scanCount: 0,
        rootsWithProductionEvidence: 0,
        productionEvidencePackets: 0,
        returnedEvidencePackets: 0,
        handoffPackets: 0,
        diagnosticBundles: 0,
        unknownPackets: 0,
        unreadablePackets: 0,
      }
    : watchReport.counts,
  returnedWatch: watchReport
    ? {
        ok: Boolean(watchReport.ok),
        mode: watchReport.mode,
        status: watchReport.status,
        writesRealFiles: Boolean(watchReport.writesRealFiles),
        metricsOnly: Boolean(watchReport.metricsOnly),
        publicLaunchAllowed: Boolean(watchReport.publicLaunchAllowed),
        fleetRolloutAllowed: Boolean(watchReport.fleetRolloutAllowed),
        iterationsCompleted: Number(watchReport.iterationsCompleted ?? 0),
        counts: watchReport.counts,
        latestScans: (watchReport.latestScans ?? []).map((scan) => ({
          rootLabel: scan.rootLabel,
          status: scan.status,
          candidateCount: scan.candidateCount,
          scannedZipCount: scan.scannedZipCount,
          returnedEvidencePackets: scan.returnedEvidencePackets,
          productionEvidencePackets: scan.productionEvidencePackets,
          handoffPackets: scan.handoffPackets,
          diagnosticBundles: scan.diagnosticBundles,
          unreadablePackets: scan.unreadablePackets,
          unknownPackets: scan.unknownPackets,
          labelMode: scan.labelMode,
        })),
      }
    : null,
  childExitStatus: noDefaultInboxes ? null : watchStatus,
  parseError: watchError,
  nextActions: found
    ? [
        "Run canary:returned-workspace on the matching returned packet to fill the public-safe markdown workspace.",
        "Keep public launch and fleet rollout blocked until maintainer approval.",
      ]
    : noDefaultInboxes
      ? [
          "No standard local inbox folders were available to scan.",
          "Pass --input-root to scan a folder of returned agent packets.",
        ]
      : [
          "Keep waiting for a returned metrics-only production canary evidence packet.",
          "Do not count handoff packets, diagnostic bundles, or unknown zips as production canary evidence.",
          "Run canary:returned-inbox with --expose-labels only for local operator-only file location.",
        ],
};

const serialized = `${JSON.stringify(output, null, 2)}\n`;
assertSafeText(serialized, "returned downloads output");
if (outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, serialized, { encoding: "utf8", mode: 0o600 });
}
if (findingsOutputPath) {
  const markdown = toMarkdown(output);
  assertSafeText(markdown, "returned downloads markdown");
  mkdirSync(dirname(findingsOutputPath), { recursive: true });
  writeFileSync(findingsOutputPath, markdown, { encoding: "utf8", mode: 0o600 });
}
process.stdout.write(serialized);
if (!output.ok) process.exitCode = 1;

function normalizeInputRoots(parsed) {
  const roots = [];
  if (!parsed.skipDefaults) {
    const home = homedir();
    for (const candidate of [join(home, "Downloads"), join(home, "Downloads", "Telegram Desktop")]) {
      if (existsSync(candidate)) roots.push(candidate);
    }
  }
  roots.push(...(parsed.inputRoot ?? []));
  if (parsed.folder) roots.push(parsed.folder);
  if (process.env.RECALLWEAVE_RETURNED_CANARY_INBOX) {
    roots.push(...process.env.RECALLWEAVE_RETURNED_CANARY_INBOX.split(delimiter));
  }

  const resolved = [];
  const seen = new Set();
  for (const item of roots.filter(Boolean).map(resolvePath)) {
    if (seen.has(item) || !existsSync(item)) continue;
    seen.add(item);
    resolved.push(item);
  }
  return resolved;
}

function parseArgs(argv) {
  const parsed = { inputRoot: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item === "--skip-defaults") parsed.skipDefaults = true;
    else if (item === "--no-include-all-zips") parsed.noIncludeAllZips = true;
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

function safeRootLabel(path) {
  const parent = basename(dirname(path));
  const leaf = basename(path);
  if (parent === "Downloads" && leaf === "Telegram Desktop") return "Telegram Desktop";
  return leaf || "inbox";
}

function toMarkdown(report) {
  const counts = report.counts ?? {};
  const latestScans = report.returnedWatch?.latestScans ?? [];
  const nextActions = report.nextActions ?? [];
  const lines = [
    "# Returned Downloads Findings",
    "",
    `Status: ${report.status}`,
    `Production evidence packets: ${counts.productionEvidencePackets ?? 0}`,
    `Returned evidence packets: ${counts.returnedEvidencePackets ?? 0}`,
    `Handoff packets: ${counts.handoffPackets ?? 0}`,
    `Diagnostic bundles: ${counts.diagnosticBundles ?? 0}`,
    `Unknown packets: ${counts.unknownPackets ?? 0}`,
    `Unreadable packets: ${counts.unreadablePackets ?? 0}`,
    "",
    "## Scope",
    "",
    "This note is metrics-only. It records the standard inbox scan without raw memories, prompts, transcripts, answers, credentials, private local paths, or private container names.",
    "",
    "## Inbox Labels",
    "",
    ...report.rootLabels.map((label) => `- ${label}`),
    "",
    "## Root Scan Summary",
    "",
    "| Inbox | Status | Candidates | Scanned zips | Production evidence | Handoff packets | Diagnostics | Unknown | Unreadable |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|",
    ...latestScans.map((scan) =>
      [
        `| ${scan.rootLabel}`,
        scan.status,
        scan.candidateCount,
        scan.scannedZipCount,
        scan.productionEvidencePackets,
        scan.handoffPackets,
        scan.diagnosticBundles,
        scan.unknownPackets,
        `${scan.unreadablePackets} |`,
      ].join(" | "),
    ),
    latestScans.length === 0
      ? "| none | NO_DEFAULT_INBOXES | 0 | 0 | 0 | 0 | 0 | 0 | 0 |"
      : null,
    "",
    "## Next Actions",
    "",
    ...nextActions.map((item) => `- ${item}`),
    nextActions.length === 0 ? "- No next action was emitted by the scanner." : null,
    "",
    "## Release Meaning",
    "",
    report.status === "PRODUCTION_CANARY_EVIDENCE_FOUND"
      ? "A returned packet was found. It still needs maintainer review before launch or rollout."
      : "No production canary evidence was found. Public launch and fleet rollout remain blocked.",
    "",
  ];
  return `${lines.filter((line) => line !== null).join("\n")}\n`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertSafeText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a raw local path`);
}

function sanitizeForOutput(text) {
  return String(text)
    .replace(/(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/)[^\s"']+/g, "<local-path>")
    .replace(/[A-Za-z]:\\Users\\[^\s"']+/g, "<local-path>");
}
