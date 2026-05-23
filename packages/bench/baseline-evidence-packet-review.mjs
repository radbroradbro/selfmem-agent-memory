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
const packetInput = args.packet || process.env.RECALLWEAVE_BASELINE_PACKET_ZIP || "";
const tempRoot = mkdtempSync(join(tmpdir(), "recallweave-baseline-packet-review-"));

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;
const forbiddenKeyPattern =
  /^(?:rawMemory|rawMemories|rawTranscript|rawTranscripts|rawPrompt|rawPrompts|rawAnswer|rawAnswers|memoryText|transcriptText|promptText|answerText|messages|current_entries|memoriesJsonl|rawEventsJsonl|losslessContextJsonl|env|token|apiKey|authorization|cookie)$/i;

try {
  const generatedFixturePacket = !packetInput;
  const packetPath = generatedFixturePacket ? buildFixturePacket() : resolvePath(packetInput);
  assert.ok(existsSync(packetPath), `baseline evidence packet missing: ${packetInput || packetPath}`);
  assert.ok(statSync(packetPath).size > 0, "baseline evidence packet is empty");

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
  const hosted = json["hosted-baseline-result.json"];
  const recallWeave = json["recallweave-result.json"];
  const comparison = json["baseline-comparison.json"];
  const preflight = json["hosted-baseline-preflight.json"];

  assert.equal(manifest.mode, "recallweave-baseline-evidence-packet", "manifest mode mismatch");
  assert.equal(hosted.provider ?? hosted.baselineProvider, "hosted-supermemory", "hosted provider mismatch");
  assert.equal(recallWeave.provider ?? recallWeave.baselineProvider, "recallweave", "RecallWeave provider mismatch");
  assert.equal(comparison.mode, "baseline-comparison", "comparison mode mismatch");
  assert.equal(preflight.mode, "hosted-baseline-preflight", "preflight mode mismatch");

  const manifestFiles = new Set((manifest.files ?? []).map((file) => file.name));
  for (const expected of entries.filter((entry) => !["README.md", "manifest.json"].includes(entry))) {
    assert.equal(manifestFiles.has(expected), true, `manifest does not list ${expected}`);
  }

  const fixtureOnly = Boolean(
    manifest.fixtureOnly ||
      hosted.fixtureOnly ||
      recallWeave.fixtureOnly ||
      comparison.fixtureOnly ||
      preflight.resultInspection?.fixtureOnly ||
      generatedFixturePacket,
  );
  const countsAsHostedBaselineEvidence = Boolean(manifest.countsAsHostedBaselineEvidence && preflight.countsAsHostedBaselineEvidence);
  const countsAsComparisonEvidence = Boolean(manifest.countsAsComparisonEvidence && comparison.countsAsComparisonEvidence);
  const packagePassesStrictReal = Boolean(manifest.packagePassesStrictReal);
  const publicBenchmarkClaimsAllowed = Boolean(manifest.publicBenchmarkClaimsAllowed && comparison.publicBenchmarkClaimsAllowed && preflight.publicBenchmarkClaimsAllowed);
  const recallWeaveWin = Boolean(comparison.recallWeaveWin);
  const reviewerApprovalCount = Number(comparison.reviewerApprovalCount ?? preflight.reviewerApprovalCount ?? 0);
  const strictRealPassed = !fixtureOnly && countsAsHostedBaselineEvidence && countsAsComparisonEvidence && packagePassesStrictReal;

  const privacy = {
    hostedPrivacyLeakCount: Number(hosted.privacyLeakCount ?? hosted.privacy?.privacyLeakCount ?? hosted.privacy?.leakCount ?? 0),
    hostedRedactionFailureCount: Number(hosted.redactionFailureCount ?? hosted.privacy?.redactionFailureCount ?? hosted.redactionFailures ?? 0),
    recallWeavePrivacyLeakCount: Number(recallWeave.privacyLeakCount ?? recallWeave.privacy?.privacyLeakCount ?? recallWeave.privacy?.leakCount ?? 0),
    recallWeaveRedactionFailureCount: Number(recallWeave.redactionFailureCount ?? recallWeave.privacy?.redactionFailureCount ?? recallWeave.redactionFailures ?? 0),
    comparisonPrivacyLeakCount: Number(comparison.privacy?.privacyLeakCount ?? 0),
    comparisonRedactionFailureCount: Number(comparison.privacy?.redactionFailureCount ?? 0),
    rawMemoryIncluded: Boolean(hosted.rawMemoryIncluded || recallWeave.rawMemoryIncluded || comparison.privacy?.rawMemoryIncluded),
    rawTranscriptIncluded: Boolean(hosted.rawTranscriptIncluded || recallWeave.rawTranscriptIncluded || comparison.privacy?.rawTranscriptIncluded),
    rawPromptIncluded: Boolean(hosted.rawPromptIncluded || recallWeave.rawPromptIncluded || comparison.privacy?.rawPromptIncluded),
    rawAnswerIncluded: Boolean(hosted.rawAnswerIncluded || recallWeave.rawAnswerIncluded || comparison.privacy?.rawAnswerIncluded),
  };

  const checks = [
    check("expected-entries", entries.length === 6 && entries.includes("README.md") && entries.includes("manifest.json")),
    check("manifest-metrics-only", manifest.metricsOnly === true),
    check("manifest-no-launch", manifest.publicLaunchAllowed === false),
    check("hosted-provider", (hosted.provider ?? hosted.baselineProvider) === "hosted-supermemory"),
    check("recallweave-provider", (recallWeave.provider ?? recallWeave.baselineProvider) === "recallweave"),
    check("comparison-mode", comparison.mode === "baseline-comparison"),
    check("preflight-mode", preflight.mode === "hosted-baseline-preflight"),
    check("hosted-baseline-evidence", strictReal ? countsAsHostedBaselineEvidence : true),
    check("comparison-evidence", strictReal ? countsAsComparisonEvidence : true),
    check("recallweave-win", strictReal ? recallWeaveWin : true),
    check("zero-privacy-leaks", privacy.hostedPrivacyLeakCount === 0 && privacy.recallWeavePrivacyLeakCount === 0 && privacy.comparisonPrivacyLeakCount === 0),
    check("zero-redaction-failures", privacy.hostedRedactionFailureCount === 0 && privacy.recallWeaveRedactionFailureCount === 0 && privacy.comparisonRedactionFailureCount === 0),
    check("no-raw-memory", privacy.rawMemoryIncluded === false),
    check("no-raw-transcript", privacy.rawTranscriptIncluded === false),
    check("no-raw-prompt", privacy.rawPromptIncluded === false),
    check("no-raw-answer", privacy.rawAnswerIncluded === false),
    check("fixture-does-not-count", fixtureOnly ? countsAsHostedBaselineEvidence === false && countsAsComparisonEvidence === false : true),
    check("strict-real-passed", strictReal ? strictRealPassed : true),
  ];
  const failedChecks = checks.filter((item) => !item.ok).map((item) => item.name);
  const strictFailureReason = strictReal && !strictRealPassed
    ? "strict-real review requires a non-fixture packet with hosted, RecallWeave, comparison, and preflight evidence"
    : null;

  const output = {
    ok: !strictFailureReason && failedChecks.length === 0,
    mode: "baseline-evidence-packet-review",
    writesRealFiles: generatedFixturePacket,
    metricsOnly: true,
    strictReal,
    strictRealPassed: strictReal ? strictRealPassed : null,
    strictFailureReason,
    generatedFixturePacket,
    fixtureOnly,
    countsAsHostedBaselineEvidence,
    countsAsComparisonEvidence,
    packagePassesStrictReal,
    recallWeaveWin,
    reviewerApprovalCount,
    publicBenchmarkClaimsAllowed,
    countsAsProductionBaselineEvidence: strictRealPassed,
    countsAsPublicBenchmarkEvidence: strictRealPassed && publicBenchmarkClaimsAllowed,
    publicLaunchAllowed: false,
    packet: {
      pathLabel: basename(packetPath),
      sha256: sha256(readFileSync(packetPath)),
      entries,
    },
    target: {
      hostedProvider: hosted.provider ?? hosted.baselineProvider ?? null,
      recallWeaveProvider: recallWeave.provider ?? recallWeave.baselineProvider ?? null,
      datasetSlice: hosted.datasetSlice ?? hosted.benchmarkSlice ?? comparison.hosted?.datasetSlice ?? null,
      querySetHash: hosted.querySetHash ?? comparison.hosted?.querySetHash ?? null,
      scoringCodeHash: hosted.scoringCodeHash ?? comparison.hosted?.scoringCodeHash ?? null,
      judgeModel: hosted.judgeModel ?? comparison.hosted?.judgeModel ?? null,
      answerModel: hosted.answerModel ?? comparison.hosted?.answerModel ?? null,
    },
    comparison: {
      recallWeaveWin,
      reviewerApprovalCount,
      failedChecks: comparison.failedChecks ?? [],
    },
    checks,
    failedChecks,
    nextActions: strictRealPassed
      ? [
          "Attach this metrics-only review output with the packet for maintainer approval.",
          publicBenchmarkClaimsAllowed
            ? "Public benchmark comparison language may move to owner review, but public launch remains blocked until explicit approval."
            : "Do not publish comparison claims until two reviewer approvals are recorded and publicBenchmarkClaimsAllowed is true.",
        ]
      : [
          "Do not count this packet as hosted baseline evidence.",
          "If this was a fixture packet, rerun with --packet pointing to the returned hosted-baseline evidence zip.",
          "If this was a real packet, inspect review.failedChecks and ask for a fresh metrics-only hosted baseline packet.",
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
  const packetPath = join(tempRoot, "fixture-baseline-evidence-packet.zip");
  const result = spawnSync("node", ["packages/bench/baseline-evidence-packet.mjs", "--output", packetPath], {
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
  const allowed = new Set([
    "README.md",
    "manifest.json",
    "hosted-baseline-result.json",
    "recallweave-result.json",
    "baseline-comparison.json",
    "hosted-baseline-preflight.json",
  ]);
  for (const expected of allowed) assert.equal(entries.includes(expected), true, `packet missing ${expected}`);
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
    const isAllowedRawPresenceFlag = /^(rawMemory|rawTranscript|rawPrompt|rawAnswer)Included$|^includesRaw(Memory|Transcript|Prompt|Answer)Text$/.test(key);
    const self = forbiddenKeyPattern.test(key) && !isAllowedRawPresenceFlag ? [path] : [];
    const unsafeAllowedFlag = isAllowedRawPresenceFlag && Boolean(nested) === true ? [path] : [];
    return [...self, ...unsafeAllowedFlag, ...findForbiddenKeys(nested, path)];
  });
}
