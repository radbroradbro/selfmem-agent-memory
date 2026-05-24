import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const outputPath = args.output ? resolvePath(args.output) : join(tmpdir(), "recallweave-next-agent-handoff-packet.zip");
const requireReady = Boolean(args.requireReady);

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;
const allowedEntries = new Set([
  "README.md",
  "manifest.json",
  "next-agent-plan.json",
  "next-agent-plan.md",
  "strict-real-operator-packet.md",
  "strict-real-canary-drill.md",
]);

const planJsonRun = runNode("packages/bench/canary-next-agent-plan.mjs", [...plannerArgs(), "--format", "json"], { allowFailure: true });
const planJson = parseJsonStdout(planJsonRun, "next-agent plan JSON");
const planMarkdownRun = runNode("packages/bench/canary-next-agent-plan.mjs", [...plannerArgs(), "--format", "markdown"], { allowFailure: true });
const planMarkdown = planMarkdownRun.stdout || `${planJson.operatorMessage ?? ""}\n`;
const host = normalizeHost(args.host || planJson.decision?.host || planJson.selectedCandidate?.target?.host);
const blockedPlan = cannotBuildPacketFailure(planJson, host);
if (blockedPlan) {
  rmSync(outputPath, { force: true });
  const serialized = `${JSON.stringify(blockedPlan, null, 2)}\n`;
  assertSafeText(serialized, "blocked packet output");
  process.stdout.write(serialized);
  process.exit(1);
}
const operatorMarkdown = runNode("packages/bench/canary-operator-packet.mjs", ["--host", host, "--format", "markdown"]).stdout;
const drillMarkdown = runNode("packages/bench/canary-drill.mjs", ["--host", host, "--format", "markdown"]).stdout;
const sourceControl = readSourceControl();

const files = [
  {
    name: "next-agent-plan.json",
    raw: `${JSON.stringify(planJson, null, 2)}\n`,
    mode: planJson.mode,
  },
  {
    name: "next-agent-plan.md",
    raw: planMarkdown,
    mode: "canary-next-agent-plan-markdown",
  },
  {
    name: "strict-real-operator-packet.md",
    raw: operatorMarkdown,
    mode: "strict-real-canary-operator-packet-markdown",
  },
  {
    name: "strict-real-canary-drill.md",
    raw: drillMarkdown,
    mode: "strict-real-canary-drill-markdown",
  },
];

for (const file of files) assertSafeText(file.raw, file.name);

const manifest = {
  schemaVersion: 1,
  mode: "canary-next-agent-handoff-packet",
  generatedAt: new Date().toISOString(),
  writesRealFiles: true,
  publicSafe: true,
  metricsOnly: true,
  publicLaunchAllowed: false,
  fleetRolloutAllowed: false,
  sourceControl,
  oneAgentCanaryAllowed: Boolean(planJson.oneAgentCanaryAllowed),
  readyForLiveHandoff: Boolean(planJson.oneAgentCanaryAllowed && planJson.decision?.status === "READY_FOR_ONE_AGENT_FRESH_CANARY"),
  requireReadyPassed: !requireReady || Boolean(planJson.oneAgentCanaryAllowed && planJson.decision?.status === "READY_FOR_ONE_AGENT_FRESH_CANARY"),
  blockerPreserved: true,
  operatorPacketAvailable: Boolean(planJson.operatorPacketAvailable),
  host,
  status: planJson.decision?.status ?? null,
  recommendedScope: planJson.decision?.recommendedScope ?? null,
  selectedCandidate: planJson.selectedCandidate
    ? {
        label: planJson.selectedCandidate.label ?? null,
        failedChecks: planJson.selectedCandidate.failedChecks ?? [],
        recallP95: numberValue(planJson.selectedCandidate.latencyMs?.recallP95),
        storeP95: numberValue(planJson.selectedCandidate.latencyMs?.storeP95),
        storeLatencySampleCount: numberValue(planJson.selectedCandidate.instrumentation?.storeLatencySampleCount),
        privacyLeakCount: numberValue(planJson.selectedCandidate.privacy?.privacyLeakCount),
      }
    : null,
  batch: {
    sha256: planJson.batch?.sha256 ?? null,
    allowFailedInputs: Boolean(planJson.batch?.allowFailedInputs),
    inputCount: numberValue(planJson.batch?.inputCount),
    parsedInputCount: numberValue(planJson.batch?.parsedInputCount),
    failedInputCount: numberValue(planJson.batch?.failedInputCount),
    strictRealPassCount: numberValue(planJson.batch?.strictRealPassCount),
  },
  freshWindowContract: {
    purpose: "prove one real agent after the current adapter update",
    minimumMinutes: 15,
    requiresFreshPostUpdateWindow: true,
    requiresStrictReal: true,
    requiresNonFixtureEvidence: true,
    requiresRollbackTested: true,
    windowStartVariable: "FRESH_WINDOW_START",
    collectCommandId: "collect-live-window",
    expectedReportCommit: sourceControl.headSha,
    returnedPacketIntakeCommand:
      `npm exec --yes pnpm@10.23.0 -- canary:returned-packet -- --packet <returned-canary-evidence-packet.zip> --require-production-canary${sourceControl.headSha === "unknown" ? "" : ` --expected-commit ${sourceControl.headSha}`} --output /tmp/recallweave-returned-canary-intake.json`,
  },
  returnChecklist: [
    "apply the current adapter after recording FRESH_WINDOW_START",
    sourceControl.headSha === "unknown"
      ? "record the adapter commit shown by the runtime checkout before collection"
      : `collect the returned report with commit ${sourceControl.headSha}`,
    "follow strict-real-canary-drill.md during the fresh window",
    "run one mapped live agent for at least 15 minutes after the update",
    "collect strict-real evidence with --canary-since \"$FRESH_WINDOW_START\"",
    "prove rollback-tested true",
    "package only metrics-only canary evidence",
    "return no raw memories, transcripts, prompts, answers, credentials, cookies, or private local paths",
  ],
  files: files.map((file) => ({
    name: file.name,
    mode: file.mode,
    sha256: sha256(file.raw),
    bytes: Buffer.byteLength(file.raw),
  })),
  attachPolicy: {
    sendThisPacketTo: "one selected agent operator only",
    attachBackAfterRun: [
      "/tmp/recallweave-canary-report.json",
      "/tmp/recallweave-canary-intake.json",
      "/tmp/recallweave-canary-diagnosis.json if strict intake fails",
      "/tmp/recallweave-canary-evidence-packet.zip",
    ],
    forbidden: [
      "raw memories",
      "raw transcripts",
      "raw prompts",
      "raw answers",
      "provider keys",
      "cookies",
      "private local paths",
      "unredacted diagnostic archives",
    ],
  },
};

const manifestRaw = `${JSON.stringify(manifest, null, 2)}\n`;
const readmeRaw = buildReadme(manifest);
assertSafeText(manifestRaw, "manifest");
assertSafeText(readmeRaw, "README");
const readyFailure = requireReadyFailure(manifest);
if (readyFailure) {
  rmSync(outputPath, { force: true });
  const serialized = `${JSON.stringify(readyFailure, null, 2)}\n`;
  assertSafeText(serialized, "require-ready failure output");
  process.stdout.write(serialized);
  process.exit(1);
}

const tmpRoot = mkdtempSync(join(tmpdir(), "recallweave-next-agent-packet-"));
try {
  writeFileSync(join(tmpRoot, "README.md"), readmeRaw, { encoding: "utf8", mode: 0o600 });
  writeFileSync(join(tmpRoot, "manifest.json"), manifestRaw, { encoding: "utf8", mode: 0o600 });
  for (const file of files) writeFileSync(join(tmpRoot, file.name), file.raw, { encoding: "utf8", mode: 0o600 });

  rmSync(outputPath, { force: true });
  const zip = spawnSync("zip", ["-q", "-X", outputPath, ...[...allowedEntries]], {
    cwd: tmpRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(zip.status, 0, `zip failed: ${zip.stderr}`);
  assertSafeZip(outputPath);

  const output = {
    ok: true,
    mode: "canary-next-agent-handoff-packet",
    writesRealFiles: true,
    publicSafe: true,
    metricsOnly: true,
    publicLaunchAllowed: false,
    fleetRolloutAllowed: false,
    oneAgentCanaryAllowed: manifest.oneAgentCanaryAllowed,
    readyForLiveHandoff: manifest.readyForLiveHandoff,
    requireReadyPassed: manifest.requireReadyPassed,
    host,
    status: manifest.status,
    selectedCandidate: manifest.selectedCandidate,
    packet: {
      pathLabel: basename(outputPath),
      sha256: sha256(readFileSync(outputPath)),
      entries: listZip(outputPath),
    },
  };
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  assertSafeText(serialized, "packet output");
  process.stdout.write(serialized);
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}

function buildReadme(packetManifest) {
  return [
    "# RecallWeave Next-Agent Handoff Packet",
    "",
    "This packet gives one selected agent operator the exact fresh-canary steps.",
    "It is public-safe and metrics-only. It does not authorize fleet rollout or public launch.",
    "Canary means a bounded validation window, not the memory provider name.",
    "",
    `Host: ${packetManifest.host}.`,
    `Status: ${packetManifest.status}.`,
    `Scope: ${packetManifest.recommendedScope}.`,
    `Expected canary report commit: ${packetManifest.sourceControl.headSha}.`,
    "",
    "Read in this order:",
    "",
    "1. `next-agent-plan.md`",
    "2. `strict-real-operator-packet.md`",
    "3. `strict-real-canary-drill.md`",
    "4. `manifest.json`",
    "",
    "The selected operator should run the dry-run first, apply the current adapter only if the dry-run is sane, follow the deterministic drill during at least 15 minutes of real use, collect strict-real canary evidence, and return only the metrics-only evidence packet.",
    "",
    "Fresh-window contract:",
    "",
    `- Minimum runtime after update: ${packetManifest.freshWindowContract.minimumMinutes} minutes.`,
    "- Evidence must be post-update, strict-real, non-fixture, rollback-tested, and metrics-only.",
    `- The returned packet must report commit \`${packetManifest.sourceControl.headSha}\` unless the runtime proves a newer reviewed adapter commit.`,
    `- Record the update timestamp in \`${packetManifest.freshWindowContract.windowStartVariable}\` before applying the adapter.`,
    `- Collect evidence with the \`${packetManifest.freshWindowContract.collectCommandId}\` command in \`next-agent-plan.md\`.`,
    "",
    "Return checklist:",
    "",
    ...packetManifest.returnChecklist.map((item) => `- ${item}`),
    "",
    "When the operator returns a canary evidence packet, run:",
    "",
    `\`${packetManifest.freshWindowContract.returnedPacketIntakeCommand}\``,
    "",
    "Attach back only:",
    "",
    ...packetManifest.attachPolicy.attachBackAfterRun.map((item) => `- ${item}`),
    "",
    "Do not attach raw memories, transcripts, prompts, answers, provider keys, cookies, private local paths, or unredacted diagnostic archives.",
    "",
    `One-agent canary allowed by planner: ${packetManifest.oneAgentCanaryAllowed ? "yes" : "no"}.`,
    `Ready for live handoff: ${packetManifest.readyForLiveHandoff ? "yes" : "no"}.`,
    `Public launch allowed: ${packetManifest.publicLaunchAllowed ? "yes" : "no"}.`,
    `Fleet rollout allowed: ${packetManifest.fleetRolloutAllowed ? "yes" : "no"}.`,
    "",
  ].join("\n");
}

function requireReadyFailure(packetManifest) {
  if (!requireReady) return null;
  if (
    packetManifest.readyForLiveHandoff
    && packetManifest.oneAgentCanaryAllowed
    && packetManifest.status === "READY_FOR_ONE_AGENT_FRESH_CANARY"
    && packetManifest.freshWindowContract.requiresNonFixtureEvidence
  ) {
    return null;
  }
  return {
    ok: false,
    mode: "canary-next-agent-handoff-packet",
    publicSafe: true,
    metricsOnly: true,
    publicLaunchAllowed: false,
    fleetRolloutAllowed: false,
    oneAgentCanaryAllowed: packetManifest.oneAgentCanaryAllowed,
    readyForLiveHandoff: packetManifest.readyForLiveHandoff,
    requireReadyPassed: false,
    host: packetManifest.host,
    status: packetManifest.status,
    reason: "--require-ready needs READY_FOR_ONE_AGENT_FRESH_CANARY from non-fixture evidence",
  };
}

function cannotBuildPacketFailure(plan, normalizedHost) {
  const hasCandidate = Boolean(plan.selectedCandidate);
  const hasHost = normalizedHost !== "unknown";
  const operatorPacketAvailable = Boolean(plan.operatorPacketAvailable);
  if (hasCandidate && hasHost && operatorPacketAvailable) return null;
  return {
    ok: false,
    mode: "canary-next-agent-handoff-packet",
    writesRealFiles: false,
    publicSafe: true,
    metricsOnly: true,
    publicLaunchAllowed: false,
    fleetRolloutAllowed: false,
    oneAgentCanaryAllowed: false,
    readyForLiveHandoff: false,
    requireReadyPassed: false,
    blockerPreserved: true,
    packetCreated: false,
    host: normalizedHost,
    status: plan.decision?.status ?? "NO_CANDIDATE",
    recommendedScope: plan.decision?.recommendedScope ?? "blocked-before-agent-update",
    reason: !hasCandidate
      ? "No parsed canary candidate exists in the batch audit, so no handoff packet was created."
      : !hasHost
        ? "The candidate host is unknown, so no handoff packet was created."
        : "The next-agent planner did not make an operator packet available, so no handoff packet was created.",
    batch: {
      sha256: plan.batch?.sha256 ?? null,
      allowFailedInputs: Boolean(plan.batch?.allowFailedInputs),
      inputCount: numberValue(plan.batch?.inputCount),
      parsedInputCount: numberValue(plan.batch?.parsedInputCount),
      failedInputCount: numberValue(plan.batch?.failedInputCount),
      strictRealPassCount: numberValue(plan.batch?.strictRealPassCount),
    },
    blockReasons: Array.isArray(plan.decision?.blockReasons) ? plan.decision.blockReasons : [],
    nextActions: [
      "Do not install or promote an adapter from this packet command.",
      "Run canary:batch-audit on a redacted diagnostics folder that contains parseable canary reports.",
      "If the folder contains only handoff packets, send one handoff to a selected agent and wait for a returned evidence packet.",
      "If the host is known but not detected, rerun with --host hermes or --host openclaw after confirming the runtime.",
    ],
    forbidden: [
      "raw memories",
      "raw transcripts",
      "raw prompts",
      "raw answers",
      "provider keys",
      "cookies",
      "private local paths",
      "unredacted diagnostic archives",
    ],
  };
}

function plannerArgs() {
  const result = [];
  if (args.batch) result.push("--batch", args.batch);
  if (args.inputRoot) result.push("--input-root", args.inputRoot);
  if (args.diagnosticRoot) result.push("--diagnostic-root", args.diagnosticRoot);
  for (const input of asArray(args.input)) result.push("--input", input);
  if (args.allowFailedInputs) result.push("--allow-failed-inputs");
  if (args.candidateLabel) result.push("--candidate-label", args.candidateLabel);
  if (args.host) result.push("--host", args.host);
  return result;
}

function runNode(script, scriptArgs, options = {}) {
  const result = spawnSync("node", [script, ...scriptArgs], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.ok(result.stdout, `${script} produced no stdout`);
  if (!options.allowFailure) assert.equal(result.status, 0, `${script} failed: ${result.stderr || result.stdout}`);
  assertSafeText(result.stdout, `${script} stdout`);
  return result;
}

function readSourceControl() {
  const head = runGit(["rev-parse", "HEAD"]) || "unknown";
  const branch = runGit(["branch", "--show-current"]) || "unknown";
  return {
    headSha: head,
    branch,
    expectedReportCommit: head,
    commitRequiredForProductionCanary: head !== "unknown",
  };
}

function runGit(gitArgs) {
  const result = spawnSync("git", gitArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) return "";
  const value = result.stdout.trim();
  if (/^[a-f0-9]{40}$/i.test(value) || /^[A-Za-z0-9._/-]+$/.test(value)) return value;
  return "";
}

function parseJsonStdout(result, label) {
  assert.ok(result.stdout, `${label} missing`);
  assertSafeText(result.stdout, label);
  return JSON.parse(result.stdout);
}

function assertSafeZip(zipPath) {
  const entries = listZip(zipPath);
  assert.equal(entries.includes("README.md"), true, "packet missing README.md");
  assert.equal(entries.includes("manifest.json"), true, "packet missing manifest.json");
  assert.equal(entries.includes("next-agent-plan.json"), true, "packet missing next-agent-plan.json");
  assert.equal(entries.includes("next-agent-plan.md"), true, "packet missing next-agent-plan.md");
  assert.equal(entries.includes("strict-real-operator-packet.md"), true, "packet missing strict-real-operator-packet.md");
  for (const entry of entries) {
    assert.equal(allowedEntries.has(entry), true, `packet contains unexpected entry: ${entry}`);
    assert.equal(entry.includes(".."), false, "packet contains unsafe relative path");
    assert.equal(entry.startsWith("/"), false, "packet contains absolute path");
  }
}

function listZip(zipPath) {
  const listed = spawnSync("unzip", ["-Z1", zipPath], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(listed.status, 0, `zip listing failed: ${listed.stderr}`);
  return listed.stdout.split(/\r?\n/).filter(Boolean).sort();
}

function parseArgs(argv) {
  const parsed = {};
  const booleanFlags = new Set(["allowFailedInputs", "requireReady"]);
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item.startsWith("--")) {
      const key = toCamel(item.slice(2));
      if (booleanFlags.has(key)) {
        parsed[key] = true;
        continue;
      }
      const value = argv[index + 1] ?? "";
      if (key === "input") parsed.input = [...asArray(parsed.input), value];
      else parsed[key] = value;
      index += 1;
    }
  }
  return parsed;
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function resolvePath(value) {
  return isAbsolute(value) ? value : resolve(process.cwd(), value);
}

function normalizeHost(value) {
  const host = String(value ?? "").trim().toLowerCase();
  return ["hermes", "openclaw"].includes(host) ? host : "unknown";
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertSafeText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a raw local path`);
}
