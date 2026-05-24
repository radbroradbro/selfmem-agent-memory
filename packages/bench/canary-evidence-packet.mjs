import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const defaultReportPath = join(root, "packages/bench/fixtures/canary-runtime-report.fixture.json");
const args = parseArgs(process.argv.slice(2));
const strictReal = Boolean(args.strictReal);
const reportInput = args.report || process.env.RECALLWEAVE_CANARY_REPORT_JSON || defaultReportPath;
const intakeInput = args.intake || "";
const diagnosisInput = args.diagnosis || "";
const outputPath = args.output ? resolvePath(args.output) : join(tmpdir(), "recallweave-canary-evidence-packet.zip");
const expectedCommit = normalizedCommit(args.expectedCommit || process.env.RECALLWEAVE_CANARY_EXPECTED_COMMIT || "");

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;
const forbiddenKeyPattern =
  /(?:rawMemory|rawMemories|rawTranscript|rawTranscripts|rawPrompt|rawPrompts|rawAnswer|rawAnswers|memoryText|transcriptText|promptText|answerText|messages|current_entries|memoriesJsonl|rawEventsJsonl|losslessContextJsonl|env|token|apiKey|authorization|cookie)/i;

const inputs = [
  safeJsonInput("canary-report.json", reportInput, ["one-agent-canary-runtime-report"]),
];
if (intakeInput) inputs.push(safeJsonInput("canary-intake.json", intakeInput, ["canary-evidence-intake"]));
if (diagnosisInput) inputs.push(safeJsonInput("canary-diagnosis.json", diagnosisInput, ["canary-remediation-plan"]));

const report = inputs[0].json;
const intake = inputs.find((item) => item.name === "canary-intake.json")?.json ?? null;
const diagnosis = inputs.find((item) => item.name === "canary-diagnosis.json")?.json ?? null;
const fixtureOnly = Boolean(report.fixtureOnly || report.evidenceType === "fixture-trace-derived-canary-report" || inputs[0].path === defaultReportPath);
const countsAsRealRolloutEvidence = Boolean(intake?.countsAsRealRolloutEvidence);
const strictRealPassed = Boolean(intake?.strictRealPassed);
const canaryPass = Boolean(intake?.canaryPass ?? report.canaryPass);
const packagePassesStrictReal = !fixtureOnly && canaryPass && countsAsRealRolloutEvidence && strictRealPassed;
const reportCommit = String(report.commit ?? intake?.report?.commit ?? "");
const expectedReportCommit = expectedCommit || String(intake?.report?.expectedCommit ?? intake?.sourceControl?.expectedCommit ?? "");
const commitMatchesExpected = expectedReportCommit ? reportCommit === expectedReportCommit || reportCommit.startsWith(expectedReportCommit) : null;

if (strictReal) {
  assert.ok(intake, "--strict-real requires --intake from canary:intake --strict-real");
  assert.equal(packagePassesStrictReal, true, "strict-real packet requires passing live canary intake evidence");
  if (expectedReportCommit) assert.equal(commitMatchesExpected, true, "strict-real packet report commit does not match expected commit");
}

const tmpRoot = mkdtempSync(join(tmpdir(), "recallweave-canary-packet-"));
try {
  for (const input of inputs) writeFileSync(join(tmpRoot, input.name), input.raw, { encoding: "utf8", mode: 0o600 });
  const manifest = {
    schemaVersion: 1,
    mode: "recallweave-canary-evidence-packet",
    generatedAt: new Date().toISOString(),
    writesRealFiles: true,
    metricsOnly: true,
    strictReal,
    fixtureOnly,
    canaryPass,
    countsAsRealRolloutEvidence,
    packagePassesStrictReal: strictReal ? true : packagePassesStrictReal,
    publicLaunchAllowed: false,
    fleetRolloutAllowed: false,
    sourceControl: {
      reportCommit: reportCommit || null,
      expectedCommit: expectedReportCommit || null,
      commitMatchesExpected,
    },
    files: inputs.map((input) => ({
      name: input.name,
      sha256: input.sha256,
      mode: input.json.mode ?? null,
      bytes: Buffer.byteLength(input.raw),
    })),
    target: {
      host: report.agent?.host ?? intake?.target?.host ?? diagnosis?.target?.host ?? null,
      agentIdentityHash: report.agent?.agentIdentityHash ?? intake?.target?.agentIdentityHash ?? diagnosis?.target?.agentIdentityHash ?? null,
      localContainerHash: report.agent?.localContainerHash ?? intake?.target?.localContainerHash ?? diagnosis?.target?.localContainerHash ?? null,
      sourceContainerHash: report.agent?.sourceContainerHash ?? intake?.target?.sourceContainerHash ?? diagnosis?.target?.sourceContainerHash ?? null,
    },
    adapter: {
      strictCanaryContract: report.adapter?.strictCanaryContract ?? intake?.adapter?.strictCanaryContract ?? null,
      searchLatencyInstrumentation: Boolean(report.adapter?.searchLatencyInstrumentation ?? intake?.adapter?.searchLatencyInstrumentation),
      storeLatencyInstrumentation: Boolean(report.adapter?.storeLatencyInstrumentation ?? intake?.adapter?.storeLatencyInstrumentation),
    },
    attachPolicy: {
      allowed: ["canary-report.json", "canary-intake.json", "canary-diagnosis.json", "manifest.json", "README.md"],
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
  assertSafeText(manifestRaw, "manifest");
  writeFileSync(join(tmpRoot, "manifest.json"), manifestRaw, { encoding: "utf8", mode: 0o600 });
  const readmeRaw = buildReadme(manifest);
  assertSafeText(readmeRaw, "README");
  writeFileSync(join(tmpRoot, "README.md"), readmeRaw, { encoding: "utf8", mode: 0o600 });

  const zip = spawnSync("zip", ["-q", "-X", outputPath, ...["README.md", "manifest.json", ...inputs.map((input) => input.name)]], {
    cwd: tmpRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(zip.status, 0, `zip failed: ${zip.stderr}`);
  assertSafeZip(outputPath);

  const output = {
    ok: true,
    mode: "canary-evidence-packet",
    writesRealFiles: true,
    metricsOnly: true,
    strictReal,
    fixtureOnly,
    canaryPass,
    countsAsRealRolloutEvidence,
    packagePassesStrictReal: manifest.packagePassesStrictReal,
    packet: {
      pathLabel: basename(outputPath),
      sha256: sha256(readFileSync(outputPath)),
      entries: listZip(outputPath),
    },
    publicLaunchAllowed: false,
    fleetRolloutAllowed: false,
    sourceControl: manifest.sourceControl,
  };
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  assertSafeText(serialized, "packet output");
  process.stdout.write(serialized);
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}

function safeJsonInput(name, pathLike, allowedModes) {
  const inputPath = resolvePath(pathLike);
  assert.ok(existsSync(inputPath), `${name} input missing`);
  assert.ok(statSync(inputPath).size > 0, `${name} input empty`);
  const raw = readFileSync(inputPath, "utf8");
  assertSafeText(raw, name);
  const json = JSON.parse(raw);
  assert.ok(allowedModes.includes(json.mode), `${name} has unexpected mode: ${json.mode}`);
  const forbiddenKeys = findForbiddenKeys(json);
  assert.deepEqual(forbiddenKeys, [], `${name} contains forbidden raw-content keys: ${forbiddenKeys.join(", ")}`);
  return { name, path: inputPath, raw: `${JSON.stringify(json, null, 2)}\n`, json, sha256: sha256(raw) };
}

function buildReadme(manifest) {
  const verdict = manifest.packagePassesStrictReal
    ? "Strict-real canary packet passed. Maintainer review is still required before broader rollout."
    : "Diagnostic packet only. It does not authorize fleet rollout or public launch.";
  return [
    "# RecallWeave Canary Evidence Packet",
    "",
    verdict,
    "",
    "Attach this packet only when a reviewer asks for metrics-only canary evidence.",
    "",
    "Included files:",
    "",
    ...manifest.files.map((file) => `- ${file.name}: ${file.mode}, ${file.bytes} bytes`),
    "",
    "Not included: raw memories, transcripts, prompts, answers, provider keys, cookies, private local paths, or unredacted diagnostic archives.",
    "",
    `Counts as real rollout evidence: ${manifest.countsAsRealRolloutEvidence ? "yes" : "no"}.`,
    `Fleet rollout allowed: ${manifest.fleetRolloutAllowed ? "yes" : "no"}.`,
    `Public launch allowed: ${manifest.publicLaunchAllowed ? "yes" : "no"}.`,
    "",
  ].join("\n");
}

function assertSafeZip(zipPath) {
  const entries = listZip(zipPath);
  const allowed = new Set(["README.md", "manifest.json", "canary-report.json", "canary-intake.json", "canary-diagnosis.json"]);
  assert.ok(entries.length >= 3, "packet zip must include README, manifest, and report");
  for (const entry of entries) {
    assert.equal(allowed.has(entry), true, `packet contains unexpected entry: ${entry}`);
    assert.equal(entry.includes(".."), false, "packet contains unsafe relative path");
    assert.equal(entry.startsWith("/"), false, "packet contains absolute path");
  }
}

function listZip(zipPath) {
  const listed = spawnSync("unzip", ["-Z1", zipPath], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(listed.status, 0, `zip listing failed: ${listed.stderr}`);
  return listed.stdout.split(/\r?\n/).filter(Boolean).sort();
}

function assertSafeText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a raw local path`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item === "--strict-real") parsed.strictReal = true;
    else if (item.startsWith("--")) {
      parsed[toCamel(item.slice(2))] = argv[index + 1] ?? "";
      index += 1;
    }
  }
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

function normalizedCommit(value) {
  const commit = String(value ?? "").trim();
  if (!commit) return "";
  assert.match(commit, /^[a-f0-9]{7,40}$/i, "expected commit must be a git SHA prefix or full SHA");
  return commit;
}

function findForbiddenKeys(value, prefix = "") {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item, index) => findForbiddenKeys(item, `${prefix}[${index}]`));
  return Object.entries(value).flatMap(([key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const isAllowedRawPresenceFlag = /^(rawMemory|rawTranscript|rawPrompt|rawAnswer)Included$/.test(key);
    const self = forbiddenKeyPattern.test(key) && !isAllowedRawPresenceFlag ? [path] : [];
    return [...self, ...findForbiddenKeys(nested, path)];
  });
}
