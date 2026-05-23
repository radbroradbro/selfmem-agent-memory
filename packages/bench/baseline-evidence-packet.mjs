import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const strictReal = Boolean(args.strictReal);
const outputPath = args.output ? resolvePath(args.output) : join(tmpdir(), "recallweave-baseline-evidence-packet.zip");
const hostedInput = args.hosted ?? args.hostedResult ?? process.env.RECALLWEAVE_HOSTED_BASELINE_RESULT_JSON ?? "packages/bench/fixtures/hosted-baseline-result.fixture.json";
const recallWeaveInput = args.recallweave ?? args.recallWeave ?? args.recallweaveResult ?? process.env.RECALLWEAVE_RESULT_JSON ?? "packages/bench/fixtures/recallweave-baseline-result.fixture.json";
const comparisonInput = args.comparison ?? process.env.RECALLWEAVE_BASELINE_COMPARISON_JSON ?? "";
const preflightInput = args.preflight ?? process.env.RECALLWEAVE_BASELINE_PREFLIGHT_JSON ?? "";

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;
const forbiddenRawKeys =
  /^(?:rawMemory|rawMemories|rawTranscript|rawTranscripts|rawPrompt|rawPrompts|rawAnswer|rawAnswers|memoryText|transcriptText|promptText|answerText|messages|current_entries|memoriesJsonl|rawEventsJsonl|losslessContextJsonl|env|token|apiKey|authorization|cookie)$/i;
const allowedFalseFlags =
  /^(?:rawMemoryIncluded|rawTranscriptIncluded|rawPromptIncluded|rawAnswerIncluded|includesRawMemoryText|includesRawTranscriptText|includesRawPromptText|includesRawAnswerText|rawResponseTextAllowed)$/;

const hosted = safeJsonInput("hosted-baseline-result.json", hostedInput, (json, label) => {
  assert.equal(json.provider ?? json.baselineProvider, "hosted-supermemory", `${label} provider must be hosted-supermemory`);
});
const recallWeave = safeJsonInput("recallweave-result.json", recallWeaveInput, (json, label) => {
  assert.equal(json.provider ?? json.baselineProvider, "recallweave", `${label} provider must be recallweave`);
});
const comparison = comparisonInput
  ? safeJsonInput("baseline-comparison.json", comparisonInput, assertComparison)
  : generatedJsonInput("baseline-comparison.json", [
      "packages/bench/baseline-comparison.mjs",
      "--hosted",
      hosted.path,
      "--recallweave",
      recallWeave.path,
    ], assertComparison);
if (strictReal && !preflightInput) {
  assert.fail("--strict-real baseline packet requires --preflight from baseline:preflight -- --result <hosted-result>");
}
const preflight = preflightInput
  ? safeJsonInput("hosted-baseline-preflight.json", preflightInput, assertPreflight)
  : generatedJsonInput("hosted-baseline-preflight.json", null, assertPreflight);

const inputs = [hosted, recallWeave, comparison, preflight];
const hostedReal = !isFixture(hosted.json) && hosted.json.metricsOnly === true && privacyClean(hosted.json);
const recallWeaveReal = !isFixture(recallWeave.json) && recallWeave.json.metricsOnly === true && privacyClean(recallWeave.json);
const comparisonReal = !isFixture(comparison.json) && comparison.json.countsAsComparisonEvidence === true && comparison.json.metricsOnly === true && comparisonPrivacyClean(comparison.json);
const preflightReal = !isFixture(preflight.json) && preflight.json.countsAsHostedBaselineEvidence === true && preflight.json.metricsOnly === true;
const fixtureOnly = inputs.some((input) => isFixture(input.json));
const countsAsHostedBaselineEvidence = hostedReal && preflightReal;
const countsAsComparisonEvidence = comparisonReal;
const packagePassesStrictReal = hostedReal && recallWeaveReal && comparisonReal && preflightReal;
const publicBenchmarkClaimsAllowed = Boolean(comparison.json.publicBenchmarkClaimsAllowed && preflight.json.publicBenchmarkClaimsAllowed);

if (strictReal) {
  assert.equal(packagePassesStrictReal, true, "strict-real baseline packet requires real hosted, RecallWeave, comparison, and preflight evidence");
}

const tmpRoot = mkdtempSync(join(tmpdir(), "recallweave-baseline-packet-"));
try {
  for (const input of inputs) writeFileSync(join(tmpRoot, input.name), input.raw, { encoding: "utf8", mode: 0o600 });
  const manifest = {
    schemaVersion: 1,
    mode: "recallweave-baseline-evidence-packet",
    generatedAt: new Date().toISOString(),
    writesRealFiles: true,
    metricsOnly: true,
    strictReal,
    fixtureOnly,
    countsAsHostedBaselineEvidence,
    countsAsComparisonEvidence,
    packagePassesStrictReal: strictReal ? true : packagePassesStrictReal,
    publicBenchmarkClaimsAllowed,
    publicLaunchAllowed: false,
    files: inputs.map((input) => ({
      name: input.name,
      sha256: input.sha256,
      provider: input.json.provider ?? null,
      mode: input.json.mode ?? null,
      evidenceType: input.json.evidenceType ?? null,
      fixtureOnly: isFixture(input.json),
      bytes: Buffer.byteLength(input.raw),
    })),
    comparison: {
      recallWeaveWin: Boolean(comparison.json.recallWeaveWin),
      reviewerApprovalCount: Number(comparison.json.reviewerApprovalCount ?? 0),
      failedChecks: comparison.json.failedChecks ?? [],
    },
    attachPolicy: {
      allowed: [
        "README.md",
        "manifest.json",
        "hosted-baseline-result.json",
        "recallweave-result.json",
        "baseline-comparison.json",
        "hosted-baseline-preflight.json",
      ],
      forbidden: [
        "raw hosted memories",
        "raw local memories",
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

  const zip = spawnSync(
    "zip",
    ["-q", "-X", outputPath, ...["README.md", "manifest.json", ...inputs.map((input) => input.name)]],
    { cwd: tmpRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  assert.equal(zip.status, 0, `zip failed: ${zip.stderr}`);
  assertSafeZip(outputPath);

  const output = {
    ok: true,
    mode: "baseline-evidence-packet",
    writesRealFiles: true,
    metricsOnly: true,
    strictReal,
    fixtureOnly,
    countsAsHostedBaselineEvidence,
    countsAsComparisonEvidence,
    packagePassesStrictReal: manifest.packagePassesStrictReal,
    publicBenchmarkClaimsAllowed,
    publicLaunchAllowed: false,
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

function safeJsonInput(name, pathLike, validate) {
  const inputPath = resolvePath(pathLike);
  assert.ok(existsSync(inputPath), `${name} input missing`);
  assert.ok(statSync(inputPath).size > 0, `${name} input empty`);
  const raw = readFileSync(inputPath, "utf8");
  return normalizeJsonInput(name, inputPath, raw, validate);
}

function generatedJsonInput(name, commandArgs, validate) {
  if (!commandArgs) {
    return normalizeJsonInput(name, null, `${JSON.stringify(buildFixturePreflight(hosted.json), null, 2)}\n`, validate);
  }
  const result = spawnSync("node", commandArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, `${name} generation failed: ${result.stderr}`);
  return normalizeJsonInput(name, null, result.stdout, validate);
}

function buildFixturePreflight(hostedResult) {
  return {
    ok: true,
    mode: "hosted-baseline-preflight",
    writesRealFiles: false,
    callsHostedProvider: false,
    metricsOnly: true,
    liveRequested: false,
    liveInputReady: false,
    hostedBaselineFresh: false,
    countsAsHostedBaselineEvidence: false,
    matchedRecallWeaveRunPresent: Boolean(hostedResult.matchedRecallWeaveRunPresent),
    reviewerApprovalCount: Number(hostedResult.reviewerApprovalCount ?? 0),
    recallWeaveWin: Boolean(hostedResult.recallWeaveWin),
    benchmarkClaimsAllowed: false,
    publicBenchmarkClaimsAllowed: false,
    resultInspection: {
      provider: hostedResult.provider ?? hostedResult.baselineProvider ?? null,
      fixtureOnly: isFixture(hostedResult),
      metricsOnly: hostedResult.metricsOnly === true,
      privacyLeakCount: Number(hostedResult.privacyLeakCount ?? 0),
      redactionFailureCount: Number(hostedResult.redactionFailureCount ?? 0),
      rawMemoryIncluded: Boolean(hostedResult.rawMemoryIncluded ?? false),
      rawTranscriptIncluded: Boolean(hostedResult.rawTranscriptIncluded ?? false),
      rawPromptIncluded: Boolean(hostedResult.rawPromptIncluded ?? false),
      rawAnswerIncluded: Boolean(hostedResult.rawAnswerIncluded ?? false),
    },
  };
}

function normalizeJsonInput(name, inputPath, raw, validate) {
  assertSafeText(raw, name);
  const json = JSON.parse(raw);
  validate(json, name);
  const forbiddenKeys = findForbiddenKeys(json);
  assert.deepEqual(forbiddenKeys, [], `${name} contains forbidden raw-content keys: ${forbiddenKeys.join(", ")}`);
  const normalizedRaw = `${JSON.stringify(json, null, 2)}\n`;
  assertSafeText(normalizedRaw, name);
  return { name, path: inputPath ?? null, raw: normalizedRaw, json, sha256: sha256(raw) };
}

function assertComparison(json, label) {
  assert.equal(json.mode, "baseline-comparison", `${label} mode must be baseline-comparison`);
  assert.equal(json.metricsOnly, true, `${label} must be metrics-only`);
  assert.equal(json.hosted?.provider, "hosted-supermemory", `${label} hosted provider must be hosted-supermemory`);
  assert.equal(json.recallWeave?.provider, "recallweave", `${label} RecallWeave provider must be recallweave`);
}

function assertPreflight(json, label) {
  assert.equal(json.mode, "hosted-baseline-preflight", `${label} mode must be hosted-baseline-preflight`);
  assert.equal(json.metricsOnly, true, `${label} must be metrics-only`);
  assert.equal(json.callsHostedProvider, false, `${label} must be a validator output, not a hosted provider call`);
}

function buildReadme(manifest) {
  const verdict = manifest.packagePassesStrictReal
    ? "Strict-real hosted baseline packet passed. Public benchmark claims still require reviewer approval and owner approval."
    : "Diagnostic or fixture packet only. It does not authorize public benchmark claims or launch.";
  return [
    "# RecallWeave Hosted Baseline Evidence Packet",
    "",
    verdict,
    "",
    "Attach this packet only when a reviewer asks for aggregate hosted-baseline evidence.",
    "",
    "Included files:",
    "",
    ...manifest.files.map((file) => `- ${file.name}: ${file.mode ?? file.provider ?? file.evidenceType}, ${file.bytes} bytes`),
    "",
    "Not included: raw hosted memories, raw local memories, transcripts, prompts, answers, provider keys, cookies, private local paths, or unredacted diagnostic archives.",
    "",
    `Counts as hosted baseline evidence: ${manifest.countsAsHostedBaselineEvidence ? "yes" : "no"}.`,
    `Counts as comparison evidence: ${manifest.countsAsComparisonEvidence ? "yes" : "no"}.`,
    `Public benchmark claims allowed: ${manifest.publicBenchmarkClaimsAllowed ? "yes" : "no"}.`,
    `Public launch allowed: ${manifest.publicLaunchAllowed ? "yes" : "no"}.`,
    "",
  ].join("\n");
}

function assertSafeZip(zipPath) {
  const entries = listZip(zipPath);
  const allowed = new Set(["README.md", "manifest.json", "hosted-baseline-result.json", "recallweave-result.json", "baseline-comparison.json", "hosted-baseline-preflight.json"]);
  assert.equal(entries.length, allowed.size, "baseline packet must include exactly README, manifest, hosted, RecallWeave, comparison, and preflight JSON");
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

function isFixture(json) {
  return Boolean(json.fixtureOnly || String(json.evidenceType ?? "").toLowerCase().includes("fixture"));
}

function privacyClean(json) {
  return (
    Number(json.privacyLeakCount ?? json.privacy?.privacyLeakCount ?? json.privacy?.leakCount ?? 0) === 0 &&
    Number(json.redactionFailureCount ?? json.privacy?.redactionFailureCount ?? json.redactionFailures ?? 0) === 0 &&
    Boolean(json.rawMemoryIncluded ?? json.includesRawMemoryText ?? false) === false &&
    Boolean(json.rawTranscriptIncluded ?? json.includesRawTranscriptText ?? false) === false &&
    Boolean(json.rawPromptIncluded ?? json.includesRawPromptText ?? false) === false &&
    Boolean(json.rawAnswerIncluded ?? json.includesRawAnswerText ?? false) === false
  );
}

function comparisonPrivacyClean(json) {
  const privacy = json.privacy ?? {};
  return (
    Number(privacy.privacyLeakCount ?? 0) === 0 &&
    Number(privacy.redactionFailureCount ?? 0) === 0 &&
    Boolean(privacy.rawMemoryIncluded ?? false) === false &&
    Boolean(privacy.rawTranscriptIncluded ?? false) === false &&
    Boolean(privacy.rawPromptIncluded ?? false) === false &&
    Boolean(privacy.rawAnswerIncluded ?? false) === false
  );
}

function findForbiddenKeys(value, prefix = "") {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item, index) => findForbiddenKeys(item, `${prefix}[${index}]`));
  return Object.entries(value).flatMap(([key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const allowedFlag = allowedFalseFlags.test(key);
    const self = forbiddenRawKeys.test(key) && !allowedFlag ? [path] : [];
    const unsafeAllowedFlag = allowedFlag && Boolean(nested) === true ? [path] : [];
    return [...self, ...unsafeAllowedFlag, ...findForbiddenKeys(nested, path)];
  });
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
  return isAbsolute(value) ? value : resolve(root, value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
