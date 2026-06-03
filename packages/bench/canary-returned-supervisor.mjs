import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const reviewDir = String(args.reviewDir ?? "reviews/overnight-20260522");
const outputPath = args.output ? resolvePath(args.output) : null;
const findingsOutputPath = args.findingsOutput ? resolvePath(args.findingsOutput) : null;
const requireFound = Boolean(args.requireFound);
const includeAllZips = Boolean(args.includeAllZips);
const maxBytes = Number(args.maxBytes ?? 25 * 1024 * 1024);
const expectedCommit = normalizedCommit(args.expectedCommit || process.env.RECALLWEAVE_CANARY_EXPECTED_COMMIT || "");
const workspace = args.workspace
  ? resolvePath(args.workspace)
  : join(root, reviewDir, "next-agent-workspace");
const inputRoots = normalizeInputRoots(args);
const likelyReturnedNamePattern = /(?:canary|recallweave|selfmem|memory|openclaw|hermes)/i;

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|\/tmp\/|[A-Za-z]:\\Users\\)/;

const candidates = collectCandidates();
const inspected = candidates.map((candidate) => inspectCandidate(candidate));
const productionCandidates = inspected.filter((candidate) => candidate.countsAsProductionCanaryEvidence);
const selected = productionCandidates[0] ?? null;
const workspaceResult = selected ? buildReturnedWorkspace(selected.path) : null;
const counts = countCandidates(inspected, candidates);
const status = selected
  ? "PRODUCTION_CANARY_WORKSPACE_READY"
  : inputRoots.length === 0
    ? "NO_DEFAULT_INBOXES"
    : candidates.length === 0
      ? "NO_CANDIDATE_ZIPS"
      : "AWAITING_RETURNED_PRODUCTION_CANARY";
const ok = (!requireFound || Boolean(selected)) && inspected.every((candidate) => candidate.parseOk !== false);

const report = {
  ok,
  mode: "canary-returned-supervisor",
  writesRealFiles: Boolean(outputPath || findingsOutputPath || workspaceResult),
  metricsOnly: true,
  publicLaunchAllowed: false,
  fleetRolloutAllowed: false,
  requireFound,
  includeAllZips,
  maxBytes,
  status,
  sourceControl: {
    expectedCommit: expectedCommit || null,
  },
  input: {
    defaultInboxScan: !args.skipDefaults,
    discoveredRootCount: inputRoots.length,
    rootLabels: inputRoots.map((inputRoot) => safeRootLabel(inputRoot)),
    rootLabelsHash: sha256(inputRoots.map((inputRoot) => safeRootLabel(inputRoot)).join("\n")),
  },
  counts,
  selectedProductionPacket: selected
    ? {
        packetId: selected.packetId,
        sha256: selected.sha256,
        status: selected.status,
        review: selected.review,
        workspace: workspaceResult?.workspace ?? null,
      }
    : null,
  workspaceResult,
  candidates: inspected.map((candidate) => ({
    packetId: candidate.packetId,
    sha256: candidate.sha256,
    kind: candidate.kind,
    status: candidate.status,
    ok: candidate.ok,
    countsAsProductionCanaryEvidence: candidate.countsAsProductionCanaryEvidence,
    review: candidate.review,
  })),
  nextActions: selected
    ? [
        "Inspect the generated metrics-only returned workspace.",
        "Keep public launch and fleet rollout blocked until owner approval promotes the one-agent canary.",
      ]
    : [
        "Keep waiting for a returned metrics-only production canary evidence packet.",
        "Do not count canary request packets, diagnostic bundles, unreadable zips, or unknown zips as production evidence.",
        "Send the current OpenClaw next-agent request packet to exactly one selected agent if it has not been run yet.",
      ],
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
assertSafeText(serialized, "returned supervisor output");
if (outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, serialized, { encoding: "utf8", mode: 0o600 });
}
if (findingsOutputPath) {
  const markdown = toMarkdown(report);
  assertSafeText(markdown, "returned supervisor markdown");
  mkdirSync(dirname(findingsOutputPath), { recursive: true });
  writeFileSync(findingsOutputPath, markdown, { encoding: "utf8", mode: 0o600 });
}
process.stdout.write(serialized);
if (!report.ok) process.exitCode = 1;

function collectCandidates() {
  const output = [];
  const seen = new Set();
  for (const inputRoot of inputRoots) {
    for (const entry of readdirSync(inputRoot, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".zip")) continue;
      if (!includeAllZips && !likelyReturnedNamePattern.test(entry.name)) continue;
      const path = join(inputRoot, entry.name);
      if (seen.has(path)) continue;
      seen.add(path);
      const size = statSync(path).size;
      const sha = sha256(readFileSync(path));
      output.push({
        path,
        rootLabel: safeRootLabel(inputRoot),
        packetId: `zip-${sha.slice(0, 12)}`,
        sha256: sha,
        size,
        skippedLarge: size > maxBytes,
      });
    }
  }
  return output
    .sort((left, right) => statSync(right.path).mtimeMs - statSync(left.path).mtimeMs)
    .filter((candidate) => !candidate.skippedLarge);
}

function inspectCandidate(candidate) {
  const runArgs = [
    "packages/bench/canary-returned-inbox.mjs",
    "--packet",
    candidate.path,
    "--require-production-canary",
  ];
  if (expectedCommit) runArgs.push("--expected-commit", expectedCommit);
  const run = spawnSync("node", runArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assertSafeText(run.stdout, `${candidate.packetId} inbox stdout`);
  assertSafeText(run.stderr, `${candidate.packetId} inbox stderr`);
  try {
    const inbox = JSON.parse(run.stdout);
    const inspected = inbox.candidates?.[0] ?? {};
    return {
      ...candidate,
      parseOk: true,
      ok: Boolean(inspected.ok),
      kind: inspected.kind ?? "unknown",
      status: inspected.status ?? inbox.status ?? "UNKNOWN",
      countsAsProductionCanaryEvidence: inspected.countsAsProductionCanaryEvidence === true,
      review: inspected.review ?? null,
    };
  } catch (error) {
    return {
      ...candidate,
      parseOk: false,
      ok: false,
      kind: "unreadable-inbox-output",
      status: "UNREADABLE_INBOX_OUTPUT",
      countsAsProductionCanaryEvidence: false,
      review: {
        ok: false,
        failedChecks: ["unreadable-inbox-output"],
        strictFailureReason: sanitizeForOutput(error instanceof Error ? error.message : String(error)),
      },
    };
  }
}

function buildReturnedWorkspace(packetPath) {
  const outputPath = join(workspace, "returned-supervisor-workspace.json");
  const runArgs = [
    "packages/bench/canary-returned-workspace.mjs",
    "--packet",
    packetPath,
    "--workspace",
    workspace,
    "--require-production-canary",
    "--output",
    outputPath,
  ];
  const run = spawnSync("node", runArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assertSafeText(run.stdout, "returned workspace stdout");
  assertSafeText(run.stderr, "returned workspace stderr");
  const parsed = JSON.parse(run.stdout);
  assert.equal(parsed.countsAsProductionCanaryEvidence, true, "workspace must only be built for production canary evidence");
  return {
    ok: Boolean(parsed.ok),
    mode: parsed.mode,
    countsAsProductionCanaryEvidence: Boolean(parsed.countsAsProductionCanaryEvidence),
    workspace: parsed.workspace,
    intake: parsed.intake,
    childExitStatus: Number(run.status ?? 0),
  };
}

function countCandidates(items, rawCandidates) {
  return {
    candidateZipCount: rawCandidates.length,
    scannedZipCount: items.length,
    skippedLargeZipCount: rawCandidates.filter((candidate) => candidate.skippedLarge).length,
    returnedEvidencePackets: items.filter((candidate) => candidate.kind === "returned-evidence").length,
    productionEvidencePackets: items.filter((candidate) => candidate.countsAsProductionCanaryEvidence).length,
    handoffPackets: items.filter((candidate) => candidate.kind === "handoff-packet").length,
    diagnosticBundles: items.filter((candidate) => candidate.kind === "diagnostic-bundle").length,
    unknownPackets: items.filter((candidate) => candidate.kind === "unknown-zip").length,
    unreadablePackets: items.filter((candidate) => candidate.kind === "unreadable-zip").length,
    failedParseCount: items.filter((candidate) => candidate.parseOk === false).length,
  };
}

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
  for (const rootCandidate of roots.filter(Boolean).map(resolvePath)) {
    if (seen.has(rootCandidate) || !existsSync(rootCandidate)) continue;
    seen.add(rootCandidate);
    resolved.push(rootCandidate);
  }
  return resolved;
}

function parseArgs(argv) {
  const parsed = { inputRoot: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item === "--skip-defaults") parsed.skipDefaults = true;
    else if (item === "--include-all-zips") parsed.includeAllZips = true;
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

function toMarkdown(report) {
  const counts = report.counts ?? {};
  return [
    "# Returned Canary Supervisor",
    "",
    `Status: ${report.status}`,
    `Production evidence packets: ${counts.productionEvidencePackets ?? 0}`,
    `Returned evidence packets: ${counts.returnedEvidencePackets ?? 0}`,
    `Canary request packets: ${counts.handoffPackets ?? 0}`,
    `Diagnostic bundles: ${counts.diagnosticBundles ?? 0}`,
    `Unknown packets: ${counts.unknownPackets ?? 0}`,
    `Unreadable packets: ${counts.unreadablePackets ?? 0}`,
    "",
    "## Policy",
    "",
    "This supervisor is metrics-only. It does not include raw memories, prompts, transcripts, answers, credentials, or private local paths.",
    "It writes the returned workspace only after strict-real production canary evidence is found.",
    "Public launch and fleet rollout remain blocked until owner approval.",
    report.sourceControl?.expectedCommit ? `Expected report commit: \`${report.sourceControl.expectedCommit}\`.` : null,
    "",
    "## Selected Packet",
    "",
    report.selectedProductionPacket
      ? `- Selected packet: ${report.selectedProductionPacket.packetId}`
      : "- Selected packet: none",
    report.selectedProductionPacket?.workspace
      ? `- Workspace files: ${report.selectedProductionPacket.workspace.files.join(", ")}`
      : "- Workspace files: none",
    "",
    "## Next Actions",
    "",
    ...report.nextActions.map((item) => `- ${item}`),
    "",
  ].filter((line) => line !== null).join("\n");
}

function safeRootLabel(path) {
  const leaf = basename(path);
  const parent = basename(dirname(path));
  if (parent === "Downloads" && leaf === "Telegram Desktop") return "Telegram Desktop";
  return leaf || "inbox";
}

function resolvePath(value) {
  return isAbsolute(value) ? value : resolve(process.cwd(), value);
}

function normalizedCommit(value) {
  const commit = String(value ?? "").trim();
  if (!commit) return "";
  assert.match(commit, /^[a-f0-9]{7,40}$/i, "expected commit must be a git SHA prefix or full SHA");
  return commit.toLowerCase();
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
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
    .replace(/(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|\/tmp\/)[^\s"']+/g, "<local-path>")
    .replace(/[A-Za-z]:\\Users\\[^\s"']+/g, "<local-path>");
}
