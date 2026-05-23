import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const tempRoot = mkdtempSync(join(tmpdir(), "recallweave-canary-batch-"));
const requireRealPass = Boolean(args.requireRealPass);

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;
const defaultFixtureInput = join(root, "packages/bench/fixtures/canary-diagnostic-export.fixture");

try {
  const inputs = collectInputs(args);
  assert.ok(inputs.length > 0, "no diagnostic inputs found");

  const results = inputs.map((input, index) => auditInput(input, index));
  const parsedResults = results.filter((item) => item.status === "parsed");
  const strictRealPasses = parsedResults.filter((item) => item.countsAsRealRolloutEvidence);
  const bestCandidate = rankCandidates(parsedResults)[0] ?? null;
  const failedInputs = results.filter((item) => item.status !== "parsed");
  const ok = failedInputs.length === 0 && (!requireRealPass || strictRealPasses.length > 0);

  const output = {
    ok,
    mode: "canary-diagnostic-batch-audit",
    writesRealFiles: false,
    metricsOnly: true,
    requireRealPass,
    publicLaunchAllowed: false,
    fleetRolloutAllowed: false,
    inputCount: inputs.length,
    parsedInputCount: parsedResults.length,
    failedInputCount: failedInputs.length,
    strictRealPassCount: strictRealPasses.length,
    countsAsRealRolloutEvidence: strictRealPasses.length > 0,
    bestCandidate: bestCandidate ? summarizeCandidate(bestCandidate) : null,
    results: parsedResults.map(summarizeCandidate),
    failedInputs: failedInputs.map((item) => ({
      label: item.label,
      inputKind: item.inputKind,
      status: item.status,
      failedStage: item.failedStage,
    })),
    nextActions: strictRealPasses.length > 0
      ? [
          "Attach this metrics-only batch audit and the winning canary packet for maintainer review.",
          "Keep fleet rollout blocked until the maintainer explicitly promotes the one-agent canary.",
        ]
      : [
          "Do not promote any audited diagnostic to production canary evidence.",
          "Pick the best candidate by failed-check count and collect a fresh post-update runtime window.",
          "Run canary:diagnose on each failing report and attach only metrics-only output.",
        ],
  };

  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  assertSafeText(serialized, "batch audit output");
  process.stdout.write(serialized);
  if (!ok) process.exitCode = 1;
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

function collectInputs(parsed) {
  const explicitInputs = asArray(parsed.input).map((item) => resolvePath(item));
  if (explicitInputs.length) return explicitInputs.map(inputDescriptor);

  const inputRoot = parsed.inputRoot || parsed.diagnosticRoot;
  if (inputRoot) {
    const rootDir = resolvePath(inputRoot);
    assert.ok(existsSync(rootDir), "diagnostic root missing");
    const entries = readdirSync(rootDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() || (entry.isFile() && extname(entry.name).toLowerCase() === ".zip"))
      .filter((entry) => /selfmem|memory|diagnostic|audit|canary/i.test(entry.name))
      .map((entry) => inputDescriptor(join(rootDir, entry.name)));
    return dedupeInputs(entries).sort((left, right) => left.label.localeCompare(right.label));
  }

  return [inputDescriptor(defaultFixtureInput)];
}

function dedupeInputs(inputs) {
  return [...new Map(inputs.map((input) => [`${input.inputKind}:${input.label}`, input])).values()];
}

function inputDescriptor(path) {
  assert.ok(existsSync(path), "diagnostic input missing");
  const stats = statSync(path);
  const inputKind = stats.isFile() && extname(path).toLowerCase() === ".zip"
    ? "diagnostic-zip"
    : stats.isDirectory()
      ? "diagnostic-dir"
      : "unsupported";
  assert.notEqual(inputKind, "unsupported", "diagnostic input must be a directory or zip");
  return {
    path,
    inputKind,
    label: hashLabel("bundle", inputFingerprint(path, inputKind)),
  };
}

function auditInput(input, index) {
  const reportPath = join(tempRoot, `report-${index}.json`);
  const reportArgs = [
    "packages/bench/canary-report-from-trace.mjs",
    input.inputKind === "diagnostic-zip" ? "--diagnostic-zip" : "--diagnostic-dir",
    input.path,
    "--rollback-tested",
    "--output",
    reportPath,
  ];
  const reportRun = runNode(reportArgs);
  if (reportRun.status !== 0 || !existsSync(reportPath)) {
    return failedResult(input, "report");
  }

  const intakeRun = runNode(["packages/bench/canary-evidence-intake.mjs", "--report", reportPath, "--strict-real"]);
  const diagnosisRun = runNode(["packages/bench/canary-remediation.mjs", "--report", reportPath]);
  if (!intakeRun.stdout || !diagnosisRun.stdout) {
    return failedResult(input, intakeRun.stdout ? "diagnosis" : "intake");
  }

  try {
    const report = safeParseJson(readFileSync(reportPath, "utf8"), "report");
    const intake = safeParseJson(intakeRun.stdout, "intake");
    const diagnosis = safeParseJson(diagnosisRun.stdout, "diagnosis");
    return {
      status: "parsed",
      label: input.label,
      inputKind: input.inputKind,
      reportSha256: sha256(readFileSync(reportPath)),
      fixtureOnly: Boolean(report.fixtureOnly || intake.fixtureOnly),
      canaryPass: Boolean(intake.canaryPass),
      countsAsRealRolloutEvidence: Boolean(intake.countsAsRealRolloutEvidence),
      strictRealPassed: Boolean(intake.strictRealPassed),
      failedChecks: Array.isArray(intake.failedChecks) ? intake.failedChecks : [],
      failedCheckCount: Array.isArray(intake.failedChecks) ? intake.failedChecks.length : 0,
      target: {
        host: intake.target?.host ?? report.agent?.host ?? null,
        agentIdentityHash: intake.target?.agentIdentityHash ?? report.agent?.agentIdentityHash ?? null,
        localContainerHash: intake.target?.localContainerHash ?? report.agent?.localContainerHash ?? null,
        sourceContainerHash: intake.target?.sourceContainerHash ?? report.agent?.sourceContainerHash ?? null,
        providerMode: intake.target?.providerMode ?? report.provider?.mode ?? null,
        hostedSupermemoryMode: intake.target?.hostedSupermemoryMode ?? report.provider?.hostedSupermemoryMode ?? null,
      },
      lifecycle: intake.lifecycle ?? {},
      latencyMs: intake.latencyMs ?? {},
      instrumentation: intake.instrumentation ?? {},
      quality: intake.quality ?? {},
      privacy: intake.privacy ?? {},
      remediation: {
        severity: diagnosis.severity ?? null,
        actionCount: Array.isArray(diagnosis.actions) ? diagnosis.actions.length : 0,
        categories: [...new Set((diagnosis.actions ?? []).map((item) => item.category).filter(Boolean))].sort(),
        needsFreshWindow: Boolean(diagnosis.recollectWindow?.needsFreshWindow),
      },
    };
  } catch {
    return failedResult(input, "parse");
  }
}

function failedResult(input, failedStage) {
  return {
    status: "failed",
    label: input.label,
    inputKind: input.inputKind,
    failedStage,
  };
}

function summarizeCandidate(item) {
  return {
    label: item.label,
    inputKind: item.inputKind,
    reportSha256: item.reportSha256,
    fixtureOnly: item.fixtureOnly,
    canaryPass: item.canaryPass,
    countsAsRealRolloutEvidence: item.countsAsRealRolloutEvidence,
    strictRealPassed: item.strictRealPassed,
    failedChecks: item.failedChecks,
    failedCheckCount: item.failedCheckCount,
    target: item.target,
    lifecycle: numberSubset(item.lifecycle, ["sessionStart", "beforePromptBuild", "preCompress", "agentEnd", "search", "store", "errors"]),
    latencyMs: numberSubset(item.latencyMs, ["recallP50", "recallP95", "storeP50", "storeP95"]),
    instrumentation: numberSubset(item.instrumentation, [
      "searchLatencySampleCount",
      "storeLatencySampleCount",
      "missingSearchLatencyCount",
      "missingStoreLatencyCount",
    ]),
    quality: {
      beforePromptHasContextRate: numberValue(item.quality?.beforePromptHasContextRate),
      zeroResultRate: numberValue(item.quality?.zeroResultRate),
      writeSuccessRate: numberValue(item.quality?.writeSuccessRate),
      lcmHookObserved: Boolean(item.quality?.lcmHookObserved),
      lifecycleCovered: Boolean(item.quality?.lifecycleCovered),
      hybridSearchCovered: Boolean(item.quality?.hybridSearchCovered),
      localWritesObserved: Boolean(item.quality?.localWritesObserved),
      hostedReadThroughObserved: Boolean(item.quality?.hostedReadThroughObserved),
    },
    privacy: {
      privacyLeakCount: numberValue(item.privacy?.privacyLeakCount),
      secretPatternHits: numberValue(item.privacy?.secretPatternHits),
      rawMemoryIncluded: Boolean(item.privacy?.rawMemoryIncluded),
      rawTranscriptIncluded: Boolean(item.privacy?.rawTranscriptIncluded),
      rawPromptIncluded: Boolean(item.privacy?.rawPromptIncluded),
      rawAnswerIncluded: Boolean(item.privacy?.rawAnswerIncluded),
    },
    remediation: item.remediation,
  };
}

function rankCandidates(items) {
  return [...items].sort((left, right) => {
    const leftScore = candidateScore(left);
    const rightScore = candidateScore(right);
    return rightScore - leftScore;
  });
}

function candidateScore(item) {
  const failedPenalty = item.failedCheckCount * 1000;
  const recall = numberValue(item.latencyMs?.recallP95);
  const store = numberValue(item.latencyMs?.storeP95);
  const lifecycleBonus = item.quality?.lifecycleCovered ? 100 : 0;
  const hybridBonus = item.quality?.hybridSearchCovered ? 100 : 0;
  const writeBonus = item.quality?.localWritesObserved ? 100 : 0;
  const privacyBonus = numberValue(item.privacy?.privacyLeakCount) === 0 ? 100 : -1000;
  const strictBonus = item.countsAsRealRolloutEvidence ? 10000 : 0;
  return strictBonus + lifecycleBonus + hybridBonus + writeBonus + privacyBonus - failedPenalty - recall / 10 - store / 10;
}

function runNode(argv) {
  return spawnSync("node", argv, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function safeParseJson(raw, label) {
  assertSafeText(raw, label);
  return JSON.parse(raw);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item === "--require-real-pass") parsed.requireRealPass = true;
    else if (item.startsWith("--")) {
      const key = toCamel(item.slice(2));
      const value = argv[index + 1] ?? "";
      if (key === "input") parsed.input = [...asArray(parsed.input), value];
      else parsed[key] = value;
      index += 1;
    }
  }
  return parsed;
}

function inputFingerprint(path, inputKind) {
  if (inputKind === "diagnostic-zip") return sha256(readFileSync(path));
  const files = collectFiles(path)
    .map((file) => {
      const rel = relative(path, file).replaceAll("\\", "/");
      return `${rel}:${statSync(file).size}`;
    })
    .join("\n");
  return sha256(files);
}

function collectFiles(directory) {
  const found = [];
  const stack = [directory];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) found.push(full);
    }
  }
  return found.sort((left, right) => left.localeCompare(right));
}

function numberSubset(value, keys) {
  return Object.fromEntries(keys.map((key) => [key, numberValue(value?.[key])]));
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function assertSafeText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a raw local path`);
}

function hashLabel(prefix, value) {
  return `${prefix}_${sha256(String(value)).slice(0, 16)}`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function resolvePath(value) {
  return isAbsolute(value) ? value : resolve(process.cwd(), value);
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
