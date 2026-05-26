import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const packetOnlyCommandIds = new Set(["resumeCommandMaterializer", "resumeResultDoctor"]);
const args = parseArgs(process.argv.slice(2));
const fixtureTempRoots = [];
process.on("exit", () => {
  for (const tempRoot of fixtureTempRoots) {
    try {
      rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      // Best effort only; fixture mode writes private command files outside the repository.
    }
  }
});

const fixtureMode = Boolean(args.fixture);
const fixtureState = fixtureMode ? createFixtureState() : null;
const reviewDir = String(args.reviewDir ?? process.env.RECALLWEAVE_REVIEW_DIR ?? "reviews/overnight-20260522");
const resumePacketPath = resolveInputPath(args.resumePacket ?? `${reviewDir}/local-full-shard-002-resume-packet-20260526.json`);
const privateDir = stringOrNull(fixtureState?.privateDir ?? args.privateInputDir ?? args.privateDir ?? process.env.RECALLWEAVE_FULL_SHARD_PRIVATE_DIR);
const privateCommandOutput = stringOrNull(fixtureState?.privateCommandOutput ?? args.privateCommandOutput ?? process.env.RECALLWEAVE_LOCAL_FULL_RESUME_PRIVATE_COMMAND_OUTPUT);
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");

const resumeRaw = readFileSyncChecked(resumePacketPath, "local-full resume packet");
const resumePacket = JSON.parse(resumeRaw);
const privateDirState = inspectPrivateDir(privateDir);
const privateCommandOutputState = inspectPrivateCommandOutput(privateCommandOutput);
const commandState = inspectCommands(resumePacket);
const replacementState = inspectReplacements({ privateDirState, reviewDir });

const readyForMaterialization =
  resumePacket.status === "READY_FOR_LOCAL_FULL_SHARD_RESUME" &&
  privateDirState.present &&
  privateDirState.outsideRepository &&
  privateCommandOutputState.provided &&
  privateCommandOutputState.outsideRepository &&
  commandState.commandCount > 0 &&
  replacementState.unresolvedRequiredPlaceholderNames.length === 0;

const blockers = [
  resumePacket.status !== "READY_FOR_LOCAL_FULL_SHARD_RESUME" ? "resume-packet-not-ready" : null,
  !privateDirState.provided ? "private-dir-not-provided" : null,
  privateDirState.provided && !privateDirState.present ? "private-dir-not-present" : null,
  privateDirState.present && !privateDirState.outsideRepository ? "private-dir-inside-repository" : null,
  !privateCommandOutputState.provided ? "private-command-output-not-provided" : null,
  privateCommandOutputState.provided && !privateCommandOutputState.outsideRepository ? "private-command-output-inside-repository" : null,
  commandState.commandCount === 0 ? "resume-packet-commands-missing" : null,
  ...replacementState.unresolvedRequiredPlaceholderNames.map((name) => `placeholder-unresolved:${name}`),
].filter(Boolean);

const materializedCommands = readyForMaterialization ? materializeCommands(resumePacket.commands, replacementState.replacements) : [];
const privateScript = readyForMaterialization ? renderPrivateScript(materializedCommands) : null;
let privateCommandFile = {
  written: false,
  label: privateCommandOutput ? "external-private-command-file" : null,
  pathPrinted: false,
  outsideRepository: privateCommandOutputState.outsideRepository,
  mode: null,
  sizeBytes: null,
  hash: null,
};

if (privateScript && privateCommandOutputState.resolvedPath) {
  mkdirSync(dirname(privateCommandOutputState.resolvedPath), { recursive: true, mode: 0o700 });
  writeFileSync(privateCommandOutputState.resolvedPath, privateScript, { encoding: "utf8", mode: 0o700 });
  privateCommandFile = {
    written: true,
    label: "external-private-command-file",
    pathPrinted: false,
    outsideRepository: privateCommandOutputState.outsideRepository,
    mode: "0700",
    sizeBytes: statSync(privateCommandOutputState.resolvedPath).size,
    hash: `sha256:${sha256(readFileSync(privateCommandOutputState.resolvedPath))}`,
  };
}

const report = {
  schemaVersion: 1,
  ok: true,
  mode: "local-full-shard-resume-command-materializer",
  fixtureOnly: fixtureMode,
  status: readyForMaterialization ? "READY_LOCAL_FULL_RESUME_PRIVATE_COMMANDS" : "BLOCKED_LOCAL_FULL_RESUME_PRIVATE_COMMANDS",
  generatedAt: new Date().toISOString(),
  reviewDir,
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  writesRealPrivateCommandFile: privateCommandFile.written,
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
  countsAsLocalFullBenchmarkEvidence: false,
  countsAsFullMemorySotaEvidence: false,
  publicBenchmarkClaimsAllowed: false,
  readyForMaterialization,
  privateDir: privateDirState.public,
  privateCommandFile,
  resumePacket: {
    path: displayPath(resumePacketPath),
    hash: `sha256:${sha256(resumeRaw)}`,
    status: resumePacket.status ?? null,
    targetShard: resumePacket.targetShard ?? null,
    missingStrategies: resumePacket.resumeState?.missingStrategies ?? [],
    completedStrategies: resumePacket.resumeState?.completedStrategies ?? [],
  },
  commandPlan: {
    commandCount: commandState.commandCount,
    commandIds: commandState.commandIds,
    templatePlaceholderCount: commandState.placeholderNames.length,
    templatePlaceholderNames: commandState.placeholderNames,
    materializedCommandCount: materializedCommands.length,
    materializedCommandHashes: materializedCommands.map((item) => ({ id: item.id, hash: `sha256:${sha256(item.command)}` })),
    commandsPrinted: false,
  },
  replacementPlan: {
    requiredPlaceholderCount: replacementState.requiredPlaceholders.length,
    requiredPlaceholdersReady: replacementState.unresolvedRequiredPlaceholderNames.length === 0,
    unresolvedRequiredPlaceholderNames: replacementState.unresolvedRequiredPlaceholderNames,
    requiredPlaceholders: replacementState.requiredPlaceholders,
    optionalPlaceholderCount: replacementState.optionalPlaceholders.length,
    optionalPlaceholderNames: replacementState.optionalPlaceholders.map((entry) => entry.name),
    optionalDefaultsApplied: replacementState.optionalDefaultsApplied,
    printsReplacementValues: false,
  },
  blockers,
  nextActions: readyForMaterialization
    ? [
        "Review and run the generated private command file from the external private location.",
        "Regenerate the public resume env doctor after command execution.",
        "Keep public reports limited to hashes, counts, and statuses.",
      ]
    : [
        "Provide an outside-repository private input directory with --private-input-dir or RECALLWEAVE_FULL_SHARD_PRIVATE_DIR.",
        "Provide an outside-repository private command output path with --private-command-output or RECALLWEAVE_LOCAL_FULL_RESUME_PRIVATE_COMMAND_OUTPUT.",
        "Set the required local embedding, local rerank, and answer-quality environment variables.",
      ],
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "local-full resume command materializer");
assertSafePublicText(markdownText, "local-full resume command materializer markdown");
if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);

function inspectCommands(packet) {
  const commands = packet.commands ?? {};
  const commandIds = Object.keys(commands).filter(
    (id) => !packetOnlyCommandIds.has(id) && typeof commands[id] === "string" && commands[id].trim().length > 0,
  );
  const placeholderNames = [
    ...new Set(commandIds.flatMap((id) => [...commands[id].matchAll(/<([^>]+)>/gu)].map((match) => match[1]))),
  ].sort();
  return {
    commandCount: commandIds.length,
    commandIds,
    placeholderNames,
  };
}

function inspectReplacements({ privateDirState: privateState, reviewDir: reviewDirectory }) {
  const replacementSpecs = {
    "private-output-dir": {
      source: "RECALLWEAVE_FULL_SHARD_PRIVATE_DIR or --private-input-dir",
      value: privateState.resolvedPath,
      ready: privateState.present && privateState.outsideRepository,
    },
    "public-review-dir": {
      source: "--review-dir or RECALLWEAVE_REVIEW_DIR",
      value: reviewDirectory,
      ready: String(reviewDirectory ?? "").trim().length > 0,
    },
    "local-embedding-base-url": envReplacement("SELFMEM_LOCAL_EMBED_BASE_URL"),
    "local-embedding-model": envReplacement("SELFMEM_LOCAL_EMBED_MODEL"),
    "safe-local-embedding-batch-token-limit": envReplacement("SELFMEM_LOCAL_EMBED_BATCH_MAX_TOKENS"),
    "local-rerank-base-url": envReplacement("SELFMEM_LOCAL_RERANK_BASE_URL"),
    "local-rerank-model": envReplacement("SELFMEM_LOCAL_RERANK_MODEL"),
    "local-rerank-candidate-limit": envReplacement("SELFMEM_LOCAL_RERANK_CANDIDATE_LIMIT"),
    "openai-compatible-base-url": envReplacement("RECALLWEAVE_MEMORYBENCH_BASE_URL"),
    "local-answer-model": envReplacement("RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL"),
    "local-judge-model": envReplacement("RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL"),
  };
  const optionalSpecs = {
    "1-when-cloud-query-expansion-runs": {
      value: optionalEnv("RECALLWEAVE_QUERY_EXPANSION_CALLS", "0"),
      defaultApplied: !hasEnv("RECALLWEAVE_QUERY_EXPANSION_CALLS"),
    },
    "env-only-if-cloud-endpoint": {
      value: optionalEnv("RECALLWEAVE_MEMORYBENCH_API_KEY", ""),
      defaultApplied: !hasEnv("RECALLWEAVE_MEMORYBENCH_API_KEY"),
    },
    "local-query-expansion-base-url-if-used": {
      value: optionalEnv("SELFMEM_QUERY_EXPANSION_BASE_URL", ""),
      defaultApplied: !hasEnv("SELFMEM_QUERY_EXPANSION_BASE_URL"),
    },
    "query-expansion-model-if-used": {
      value: optionalEnv("SELFMEM_QUERY_EXPANSION_MODEL", ""),
      defaultApplied: !hasEnv("SELFMEM_QUERY_EXPANSION_MODEL"),
    },
  };
  const allNames = inspectCommands(resumePacket).placeholderNames;
  const requiredPlaceholders = allNames
    .filter((name) => !Object.hasOwn(optionalSpecs, name))
    .map((name) => {
      const spec = replacementSpecs[name] ?? { source: "unknown-placeholder", ready: false, value: null };
      return { name, source: spec.source, ready: Boolean(spec.ready), printsValue: false };
    });
  const optionalPlaceholders = allNames
    .filter((name) => Object.hasOwn(optionalSpecs, name))
    .map((name) => ({ name, ready: true, defaultApplied: optionalSpecs[name].defaultApplied, printsValue: false }));
  return {
    replacements: Object.fromEntries(
      [...Object.entries(replacementSpecs), ...Object.entries(optionalSpecs)].map(([name, spec]) => [name, String(spec.value ?? "")]),
    ),
    requiredPlaceholders,
    optionalPlaceholders,
    unresolvedRequiredPlaceholderNames: requiredPlaceholders.filter((entry) => !entry.ready).map((entry) => entry.name),
    optionalDefaultsApplied: optionalPlaceholders.filter((entry) => entry.defaultApplied).map((entry) => entry.name),
  };
}

function materializeCommands(commands, replacements) {
  return Object.entries(commands ?? {})
    .filter(([id, command]) => !packetOnlyCommandIds.has(id) && typeof command === "string" && command.trim().length > 0)
    .map(([id, command]) => ({ id, command: materializeCommand(command, replacements) }));
}

function materializeCommand(command, replacements) {
  return String(command).replaceAll(/<([^>]+)>/gu, (_, name) => shellQuote(replacements[name] ?? ""));
}

function renderPrivateScript(commands) {
  const lines = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "",
    "# Private RecallWeave local-full shard resume commands.",
    "# Contains private paths and local endpoint values. Do not commit.",
    "",
  ];
  commands.forEach((item, index) => {
    lines.push(`# ${index + 1}. ${item.id}`);
    lines.push(item.command);
    lines.push("");
  });
  return `${lines.join("\n")}\n`;
}

function renderMarkdown(value) {
  return [
    "# Local-Full Shard Resume Command Materializer",
    "",
    `- Status: ${value.status}`,
    `- Fixture only: ${value.fixtureOnly}`,
    `- Ready for materialization: ${value.readyForMaterialization}`,
    `- Writes private command file: ${value.writesRealPrivateCommandFile}`,
    `- Private command path printed: ${value.privateCommandFile.pathPrinted}`,
    `- Prints materialized commands: ${value.printsMaterializedCommands}`,
    `- Prints env values: ${value.printsEnvValues}`,
    `- Prints private paths: ${value.printsPrivatePaths}`,
    `- Command count: ${value.commandPlan.commandCount}`,
    `- Materialized command count: ${value.commandPlan.materializedCommandCount}`,
    `- Required placeholders ready: ${value.replacementPlan.requiredPlaceholdersReady}`,
    `- Unresolved required placeholders: ${value.replacementPlan.unresolvedRequiredPlaceholderNames.join(", ") || "none"}`,
    `- Optional defaults applied: ${value.replacementPlan.optionalDefaultsApplied.join(", ") || "none"}`,
    `- Counts as local-full benchmark evidence: ${value.countsAsLocalFullBenchmarkEvidence}`,
    "",
    "## Command IDs",
    ...value.commandPlan.commandIds.map((id) => `- ${id}`),
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}

function inspectPrivateDir(value) {
  const resolvedPath = value ? resolveInputPath(value) : null;
  const present = Boolean(resolvedPath && existsSync(resolvedPath) && statSync(resolvedPath).isDirectory());
  const rel = resolvedPath ? relative(root, resolvedPath) : null;
  const insideRepository = Boolean(resolvedPath && rel && !rel.startsWith("..") && !isAbsolute(rel));
  return {
    resolvedPath,
    provided: Boolean(value),
    present,
    outsideRepository: Boolean(resolvedPath && present && !insideRepository),
    public: {
      provided: Boolean(value),
      label: value ? "external-private-dir" : null,
      present,
      outsideRepository: Boolean(resolvedPath && present && !insideRepository),
      pathPrinted: false,
    },
  };
}

function inspectPrivateCommandOutput(value) {
  const resolvedPath = value ? resolveInputPath(value) : null;
  const rel = resolvedPath ? relative(root, resolvedPath) : null;
  const insideRepository = Boolean(resolvedPath && rel && !rel.startsWith("..") && !isAbsolute(rel));
  return {
    resolvedPath,
    provided: Boolean(value),
    outsideRepository: Boolean(resolvedPath && !insideRepository),
  };
}

function createFixtureState() {
  const tempRoot = mkdtempSync(join(tmpdir(), "recallweave-local-full-resume-command-fixture-"));
  fixtureTempRoots.push(tempRoot);
  const privateDir = join(tempRoot, "private");
  mkdirSync(privateDir, { recursive: true, mode: 0o700 });
  Object.assign(process.env, {
    SELFMEM_LOCAL_EMBED_BASE_URL: "http://127.0.0.1:65535/v1",
    SELFMEM_LOCAL_EMBED_MODEL: "fixture-local-embedding-model",
    SELFMEM_LOCAL_EMBED_BATCH_MAX_TOKENS: "700",
    SELFMEM_LOCAL_RERANK_BASE_URL: "http://127.0.0.1:65534/v1",
    SELFMEM_LOCAL_RERANK_MODEL: "fixture-local-rerank-model",
    SELFMEM_LOCAL_RERANK_CANDIDATE_LIMIT: "8",
    RECALLWEAVE_MEMORYBENCH_BASE_URL: "http://127.0.0.1:65533/v1",
    RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL: "fixture-local-answer-model",
    RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL: "fixture-local-judge-model",
  });
  return {
    privateDir,
    privateCommandOutput: join(tempRoot, "resume-shard-002.private.sh"),
  };
}

function envReplacement(name) {
  const value = process.env[name];
  return {
    source: name,
    value,
    ready: stringOrNull(value) !== null,
  };
}

function optionalEnv(name, fallback) {
  return stringOrNull(process.env[name]) ?? fallback;
}

function hasEnv(name) {
  return stringOrNull(process.env[name]) !== null;
}

function readFileSyncChecked(path, label) {
  assert.ok(existsSync(path), `${label} missing: ${displayPath(path)}`);
  assert.ok(statSync(path).size > 0, `${label} empty: ${displayPath(path)}`);
  const raw = readFileSync(path, "utf8");
  assertSafePublicText(raw, label);
  return raw;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function resolveInputPath(pathLike) {
  const value = String(pathLike);
  return isAbsolute(value) ? value : resolve(root, value);
}

function displayPath(path) {
  const rel = relative(root, path).replaceAll("\\", "/");
  return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : "external-file";
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}

function stringOrNull(value) {
  const string = String(value ?? "").trim();
  return string.length ? string : null;
}

function shellQuote(value) {
  const string = String(value ?? "");
  if (/^[A-Za-z0-9_./:@%+=,-]+$/u.test(string)) return string;
  return `'${string.replaceAll("'", "'\\''")}'`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertSafePublicText(text, label) {
  const secretPattern =
    /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
  const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|\/tmp\/|\/home\/|[A-Za-z]:\\Users\\)/i;
  const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;
  assert.equal(secretPattern.test(text), false, `${label} contains secret-shaped text`);
  assert.equal(privatePathPattern.test(text), false, `${label} contains absolute private path`);
  assert.equal(privateTagPattern.test(text), false, `${label} contains private tag`);
}
