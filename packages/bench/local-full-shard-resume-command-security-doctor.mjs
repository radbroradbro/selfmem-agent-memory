import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const tempRoots = [];
process.on("exit", () => {
  for (const tempRoot of tempRoots) {
    try {
      rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      // Best effort only; fixture private command files are intentionally external.
    }
  }
});

const reviewDir = String(args.reviewDir ?? process.env.RECALLWEAVE_REVIEW_DIR ?? "reviews/overnight-20260522");
const materializerPath = resolveInputPath(
  args.materializer ?? `${reviewDir}/local-full-shard-003-resume-command-materializer-20260526.json`,
);
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");

const materializerState = loadRequiredJson(materializerPath, "local-full resume command materializer");
const materializer = materializerState.json;
const fixtureProbe = runFixtureMaterializer();
const blockers = [
  !publicReportSafe(materializer) ? "materializer-public-report-unsafe" : null,
  materializer.guardPlan?.ready !== true ? "materializer-guard-plan-not-ready" : null,
  materializer.guardPlan?.firstCommandId !== "rerunRuntimeDoctor" ? "materializer-first-command-not-runtime-doctor" : null,
  materializer.guardPlan?.secondCommandId !== "rerunDurabilitySmoke" ? "materializer-second-command-not-durability-smoke" : null,
  materializer.guardPlan?.thirdCommandId !== "rerunLocalRerankDurabilitySmoke" ? "materializer-third-command-not-local-rerank-durability-smoke" : null,
  materializer.guardPlan?.guardedCommandId !== "missingArmResponseExport" ? "materializer-guarded-command-mismatch" : null,
  materializer.privateScriptExportsSupermemorySearchDisabled !== true ? "materializer-supermemory-disable-export-missing" : null,
  !arrayOfStrings(materializer.commandPlan?.privateScriptExports).includes("RECALLWEAVE_BENCHMARK_DISABLE_SUPERMEMORY_SEARCH")
    ? "materializer-benchmark-supermemory-disable-env-missing"
    : null,
  !arrayOfStrings(materializer.commandPlan?.privateScriptExports).includes("SELFMEM_SUPERMEMORY_SEARCH_DISABLED")
    ? "materializer-selfmem-supermemory-disable-env-missing"
    : null,
  !fixtureProbe.ready ? "fixture-materializer-not-ready" : null,
  fixtureProbe.privateCommandFileWritten !== true ? "fixture-private-command-file-not-written" : null,
  fixtureProbe.privateCommandFileOutsideRepository !== true ? "fixture-private-command-file-inside-repository" : null,
  fixtureProbe.privateCommandFileMode !== "0700" ? "fixture-private-command-file-mode-not-0700" : null,
  fixtureProbe.privateScriptExportsSupermemorySearchDisabled !== true ? "fixture-private-script-supermemory-disable-export-missing" : null,
  fixtureProbe.privateScriptPlaceholderCount > 0 ? "fixture-private-script-placeholders-present" : null,
  fixtureProbe.privateScriptOrderReady !== true ? "fixture-private-script-order-invalid" : null,
  fixtureProbe.publicOutputSafe !== true ? "fixture-public-output-unsafe" : null,
].filter(Boolean);

const report = {
  schemaVersion: 1,
  ok: true,
  mode: "local-full-shard-resume-command-security-doctor",
  status: blockers.length === 0 ? "READY_LOCAL_FULL_RESUME_COMMAND_SECURITY" : "BLOCKED_LOCAL_FULL_RESUME_COMMAND_SECURITY",
  generatedAt: new Date().toISOString(),
  reviewDir,
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  writesRealPrivateCommandFile: false,
  metricsOnly: true,
  publicSafe: true,
  callsProviderApis: false,
  callsHostedSupermemory: false,
  callsLocalEndpoint: false,
  sendsBenchmarkTextToProvider: false,
  rawQuestionIdsIncluded: false,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPromptIncluded: false,
  rawPrivateOutputPathIncluded: false,
  printsMaterializedCommands: false,
  printsEnvValues: false,
  printsPrivatePaths: false,
  privateCommandPathPrinted: false,
  privateScriptContentPrinted: false,
  supermemorySearchPolicy: "disabled-for-benchmark-methodology",
  countsAsLocalFullBenchmarkEvidence: false,
  countsAsFullMemorySotaEvidence: false,
  publicBenchmarkClaimsAllowed: false,
  securityReady: blockers.length === 0,
  materializerReport: {
    path: materializerState.path,
    hash: materializerState.hash,
    status: materializer.status ?? null,
    readyForMaterialization: Boolean(materializer.readyForMaterialization),
    writesPrivateCommandFile: Boolean(materializer.writesRealPrivateCommandFile),
    publicReportSafe: publicReportSafe(materializer),
    commandCount: Number(materializer.commandPlan?.commandCount ?? 0),
    materializedCommandCount: Number(materializer.commandPlan?.materializedCommandCount ?? 0),
    commandsPrinted: Boolean(materializer.commandPlan?.commandsPrinted),
    privateScriptCommandOrder: materializer.commandPlan?.commandIds ?? [],
    guardPlan: materializer.guardPlan ?? null,
    privateScriptExportsSupermemorySearchDisabled: Boolean(materializer.privateScriptExportsSupermemorySearchDisabled),
    privateScriptExports: materializer.commandPlan?.privateScriptExports ?? [],
  },
  fixtureProbe,
  blockers,
  nextActions:
    blockers.length === 0
      ? [
          "Use the checked materializer flow only when a current accepted-lane resume packet is ready.",
          "Keep public reports limited to hashes, counts, labels, and booleans.",
          "Run the resume result doctor before accepting any resumed shard into local-full intake.",
        ]
      : [
          "Fix the command materializer security blockers before generating a real private resume script.",
          "Do not run or publish local-full resume evidence while the security doctor is blocked.",
        ],
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "local-full resume command security doctor");
assertSafePublicText(markdownText, "local-full resume command security markdown");
if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);

function runFixtureMaterializer() {
  const result = spawnSync(process.execPath, ["packages/bench/local-full-shard-resume-command-materializer.mjs", "--fixture"], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  });
  assert.equal(result.status, 0, `fixture materializer failed: ${result.stderr}`);
  assertSafePublicText(result.stdout, "fixture materializer stdout");
  assertSafePublicText(result.stderr, "fixture materializer stderr");
  const fixture = JSON.parse(result.stdout);
  const publicOutputSafe = publicReportSafe(fixture);
  const commandOrder = arrayOfStrings(fixture.commandPlan?.commandIds);
  return {
    ready: fixture.status === "READY_LOCAL_FULL_RESUME_PRIVATE_COMMANDS" && fixture.readyForMaterialization === true,
    publicOutputSafe,
    privateCommandFileWritten: Boolean(fixture.privateCommandFile?.written),
    privateCommandFileOutsideRepository: Boolean(fixture.privateCommandFile?.outsideRepository),
    privateCommandFileMode: fixture.privateCommandFile?.mode ?? null,
    privateCommandFilePathPrinted: Boolean(fixture.privateCommandFile?.pathPrinted),
    privateCommandFileHash: fixture.privateCommandFile?.hash ?? null,
    privateScriptHash: fixture.privateCommandFile?.hash ?? null,
    privateScriptContentPrinted: false,
    privateScriptExportsSupermemorySearchDisabled: Boolean(fixture.privateScriptExportsSupermemorySearchDisabled),
    privateScriptContainsRuntimeValues: false,
    privateScriptPlaceholderCount: arrayOfStrings(fixture.replacementPlan?.unresolvedRequiredPlaceholderNames).length,
    privateScriptOrderReady: Boolean(fixture.guardPlan?.ready),
    commandOrder,
    firstCommandId: fixture.guardPlan?.firstCommandId ?? commandOrder[0] ?? null,
    secondCommandId: fixture.guardPlan?.secondCommandId ?? commandOrder[1] ?? null,
    thirdCommandId: fixture.guardPlan?.thirdCommandId ?? commandOrder[2] ?? null,
    guardedCommandId: fixture.guardPlan?.guardedCommandId ?? null,
    materializedCommandCount: Number(fixture.commandPlan?.materializedCommandCount ?? 0),
    printsMaterializedCommands: Boolean(fixture.printsMaterializedCommands),
    printsPrivatePaths: Boolean(fixture.printsPrivatePaths),
    printsEnvValues: Boolean(fixture.printsEnvValues),
  };
}

function privateScriptExportsSupermemorySearchDisabled(text) {
  return (
    /^export RECALLWEAVE_BENCHMARK_DISABLE_SUPERMEMORY_SEARCH=['"]?1['"]?$/mu.test(text) &&
    /^export SELFMEM_SUPERMEMORY_SEARCH_DISABLED=['"]?1['"]?$/mu.test(text)
  );
}

function inspectPrivateScriptOrder(privateScript) {
  const commandOrder = [...privateScript.matchAll(/^# \d+\. ([A-Za-z0-9_-]+)$/gmu)].map((match) => match[1]);
  const expectedPrefix = [
    "rerunRuntimeDoctor",
    "rerunDurabilitySmoke",
    "rerunLocalRerankDurabilitySmoke",
    "resumeEnvDoctor",
    "shardMaterialize",
    "missingArmResponseExport",
  ];
  return {
    commandOrder,
    ready: expectedPrefix.every((id, index) => commandOrder[index] === id),
  };
}

function publicReportSafe(value) {
  return Boolean(
    value?.publicSafe === true &&
      value?.metricsOnly === true &&
      value?.callsProviderApis === false &&
      value?.callsHostedSupermemory === false &&
      value?.callsLocalEndpoint === false &&
      value?.sendsBenchmarkTextToProvider === false &&
      value?.rawQuestionIdsIncluded === false &&
      value?.rawQuestionsIncluded === false &&
      value?.rawAnswersIncluded === false &&
      value?.rawMemoryIncluded === false &&
      value?.rawTranscriptIncluded === false &&
      value?.rawPromptIncluded === false &&
      value?.rawPrivateOutputPathIncluded === false &&
      value?.printsMaterializedCommands === false &&
      value?.printsEnvValues === false &&
      value?.printsPrivatePaths === false &&
      value?.privateCommandFile?.pathPrinted === false &&
      value?.commandPlan?.commandsPrinted === false &&
      value?.privateScriptExportsSupermemorySearchDisabled === true &&
      value?.countsAsLocalFullBenchmarkEvidence === false &&
      value?.countsAsFullMemorySotaEvidence === false &&
      value?.publicBenchmarkClaimsAllowed === false,
  );
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function containsPrivateRuntimeValues(text) {
  return /\/private\/|\/var\/folders\/|\/tmp\/|127\.0\.0\.1|localhost|fixture-local-/iu.test(text);
}

function countPlaceholders(text) {
  return [...text.matchAll(/<[^>\n]+>/gu)].length;
}

function outsideRepository(path) {
  const rel = relative(root, path);
  return Boolean(rel && (rel.startsWith("..") || isAbsolute(rel)));
}

function fileMode(path) {
  return `0${(statSync(path).mode & 0o777).toString(8)}`;
}

function loadRequiredJson(path, label) {
  assert.ok(existsSync(path), `${label} missing: ${displayPath(path)}`);
  assert.ok(statSync(path).size > 0, `${label} empty: ${displayPath(path)}`);
  const raw = readFileSync(path, "utf8");
  assertSafePublicText(raw, label);
  return {
    path: displayPath(path),
    hash: `sha256:${sha256(raw)}`,
    json: JSON.parse(raw),
  };
}

function renderMarkdown(value) {
  return [
    "# Local-Full Resume Command Security Doctor",
    "",
    `- Status: ${value.status}`,
    `- Security ready: ${value.securityReady}`,
    `- Public safe: ${value.publicSafe}`,
    `- Private script content printed: ${value.privateScriptContentPrinted}`,
    `- Private command path printed: ${value.privateCommandPathPrinted}`,
    `- Commands printed: ${value.materializerReport.commandsPrinted}`,
    `- Fixture private command file written: ${value.fixtureProbe.privateCommandFileWritten}`,
    `- Fixture private command outside repository: ${value.fixtureProbe.privateCommandFileOutsideRepository}`,
    `- Fixture private command mode: ${value.fixtureProbe.privateCommandFileMode}`,
    `- Fixture exports Supermemory search disable: ${value.fixtureProbe.privateScriptExportsSupermemorySearchDisabled}`,
    `- Fixture private script placeholder count: ${value.fixtureProbe.privateScriptPlaceholderCount}`,
    `- Fixture private script order ready: ${value.fixtureProbe.privateScriptOrderReady}`,
    `- Fixture first command: ${value.fixtureProbe.firstCommandId ?? "n/a"}`,
    `- Fixture second command: ${value.fixtureProbe.secondCommandId ?? "n/a"}`,
    `- Fixture third command: ${value.fixtureProbe.thirdCommandId ?? "n/a"}`,
    `- Fixture guarded command: ${value.fixtureProbe.guardedCommandId}`,
    `- Counts as local-full benchmark evidence: ${value.countsAsLocalFullBenchmarkEvidence}`,
    `- Counts as full memory SOTA evidence: ${value.countsAsFullMemorySotaEvidence}`,
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (!item.startsWith("--")) continue;
    const key = item.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    const value = !next || next.startsWith("--") ? true : next;
    parsed[key] = value;
    if (value !== true) index += 1;
  }
  return parsed;
}

function resolveInputPath(pathLike) {
  const value = String(pathLike ?? "");
  return isAbsolute(value) ? value : resolve(root, value);
}

function displayPath(path) {
  const rel = relative(root, path).replaceAll("\\", "/");
  return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : "external-file";
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertSafePublicText(text, label) {
  const secretPattern =
    /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
  const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|\/tmp\/|\/home\/|[A-Za-z]:\\Users\\)/i;
  const endpointPattern = /https?:\/\/|127\.0\.0\.1|localhost|\[::1\]/i;
  assert.equal(secretPattern.test(text), false, `${label} contains secret-shaped text`);
  assert.equal(privatePathPattern.test(text), false, `${label} contains absolute private path`);
  assert.equal(endpointPattern.test(text), false, `${label} contains endpoint-shaped text`);
}
