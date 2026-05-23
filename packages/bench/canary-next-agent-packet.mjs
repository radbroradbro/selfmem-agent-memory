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

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;
const allowedEntries = new Set([
  "README.md",
  "manifest.json",
  "next-agent-plan.json",
  "next-agent-plan.md",
  "strict-real-operator-packet.md",
]);

const planJson = JSON.parse(runNode("packages/bench/canary-next-agent-plan.mjs", [...plannerArgs(), "--format", "json"]).stdout);
const planMarkdown = runNode("packages/bench/canary-next-agent-plan.mjs", [...plannerArgs(), "--format", "markdown"]).stdout;
const host = normalizeHost(args.host || planJson.decision?.host || planJson.selectedCandidate?.target?.host);
assert.notEqual(host, "unknown", "cannot build handoff packet for unknown host");
const operatorMarkdown = runNode("packages/bench/canary-operator-packet.mjs", ["--host", host, "--format", "markdown"]).stdout;

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
  oneAgentCanaryAllowed: Boolean(planJson.oneAgentCanaryAllowed),
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
    inputCount: numberValue(planJson.batch?.inputCount),
    parsedInputCount: numberValue(planJson.batch?.parsedInputCount),
    failedInputCount: numberValue(planJson.batch?.failedInputCount),
    strictRealPassCount: numberValue(planJson.batch?.strictRealPassCount),
  },
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
    "",
    `Host: ${packetManifest.host}.`,
    `Status: ${packetManifest.status}.`,
    `Scope: ${packetManifest.recommendedScope}.`,
    "",
    "Read in this order:",
    "",
    "1. `next-agent-plan.md`",
    "2. `strict-real-operator-packet.md`",
    "3. `manifest.json`",
    "",
    "The selected operator should run the dry-run first, apply the current adapter only if the dry-run is sane, run the agent for at least 15 minutes, collect strict-real canary evidence, and return only the metrics-only evidence packet.",
    "",
    "When the operator returns a canary evidence packet, run:",
    "",
    "`npm exec --yes pnpm@10.23.0 -- canary:returned-packet -- --packet <returned-canary-evidence-packet.zip> --require-production-canary --output /tmp/recallweave-returned-canary-intake.json`",
    "",
    "Attach back only:",
    "",
    ...packetManifest.attachPolicy.attachBackAfterRun.map((item) => `- ${item}`),
    "",
    "Do not attach raw memories, transcripts, prompts, answers, provider keys, cookies, private local paths, or unredacted diagnostic archives.",
    "",
    `One-agent canary allowed by planner: ${packetManifest.oneAgentCanaryAllowed ? "yes" : "no"}.`,
    `Public launch allowed: ${packetManifest.publicLaunchAllowed ? "yes" : "no"}.`,
    `Fleet rollout allowed: ${packetManifest.fleetRolloutAllowed ? "yes" : "no"}.`,
    "",
  ].join("\n");
}

function plannerArgs() {
  const result = [];
  if (args.batch) result.push("--batch", args.batch);
  if (args.inputRoot) result.push("--input-root", args.inputRoot);
  if (args.diagnosticRoot) result.push("--diagnostic-root", args.diagnosticRoot);
  for (const input of asArray(args.input)) result.push("--input", input);
  if (args.candidateLabel) result.push("--candidate-label", args.candidateLabel);
  if (args.host) result.push("--host", args.host);
  return result;
}

function runNode(script, scriptArgs) {
  const result = spawnSync("node", [script, ...scriptArgs], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.ok(result.stdout, `${script} produced no stdout`);
  assert.equal(result.status, 0, `${script} failed: ${result.stderr || result.stdout}`);
  assertSafeText(result.stdout, `${script} stdout`);
  return result;
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
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item.startsWith("--")) {
      const key = toCamel(item.slice(2));
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
