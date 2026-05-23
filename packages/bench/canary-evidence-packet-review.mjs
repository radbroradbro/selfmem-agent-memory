import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const strictReal = Boolean(args.strictReal);
const packetInput = args.packet || process.env.RECALLWEAVE_CANARY_PACKET_ZIP || "";
const tempRoot = mkdtempSync(join(tmpdir(), "recallweave-canary-packet-review-"));

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;
const forbiddenKeyPattern =
  /(?:rawMemory|rawMemories|rawTranscript|rawTranscripts|rawPrompt|rawPrompts|rawAnswer|rawAnswers|memoryText|transcriptText|promptText|answerText|messages|current_entries|memoriesJsonl|rawEventsJsonl|losslessContextJsonl|env|token|apiKey|authorization|cookie)/i;

try {
  const generatedFixturePacket = !packetInput;
  const packetPath = generatedFixturePacket ? buildFixturePacket() : resolvePath(packetInput);
  assert.ok(existsSync(packetPath), `canary evidence packet missing: ${packetInput || packetPath}`);
  assert.ok(statSync(packetPath).size > 0, "canary evidence packet is empty");

  const entries = listZip(packetPath);
  assertEntries(entries);

  const raw = Object.fromEntries(entries.map((entry) => [entry, readZipEntry(packetPath, entry)]));
  for (const [entry, text] of Object.entries(raw)) assertSafeText(text, entry);

  const json = {};
  for (const entry of entries.filter((entry) => entry.endsWith(".json"))) {
    json[entry] = JSON.parse(raw[entry]);
    const forbiddenKeys = findForbiddenKeys(json[entry]);
    assert.deepEqual(forbiddenKeys, [], `${entry} contains forbidden raw-content keys: ${forbiddenKeys.join(", ")}`);
  }

  const manifest = json["manifest.json"];
  const report = json["canary-report.json"];
  const intake = json["canary-intake.json"] ?? null;
  const diagnosis = json["canary-diagnosis.json"] ?? null;

  assert.equal(manifest.mode, "recallweave-canary-evidence-packet", "manifest mode mismatch");
  assert.equal(report.mode, "one-agent-canary-runtime-report", "report mode mismatch");
  if (intake) assert.equal(intake.mode, "canary-evidence-intake", "intake mode mismatch");
  if (diagnosis) assert.equal(diagnosis.mode, "canary-remediation-plan", "diagnosis mode mismatch");

  const manifestFiles = new Set((manifest.files ?? []).map((file) => file.name));
  for (const expected of entries.filter((entry) => !["README.md", "manifest.json"].includes(entry))) {
    assert.equal(manifestFiles.has(expected), true, `manifest does not list ${expected}`);
  }

  const fixtureOnly = Boolean(manifest.fixtureOnly || report.fixtureOnly || generatedFixturePacket);
  const canaryPass = Boolean(intake?.canaryPass ?? manifest.canaryPass);
  const countsAsRealRolloutEvidence = Boolean(intake?.countsAsRealRolloutEvidence ?? manifest.countsAsRealRolloutEvidence);
  const packagePassesStrictReal = Boolean(manifest.packagePassesStrictReal);
  const strictRealPassed = !fixtureOnly
    && canaryPass
    && countsAsRealRolloutEvidence
    && packagePassesStrictReal
    && intake?.strictRealPassed === true;

  const privacy = {
    reportPrivacyLeakCount: Number(report.privacy?.privacyLeakCount ?? 0),
    reportSecretPatternHits: Number(report.privacy?.secretPatternHits ?? 0),
    intakePrivacyLeakCount: Number(intake?.privacy?.privacyLeakCount ?? 0),
    intakeSecretPatternHits: Number(intake?.privacy?.secretPatternHits ?? 0),
    rawMemoryIncluded: Boolean(report.privacy?.rawMemoryIncluded || intake?.privacy?.rawMemoryIncluded),
    rawTranscriptIncluded: Boolean(report.privacy?.rawTranscriptIncluded || intake?.privacy?.rawTranscriptIncluded),
    rawPromptIncluded: Boolean(report.privacy?.rawPromptIncluded || intake?.privacy?.rawPromptIncluded),
    rawAnswerIncluded: Boolean(report.privacy?.rawAnswerIncluded || intake?.privacy?.rawAnswerIncluded),
  };

  const checks = [
    check("expected-entries", entries.includes("README.md") && entries.includes("manifest.json") && entries.includes("canary-report.json")),
    check("manifest-metrics-only", manifest.metricsOnly === true),
    check("manifest-no-launch", manifest.publicLaunchAllowed === false && manifest.fleetRolloutAllowed === false),
    check("report-mode", report.mode === "one-agent-canary-runtime-report"),
    check("report-agent-hash", /^agent_[a-f0-9]{8,}$/i.test(String(report.agent?.agentIdentityHash ?? intake?.target?.agentIdentityHash ?? ""))),
    check("report-container-hash", /^container_[a-f0-9]{8,}$/i.test(String(report.agent?.localContainerHash ?? intake?.target?.localContainerHash ?? ""))),
    check("strict-contract", (report.adapter?.strictCanaryContract ?? intake?.adapter?.strictCanaryContract) === "v1"),
    check("search-latency-marker", Boolean(report.adapter?.searchLatencyInstrumentation ?? intake?.adapter?.searchLatencyInstrumentation)),
    check("store-latency-marker", Boolean(report.adapter?.storeLatencyInstrumentation ?? intake?.adapter?.storeLatencyInstrumentation)),
    check("zero-privacy-leaks", privacy.reportPrivacyLeakCount === 0 && privacy.intakePrivacyLeakCount === 0),
    check("zero-secret-hits", privacy.reportSecretPatternHits === 0 && privacy.intakeSecretPatternHits === 0),
    check("no-raw-memory", privacy.rawMemoryIncluded === false),
    check("no-raw-transcript", privacy.rawTranscriptIncluded === false),
    check("no-raw-prompt", privacy.rawPromptIncluded === false),
    check("no-raw-answer", privacy.rawAnswerIncluded === false),
    check("fixture-does-not-count", fixtureOnly ? countsAsRealRolloutEvidence === false : true),
    check("strict-real-passed", strictReal ? strictRealPassed : true),
  ];
  const failedChecks = checks.filter((item) => !item.ok).map((item) => item.name);
  const strictFailureReason = strictReal && !strictRealPassed
    ? "strict-real review requires a non-fixture packet with passing strict-real intake evidence"
    : null;

  const output = {
    ok: !strictFailureReason && failedChecks.length === 0,
    mode: "canary-evidence-packet-review",
    writesRealFiles: generatedFixturePacket,
    metricsOnly: true,
    strictReal,
    strictRealPassed: strictReal ? strictRealPassed : null,
    strictFailureReason,
    generatedFixturePacket,
    fixtureOnly,
    canaryPass,
    countsAsRealRolloutEvidence,
    packagePassesStrictReal,
    countsAsProductionCanaryEvidence: strictRealPassed,
    publicLaunchAllowed: false,
    fleetRolloutAllowed: false,
    packet: {
      pathLabel: basename(packetPath),
      sha256: sha256(readFileSync(packetPath)),
      entries,
    },
    target: {
      host: report.agent?.host ?? intake?.target?.host ?? null,
      agentIdentityHash: report.agent?.agentIdentityHash ?? intake?.target?.agentIdentityHash ?? null,
      localContainerHash: report.agent?.localContainerHash ?? intake?.target?.localContainerHash ?? null,
      sourceContainerHash: report.agent?.sourceContainerHash ?? intake?.target?.sourceContainerHash ?? null,
      providerMode: report.provider?.mode ?? intake?.target?.providerMode ?? null,
    },
    adapter: {
      strictCanaryContract: report.adapter?.strictCanaryContract ?? intake?.adapter?.strictCanaryContract ?? null,
      searchLatencyInstrumentation: Boolean(report.adapter?.searchLatencyInstrumentation ?? intake?.adapter?.searchLatencyInstrumentation),
      storeLatencyInstrumentation: Boolean(report.adapter?.storeLatencyInstrumentation ?? intake?.adapter?.storeLatencyInstrumentation),
    },
    checks,
    failedChecks,
    nextActions: strictRealPassed
      ? [
          "Attach this metrics-only review output with the packet for maintainer approval.",
          "Keep fleet rollout blocked until the maintainer explicitly promotes the one-agent canary.",
        ]
      : [
          "Do not promote this packet to production canary evidence.",
          "Run canary:diagnose on the original canary report if the packet includes failing intake.",
          "Collect a fresh post-update runtime window and package it again.",
        ],
  };

  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  assertSafeText(serialized, "review output");
  process.stdout.write(serialized);
  if (strictFailureReason) process.exitCode = 1;
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

function buildFixturePacket() {
  const packetPath = join(tempRoot, "fixture-canary-evidence-packet.zip");
  const result = spawnSync("node", ["packages/bench/canary-evidence-packet.mjs", "--output", packetPath], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, `fixture packet build failed: ${result.stderr}`);
  assertSafeText(result.stdout, "fixture packet build output");
  return packetPath;
}

function listZip(zipPath) {
  const listed = spawnSync("unzip", ["-Z1", zipPath], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(listed.status, 0, `zip listing failed: ${listed.stderr}`);
  return listed.stdout.split(/\r?\n/).filter(Boolean).sort();
}

function readZipEntry(zipPath, entry) {
  const result = spawnSync("unzip", ["-p", zipPath, entry], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(result.status, 0, `zip extract failed for ${entry}: ${result.stderr}`);
  return result.stdout;
}

function assertEntries(entries) {
  const allowed = new Set(["README.md", "manifest.json", "canary-report.json", "canary-intake.json", "canary-diagnosis.json"]);
  assert.equal(entries.includes("README.md"), true, "packet missing README.md");
  assert.equal(entries.includes("manifest.json"), true, "packet missing manifest.json");
  assert.equal(entries.includes("canary-report.json"), true, "packet missing canary-report.json");
  for (const entry of entries) {
    assert.equal(allowed.has(entry), true, `packet contains unexpected entry: ${entry}`);
    assert.equal(entry.includes(".."), false, "packet contains unsafe relative path");
    assert.equal(entry.startsWith("/"), false, "packet contains absolute path");
  }
}

function assertSafeText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a raw local path`);
}

function check(name, ok) {
  return { name, ok: Boolean(ok) };
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
