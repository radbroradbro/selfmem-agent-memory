import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const reviewDir = "reviews/overnight-20260522";
const args = parseArgs(process.argv.slice(2));
const workspace = args.workspace ? resolvePath(args.workspace) : join(root, reviewDir, "next-agent-workspace");
const outputPath = args.output ? resolvePath(args.output) : null;
const requireProductionCanary = Boolean(args.requireProductionCanary);
const tempRoot = mkdtempSync(join(tmpdir(), "recallweave-returned-workspace-"));

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;

try {
  const generatedFixturePacket = !args.packet;
  const packetPath = generatedFixturePacket ? buildFixturePacket() : resolvePath(args.packet);
  assert.ok(existsSync(packetPath), "returned canary packet is missing");
  assert.ok(statSync(packetPath).size > 0, "returned canary packet is empty");

  const packetSha = sha256(readFileSync(packetPath));
  const packetLabel = basename(packetPath);
  const packetEntries = listZip(packetPath);
  const rawEntries = Object.fromEntries(packetEntries.map((entry) => [entry, readZipEntry(packetPath, entry)]));
  for (const [entry, raw] of Object.entries(rawEntries)) assertSafeText(raw, entry);

  const report = parseOptionalJson(rawEntries["canary-report.json"]);
  const packetIntake = parseOptionalJson(rawEntries["canary-intake.json"]);
  const packetDiagnosis = parseOptionalJson(rawEntries["canary-diagnosis.json"]);
  const intake = runJson("packages/bench/canary-returned-packet-intake.mjs", [
    "--packet",
    packetPath,
    "--require-production-canary",
  ]);
  const review = runJson("packages/bench/canary-evidence-packet-review.mjs", [
    "--packet",
    packetPath,
    "--strict-real",
  ]);

  const operatorMarkdown = buildOperatorFindings({
    generatedFixturePacket,
    packetLabel,
    packetSha,
    packetEntries,
    report,
    packetIntake,
    packetDiagnosis,
    intake,
    review,
  });
  const intakeMarkdown = buildReturnedIntake({
    generatedFixturePacket,
    packetLabel,
    packetSha,
    intake,
    review,
  });

  assertSafeText(operatorMarkdown, "operator findings markdown");
  assertSafeText(intakeMarkdown, "returned intake markdown");
  assertSafeJson(intake, "returned packet intake JSON");
  assertSafeJson(review, "packet review JSON");

  mkdirSync(workspace, { recursive: true, mode: 0o755 });
  writeFileSync(join(workspace, "operator-findings-returned.md"), operatorMarkdown, { encoding: "utf8", mode: 0o600 });
  writeFileSync(join(workspace, "returned-packet-intake.md"), intakeMarkdown, { encoding: "utf8", mode: 0o600 });
  writeFileSync(join(workspace, "returned-packet-intake.json"), `${JSON.stringify(intake, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  const output = {
    ok: !requireProductionCanary || intake.countsAsProductionCanaryEvidence === true,
    mode: "canary-returned-workspace",
    writesRealFiles: true,
    metricsOnly: true,
    generatedFixturePacket,
    countsAsProductionCanaryEvidence: Boolean(intake.countsAsProductionCanaryEvidence),
    publicLaunchAllowed: false,
    fleetRolloutAllowed: false,
    packet: {
      pathLabel: packetLabel,
      sha256: packetSha,
      entries: packetEntries,
    },
    workspace: {
      label: basename(workspace),
      files: [
        "operator-findings-returned.md",
        "returned-packet-intake.md",
        "returned-packet-intake.json",
      ],
    },
    intake: {
      ok: Boolean(intake.ok),
      status: intake.status ?? null,
      failedChecks: intake.review?.failedChecks ?? [],
      strictFailureReason: intake.review?.strictFailureReason ?? null,
    },
    nextActions: intake.countsAsProductionCanaryEvidence
      ? [
          "Attach the metrics-only workspace markdown and returned-packet intake JSON for maintainer review.",
          "Keep public launch and fleet rollout blocked until the owner approves promotion.",
        ]
      : [
          "Do not close the real rollout blocker from this packet.",
          "Use the workspace markdown to ask the selected agent for the missing strict-real evidence.",
          "Keep public launch and fleet rollout blocked.",
        ],
  };
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  assertSafeText(serialized, "returned workspace output");
  if (outputPath) writeFileSync(outputPath, serialized, { encoding: "utf8", mode: 0o600 });
  process.stdout.write(serialized);
  if (!output.ok) process.exitCode = 1;
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

function buildFixturePacket() {
  const packetPath = join(tempRoot, "generated-fixture-canary-evidence-packet.zip");
  const result = spawnSync("node", ["packages/bench/canary-evidence-packet.mjs", "--output", packetPath], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, `fixture packet build failed: ${result.stderr}`);
  assertSafeText(result.stdout, "fixture packet output");
  return packetPath;
}

function buildOperatorFindings(input) {
  const report = input.report ?? {};
  const reportIntake = input.packetIntake ?? {};
  const review = input.review ?? {};
  const target = review.target ?? {};
  const privacy = report.privacy ?? reportIntake.privacy ?? {};
  const quality = report.quality ?? reportIntake.quality ?? {};
  const instrumentation = report.instrumentation ?? reportIntake.instrumentation ?? {};
  const latency = report.latencyMs ?? reportIntake.latencyMs ?? {};
  const window = report.window ?? reportIntake.window ?? {};
  const rollback = report.rollback ?? {};
  const failedChecks = review.failedChecks ?? input.intake?.review?.failedChecks ?? [];
  const productionEvidence = Boolean(input.intake?.countsAsProductionCanaryEvidence);

  return [
    "# Operator Findings",
    "",
    `Status: ${productionEvidence ? "strict-real production canary evidence" : "not production canary evidence"}.`,
    "",
    "## Run Identity",
    "",
    `- Host: ${safeValue(report.agent?.host ?? target.host)}.`,
    "- Handoff packet label: not supplied to workspace generator.",
    "- Handoff packet SHA-256: not supplied to workspace generator.",
    `- Canary evidence packet label: ${input.packetLabel}.`,
    `- Canary evidence packet SHA-256: ${input.packetSha}.`,
    `- Fresh window start: ${safeValue(window.startedAt)}.`,
    `- Fresh window end: ${safeValue(window.endedAt)}.`,
    `- Window duration minutes: ${safeValue(window.durationMinutes)}.`,
    "- Adapter updated after window start: not proven by returned packet alone.",
    `- Rollback tested: ${yesNo(rollback.tested)}.`,
    `- Generated fixture packet: ${yesNo(input.generatedFixturePacket)}.`,
    "",
    "## Native CLI Outputs",
    "",
    `- Packet entries: ${input.packetEntries.map((entry) => `\`${entry}\``).join(", ")}.`,
    "- Canary report path label: canary-report.json.",
    `- Canary intake path label: ${input.packetEntries.includes("canary-intake.json") ? "canary-intake.json" : "not included"}.`,
    `- Canary diagnosis path label: ${input.packetEntries.includes("canary-diagnosis.json") ? "canary-diagnosis.json" : "not included"}.`,
    "- Returned packet intake: returned-packet-intake.json.",
    "",
    "## Pass Flags",
    "",
    `- strict-real intake passed: ${yesNo(input.intake?.review?.strictRealPassed)}.`,
    `- fixture-only: ${yesNo(input.intake?.review?.fixtureOnly ?? review.fixtureOnly)}.`,
    `- counts as real rollout evidence: ${yesNo(input.intake?.review?.countsAsRealRolloutEvidence)}.`,
    `- counts as production canary evidence: ${yesNo(productionEvidence)}.`,
    `- canary pass: ${yesNo(input.intake?.review?.canaryPass)}.`,
    `- lifecycle covered: ${yesNo(quality.lifecycleCovered)}.`,
    `- hybrid search covered: ${yesNo(quality.hybridSearchCovered)}.`,
    `- local writes observed: ${yesNo(quality.localWritesObserved)}.`,
    `- hosted read-through observed: ${yesNo(quality.hostedReadThroughObserved)}.`,
    `- rollback available: ${yesNo(rollback.available)}.`,
    `- rollback tested: ${yesNo(rollback.tested)}.`,
    "",
    "## Latency And Instrumentation",
    "",
    `- recall p95 ms: ${safeValue(latency.recallP95)}.`,
    `- store p95 ms: ${safeValue(latency.storeP95)}.`,
    `- search latency samples: ${safeValue(instrumentation.searchLatencySampleCount)}.`,
    `- store latency samples: ${safeValue(instrumentation.storeLatencySampleCount)}.`,
    `- missing store latency count: ${safeValue(instrumentation.missingStoreLatencyCount)}.`,
    "",
    "## Privacy",
    "",
    `- privacy leak count: ${safeValue(privacy.privacyLeakCount ?? input.intake?.review?.privacyLeakCount ?? 0)}.`,
    `- secret-pattern hits: ${safeValue(privacy.secretPatternHits ?? 0)}.`,
    `- raw memory included: ${yesNo(privacy.rawMemoryIncluded)}.`,
    `- raw transcript included: ${yesNo(privacy.rawTranscriptIncluded)}.`,
    `- raw prompt included: ${yesNo(privacy.rawPromptIncluded)}.`,
    `- raw answer included: ${yesNo(privacy.rawAnswerIncluded)}.`,
    "",
    "## Findings",
    "",
    `- What worked: ${productionEvidence ? "strict-real intake accepted the returned packet" : "the packet was parsed safely into metrics-only findings"}.`,
    `- What failed or looked risky: ${failedChecks.length ? failedChecks.join(", ") : "none reported by packet review"}.`,
    `- What should be changed before another agent: ${productionEvidence ? "wait for owner promotion decision" : "collect a fresh strict-real post-update window or fix the failed checks above"}.`,
    "",
    "## Attach-Back Checklist",
    "",
    `- metrics-only canary report attached: ${yesNo(input.packetEntries.includes("canary-report.json"))}.`,
    `- metrics-only intake attached: ${yesNo(input.packetEntries.includes("canary-intake.json"))}.`,
    `- metrics-only diagnosis attached if failed: ${yesNo(input.packetEntries.includes("canary-diagnosis.json"))}.`,
    "- sanitized evidence packet attached: yes.",
    "- no raw logs or memory content attached: yes.",
    "",
  ].join("\n");
}

function buildReturnedIntake(input) {
  const intake = input.intake ?? {};
  const review = intake.review ?? {};
  return [
    "# Returned Packet Intake",
    "",
    `Status: ${safeValue(intake.status)}.`,
    "",
    "## Intake Command",
    "",
    "```bash",
    "npm exec --yes pnpm@10.23.0 -- canary:returned-packet -- --packet <returned-canary-evidence-packet.zip> --require-production-canary --output <metrics-only-intake.json>",
    "```",
    "",
    "## Intake Result",
    "",
    `- intake ok: ${yesNo(intake.ok)}.`,
    `- status: ${safeValue(intake.status)}.`,
    `- counts as production canary evidence: ${yesNo(intake.countsAsProductionCanaryEvidence)}.`,
    `- public launch allowed: ${yesNo(intake.publicLaunchAllowed)}.`,
    `- fleet rollout allowed: ${yesNo(intake.fleetRolloutAllowed)}.`,
    `- packet label: ${input.packetLabel}.`,
    `- packet SHA-256: ${input.packetSha}.`,
    `- strict-real passed: ${yesNo(review.strictRealPassed)}.`,
    `- failed checks: ${Array.isArray(review.failedChecks) && review.failedChecks.length ? review.failedChecks.join(", ") : "none"}.`,
    `- strict failure reason: ${safeValue(review.strictFailureReason)}.`,
    `- generated fixture packet: ${yesNo(input.generatedFixturePacket)}.`,
    "",
    "## Decision",
    "",
    `- Close real rollout blocker: ${yesNo(intake.countsAsProductionCanaryEvidence)}.`,
    `- Needs another fresh window: ${yesNo(!intake.countsAsProductionCanaryEvidence)}.`,
    `- Needs adapter patch: ${yesNo(Array.isArray(review.failedChecks) && review.failedChecks.some((item) => /adapter|latency|contract/i.test(item)))}.`,
    "- Needs human approval: yes.",
    "",
    "## Notes",
    "",
    `- Maintainer note: ${intake.countsAsProductionCanaryEvidence ? "ready for owner promotion review" : "keep the blocker open"}.`,
    "- Follow-up issue or PR: use the existing release blocker issue unless a new adapter defect is found.",
    "",
  ].join("\n");
}

function runJson(script, scriptArgs) {
  const result = spawnSync("node", [script, ...scriptArgs], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.ok(result.stdout, `${script} produced no stdout`);
  assertSafeText(result.stdout, `${script} stdout`);
  const parsed = JSON.parse(result.stdout);
  assertSafeJson(parsed, `${script} JSON`);
  return parsed;
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

function parseOptionalJson(raw) {
  if (!raw) return null;
  assertSafeText(raw, "packet JSON entry");
  return JSON.parse(raw);
}

function safeValue(value) {
  if (value === null || value === undefined || value === "") return "not reported";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return String(value).replace(/\s+/g, " ").trim();
}

function yesNo(value) {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "not reported";
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item === "--require-production-canary") {
      parsed.requireProductionCanary = true;
      continue;
    }
    if (item.startsWith("--")) {
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

function assertSafeText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a raw local path`);
}

function assertSafeJson(value, label) {
  assertSafeText(`${JSON.stringify(value, null, 2)}\n`, label);
}
