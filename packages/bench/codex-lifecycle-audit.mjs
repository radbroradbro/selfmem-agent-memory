import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir, homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const fixtureTempRoots = [];
process.on("exit", () => {
  for (const tempRoot of fixtureTempRoots) {
    try {
      rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      // Best effort only. Fixture mode never writes inside the repository.
    }
  }
});

const fixtureMode = Boolean(args.fixture);
const fixtureState = fixtureMode ? createFixtureState() : null;
const hooksPath = resolveInputPath(fixtureState?.hooksPath ?? args.hooks ?? join(homedir(), ".codex", "hooks.json"));
const bridgeRoot = resolveInputPath(
  fixtureState?.bridgeRoot ?? args.bridgeRoot ?? process.env.CODEX_SELFMEM_BRIDGE_ROOT ?? join(homedir(), ".codex", "selfmem-bridge"),
);
const configPath = resolveInputPath(fixtureState?.configPath ?? args.config ?? join(bridgeRoot, "config.json"));
const storeRoot = resolveInputPath(fixtureState?.storeRoot ?? args.storeRoot ?? join(bridgeRoot, "store"));
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();
const strict = Boolean(args.strict);

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");

const hooksRaw = readOptional(hooksPath);
const configRaw = readOptional(configPath);
const hooks = parseJsonOrNull(hooksRaw.text);
const config = parseJsonOrNull(configRaw.text);
const events = readJsonl(join(storeRoot, "events.jsonl"));
const memories = readJsonl(join(storeRoot, "memories.jsonl"));
const distilled = readJsonl(join(storeRoot, "distilled-memories.jsonl"));
const transcriptState = inspectTranscripts(join(storeRoot, "transcripts"));
const hookState = inspectHooks(hooks);
const bridgeState = inspectBridge(config, {
  bridgeRootPresent: existsSync(bridgeRoot),
  configPresent: configRaw.present,
  configParseOk: configRaw.present ? Boolean(config) : null,
});
const lifecycleState = inspectLifecycle(events);
const privacyState = inspectPrivacy({ hooksRaw, configRaw, events, memories, distilled, transcriptState });
const lcmState = inspectLcm({ hookState, config });

const promptStopReady = hookState.userPromptSubmitRecallHook && hookState.stopFlushHook && bridgeState.configPresent && bridgeState.configParseOk;
const ok = promptStopReady && privacyState.privateLeakCount === 0 && bridgeState.hostedWriteBackDisabled;
const blockers = [
  !hookState.hooksPresent ? "codex-hooks-file-missing-or-invalid" : null,
  !hookState.userPromptSubmitRecallHook ? "codex-user-prompt-recall-hook-missing" : null,
  !hookState.stopFlushHook ? "codex-stop-flush-hook-missing" : null,
  !bridgeState.configPresent ? "codex-selfmem-bridge-config-missing" : null,
  bridgeState.configPresent && !bridgeState.configParseOk ? "codex-selfmem-bridge-config-invalid" : null,
  !bridgeState.hostedWriteBackDisabled ? "hosted-write-back-enabled" : null,
  privacyState.privateLeakCount > 0 ? "public-report-privacy-leak" : null,
].filter(Boolean);

const report = {
  schemaVersion: 1,
  ok,
  mode: "codex-lifecycle-audit",
  status: ok ? "READY_CODEX_PROMPT_STOP_LIFECYCLE_AUDIT" : "BLOCKED_CODEX_PROMPT_STOP_LIFECYCLE_AUDIT",
  fixtureOnly: fixtureMode,
  generatedAt: new Date().toISOString(),
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  metricsOnly: true,
  publicSafe: privacyState.privateLeakCount === 0,
  callsProviderApis: false,
  callsHostedSupermemory: false,
  sendsSessionTextToProvider: false,
  readsLocalCodexHookState: true,
  rawTranscriptIncluded: false,
  rawMemoryIncluded: false,
  rawPromptIncluded: false,
  rawPrivateOutputPathIncluded: false,
  printsCommands: false,
  printsEnvValues: false,
  printsPrivatePaths: false,
  modifiesBenchmarkRetrieval: false,
  modifiesBenchmarkScoring: false,
  countsAsBenchmarkEvidence: false,
  publicBenchmarkClaimsAllowed: false,
  promptStopReady,
  hooks: hookState.public,
  bridge: bridgeState.public,
  lifecycle: lifecycleState,
  store: {
    memoryCount: memories.length,
    distilledMemoryCount: distilled.length,
    transcriptCopyCount: transcriptState.count,
    transcriptTotalBytes: transcriptState.totalBytes,
    maxTranscriptBytes: transcriptState.maxBytes,
    transcriptFileHashes: transcriptState.fileHashes,
    transcriptTextPrinted: false,
  },
  lcm: lcmState,
  privacy: privacyState.public,
  blockers,
  nextActions: buildNextActions({ ok, hookState, bridgeState, lcmState }),
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "codex lifecycle audit");
assertSafePublicText(markdownText, "codex lifecycle audit markdown");
if (strict) {
  assert.equal(report.ok, true, jsonText);
  assert.equal(report.privacy.privateLeakCount, 0, jsonText);
  assert.equal(report.hooks.userPromptSubmitRecallHook, true, jsonText);
  assert.equal(report.hooks.stopFlushHook, true, jsonText);
  assert.equal(report.bridge.hostedWriteBackDisabled, true, jsonText);
  assert.equal(report.lcm.deepseekFlashCompressionArm.defaultEnabled, false, jsonText);
  assert.equal(report.modifiesBenchmarkRetrieval, false, jsonText);
  assert.equal(report.countsAsBenchmarkEvidence, false, jsonText);
}
if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);

function inspectHooks(value) {
  const hooks = value?.hooks && typeof value.hooks === "object" ? value.hooks : {};
  const eventNames = Object.keys(hooks).sort();
  const commandsByEvent = Object.fromEntries(eventNames.map((eventName) => [eventName, hookCommands(hooks[eventName])]));
  const userPromptCommands = commandsByEvent.UserPromptSubmit ?? [];
  const stopCommands = commandsByEvent.Stop ?? [];
  const preCompactEventNames = eventNames.filter((name) => /compact|compress|pre.*compact|pre.*compress/i.test(name));
  const allCommands = Object.values(commandsByEvent).flat();
  const userPromptSubmitRecallHook = userPromptCommands.some((command) => /selfmem-bridge[/\\]bridge\.js\s+recall\b/.test(command));
  const stopFlushHook = stopCommands.some((command) => /selfmem-bridge[/\\]bridge\.js\s+flush\b/.test(command));
  return {
    hooksPresent: Boolean(value?.hooks),
    userPromptSubmitRecallHook,
    stopFlushHook,
    preCompactHookObserved: preCompactEventNames.length > 0,
    public: {
      hooksFilePresent: Boolean(value?.hooks),
      eventNames,
      eventCount: eventNames.length,
      userPromptSubmitRecallHook,
      stopFlushHook,
      preCompactHookObserved: preCompactEventNames.length > 0,
      preCompactEventNames,
      commandCount: allCommands.length,
      commandHashes: allCommands.map((command) => `sha256:${sha256(command)}`),
      commandsPrinted: false,
      pathsPrinted: false,
    },
  };
}

function hookCommands(value) {
  const groups = Array.isArray(value) ? value : [];
  return groups.flatMap((group) =>
    (Array.isArray(group?.hooks) ? group.hooks : [])
      .filter((hook) => hook?.type === "command" && typeof hook.command === "string")
      .map((hook) => hook.command),
  );
}

function inspectBridge(value, state) {
  const mode = String(value?.mode ?? "");
  const recallPolicy = String(value?.recallPolicy ?? "");
  const mirrorWritesToSupermemory = value?.mirrorWritesToSupermemory === true;
  const liveSupermemorySearch = value?.liveSupermemorySearch === true;
  const exportCacheConfigured = typeof value?.exportCachePath === "string" && value.exportCachePath.trim().length > 0;
  const useDistilledRecall = value?.useDistilledRecall !== false;
  const enabled = value?.enabled !== false;
  return {
    ...state,
    hostedWriteBackDisabled: !mirrorWritesToSupermemory,
    public: {
      bridgeRootPresent: state.bridgeRootPresent,
      configPresent: state.configPresent,
      configParseOk: state.configParseOk,
      enabled,
      mode,
      recallPolicy,
      recallEveryPrompts: numberOrNull(value?.recallEveryPrompts),
      recallMinIntervalMinutes: numberOrNull(value?.recallMinIntervalMinutes),
      recallOnLongPromptChars: numberOrNull(value?.recallOnLongPromptChars),
      maxContextItems: numberOrNull(value?.maxContextItems),
      maxContextChars: numberOrNull(value?.maxContextChars),
      maxTranscriptBytes: numberOrNull(value?.maxTranscriptBytes),
      useDistilledRecall,
      liveSupermemorySearch,
      hostedWriteBackDisabled: !mirrorWritesToSupermemory,
      exportCacheConfigured,
      exportCachePathPrinted: false,
      distilledMemoryPathPrinted: false,
    },
  };
}

function inspectLifecycle(events) {
  const typeCounts = {};
  let recallRunCount = 0;
  let recallSkipCount = 0;
  let stopCount = 0;
  let writtenMemoryCount = 0;
  let redactionCount = 0;
  let latestEventAt = null;
  for (const event of events) {
    const type = String(event?.type ?? "unknown");
    typeCounts[type] = (typeCounts[type] ?? 0) + 1;
    if (type === "recall-run") recallRunCount += 1;
    if (type === "recall-skip") recallSkipCount += 1;
    if (type === "stop") stopCount += 1;
    writtenMemoryCount += Number.isFinite(Number(event?.written)) ? Number(event.written) : 0;
    redactionCount += Number.isFinite(Number(event?.redactions)) ? Number(event.redactions) : 0;
    if (event?.at && (!latestEventAt || new Date(event.at) > new Date(latestEventAt))) latestEventAt = event.at;
  }
  return {
    eventCount: events.length,
    eventTypes: Object.keys(typeCounts).sort(),
    typeCounts,
    recallRunCount,
    recallSkipCount,
    stopCount,
    writtenMemoryCount,
    redactionCount,
    latestEventAt,
    hasPromptLifecycle: typeCounts.prompt > 0 || recallRunCount > 0 || recallSkipCount > 0,
    hasStopLifecycle: stopCount > 0,
    preCompactEventCount: Object.entries(typeCounts)
      .filter(([type]) => /compact|compress|pre.*compact|pre.*compress/i.test(type))
      .reduce((sum, [, count]) => sum + count, 0),
    rawPromptTextPrinted: false,
    rawTranscriptTextPrinted: false,
  };
}

function inspectTranscripts(transcriptsDir) {
  if (!existsSync(transcriptsDir)) return { count: 0, totalBytes: 0, maxBytes: 0, fileHashes: [], unsafeHitCount: 0 };
  const files = readdirSync(transcriptsDir).filter((name) => name.endsWith(".jsonl")).sort();
  const records = files.map((name) => {
    const file = join(transcriptsDir, name);
    const raw = readFileSync(file, "utf8");
    return {
      hash: `sha256:${sha256(raw)}`,
      bytes: statSync(file).size,
      unsafeHits: countUnsafeText(raw),
    };
  });
  return {
    count: records.length,
    totalBytes: records.reduce((sum, item) => sum + item.bytes, 0),
    maxBytes: Math.max(0, ...records.map((item) => item.bytes)),
    fileHashes: records.map((item) => item.hash),
    unsafeHitCount: records.reduce((sum, item) => sum + item.unsafeHits, 0),
  };
}

function inspectPrivacy({ hooksRaw, configRaw, events, memories, distilled, transcriptState }) {
  const publicSerialized = JSON.stringify({
    hooksPresent: hooksRaw.present,
    hooksHash: hooksRaw.present ? `sha256:${sha256(hooksRaw.text)}` : null,
    configPresent: configRaw.present,
    configHash: configRaw.present ? `sha256:${sha256(configRaw.text)}` : null,
    eventCount: events.length,
    memoryCount: memories.length,
    distilledMemoryCount: distilled.length,
    transcriptCount: transcriptState.count,
    transcriptHashes: transcriptState.fileHashes,
  });
  const unsafePublic = countUnsafeText(publicSerialized);
  const unsafeStore =
    events.reduce((sum, item) => sum + countUnsafeText(JSON.stringify(stripKnownPrivateFields(item))), 0) +
    memories.reduce((sum, item) => sum + countUnsafeText(JSON.stringify(stripKnownPrivateFields(item))), 0) +
    distilled.reduce((sum, item) => sum + countUnsafeText(JSON.stringify(stripKnownPrivateFields(item))), 0);
  const privateLeakCount = unsafePublic + unsafeStore;
  return {
    privateLeakCount,
    public: {
      privateLeakCount,
      unsafeTranscriptHitCount: transcriptState.unsafeHitCount,
      unsafeTranscriptHitsInspectedButNotPrinted: true,
      publicReportContainsTranscriptText: false,
      publicReportContainsMemoryText: false,
      publicReportContainsPromptText: false,
      publicReportContainsPrivatePaths: false,
      publicReportContainsCredentials: false,
    },
  };
}

function stripKnownPrivateFields(value) {
  if (!value || typeof value !== "object") return value;
  const clone = { ...value };
  for (const key of ["transcriptCopy", "sourcePath", "sourceId", "text", "content", "prompt"]) {
    if (Object.hasOwn(clone, key)) clone[key] = "<redacted-for-audit>";
  }
  return clone;
}

function inspectLcm({ hookState, config }) {
  const deepseekFlashExplicitlyEnabled =
    process.env.RECALLWEAVE_CODEX_LCM_DEEPSEEK_FLASH === "1" || config?.codexLcm?.deepseekFlash === true;
  return {
    codexPreCompactHookObserved: hookState.preCompactHookObserved,
    codexPreCompactStatus: hookState.preCompactHookObserved ? "OBSERVED" : "NOT_EXPOSED_BY_CURRENT_CODEX_HOOKS",
    stopFlushPreservesRedactedSessionCopy: true,
    defaultRecallUsesDistilledMemory: config?.useDistilledRecall !== false,
    rawSessionAuditLocalOnly: true,
    deepseekFlashCompressionArm: {
      provider: "deepseek",
      model: "deepseek-v4-flash",
      defaultEnabled: false,
      currentlyEnabled: deepseekFlashExplicitlyEnabled,
      requiresExplicitEnv: "RECALLWEAVE_CODEX_LCM_DEEPSEEK_FLASH=1",
      callsProviderApisInThisAudit: false,
      benchmarkIsolationRequired: true,
      countsAsBenchmarkEvidence: false,
      recommendedUse: "optional-offline-distillation-arm-after-redaction",
    },
    benchmarkPolicy: {
      lifecycleCompressionMustNotChangeBenchmarkRetrievalByDefault: true,
      compressionOutputsMustBeLabeledSeparateArm: true,
      defaultBenchmarkRunsShouldUseExistingRetrievalPath: true,
    },
  };
}

function buildNextActions({ ok: ready, hookState, bridgeState, lcmState }) {
  const actions = [];
  if (!hookState.userPromptSubmitRecallHook) actions.push("Install or repair the Codex UserPromptSubmit recall hook.");
  if (!hookState.stopFlushHook) actions.push("Install or repair the Codex Stop flush hook.");
  if (!bridgeState.configPresent || !bridgeState.configParseOk) actions.push("Restore a valid local Codex selfmem bridge config.");
  if (!bridgeState.hostedWriteBackDisabled) actions.push("Disable hosted write-back unless the owner explicitly approves it.");
  if (!lcmState.codexPreCompactHookObserved) {
    actions.push("Treat Codex pre-compaction capture as unsupported until Codex exposes a native compact/compress lifecycle event.");
  }
  actions.push("Keep Codex LCM or DeepSeek v4 flash compression as an explicit, isolated experiment arm before using it in benchmark claims.");
  if (ready) actions.push("Use this audit before and after Codex lifecycle changes to prove recall/write hooks remain local-first and metrics-only.");
  return [...new Set(actions)];
}

function renderMarkdown(value) {
  return [
    "# Codex Lifecycle Audit",
    "",
    `- Status: ${value.status}`,
    `- Fixture only: ${value.fixtureOnly}`,
    `- Prompt/Stop lifecycle ready: ${value.promptStopReady}`,
    `- User prompt recall hook: ${value.hooks.userPromptSubmitRecallHook}`,
    `- Stop flush hook: ${value.hooks.stopFlushHook}`,
    `- Codex pre-compact hook observed: ${value.lcm.codexPreCompactHookObserved}`,
    `- Codex pre-compact status: ${value.lcm.codexPreCompactStatus}`,
    `- Hosted write-back disabled: ${value.bridge.hostedWriteBackDisabled}`,
    `- Distilled recall enabled: ${value.bridge.useDistilledRecall}`,
    `- Recall run count: ${value.lifecycle.recallRunCount}`,
    `- Recall skip count: ${value.lifecycle.recallSkipCount}`,
    `- Stop count: ${value.lifecycle.stopCount}`,
    `- Stored memory count: ${value.store.memoryCount}`,
    `- Distilled memory count: ${value.store.distilledMemoryCount}`,
    `- Transcript copy count: ${value.store.transcriptCopyCount}`,
    `- Transcript text printed: ${value.store.transcriptTextPrinted}`,
    `- DeepSeek v4 flash compression default enabled: ${value.lcm.deepseekFlashCompressionArm.defaultEnabled}`,
    `- Modifies benchmark retrieval: ${value.modifiesBenchmarkRetrieval}`,
    `- Counts as benchmark evidence: ${value.countsAsBenchmarkEvidence}`,
    `- Private leak count: ${value.privacy.privateLeakCount}`,
    "",
    "## Hook Events",
    ...(value.hooks.eventNames.length ? value.hooks.eventNames.map((name) => `- ${name}`) : ["- none"]),
    "",
    "## Lifecycle Event Types",
    ...(value.lifecycle.eventTypes.length ? value.lifecycle.eventTypes.map((name) => `- ${name}: ${value.lifecycle.typeCounts[name]}`) : ["- none"]),
    "",
    "## LCM Policy",
    `- Raw session audit local only: ${value.lcm.rawSessionAuditLocalOnly}`,
    `- Default recall uses distilled memory: ${value.lcm.defaultRecallUsesDistilledMemory}`,
    `- Compression must be labeled as a separate benchmark arm: ${value.lcm.benchmarkPolicy.compressionOutputsMustBeLabeledSeparateArm}`,
    `- DeepSeek v4 flash recommended use: ${value.lcm.deepseekFlashCompressionArm.recommendedUse}`,
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}

function createFixtureState() {
  const tempRoot = mkdtempSync(join(tmpdir(), "recallweave-codex-lifecycle-audit-fixture-"));
  fixtureTempRoots.push(tempRoot);
  const bridgeRoot = join(tempRoot, "selfmem-bridge");
  const storeRoot = join(bridgeRoot, "store");
  const transcriptRoot = join(storeRoot, "transcripts");
  mkdirSync(transcriptRoot, { recursive: true, mode: 0o700 });
  const hooksPath = join(tempRoot, "hooks.json");
  const configPath = join(bridgeRoot, "config.json");
  writeJsonFile(hooksPath, {
    hooks: {
      UserPromptSubmit: [{ hooks: [{ type: "command", command: "node /example/.codex/selfmem-bridge/bridge.js recall", timeout: 30 }] }],
      Stop: [{ hooks: [{ type: "command", command: "node /example/.codex/selfmem-bridge/bridge.js flush", timeout: 45 }] }],
    },
  });
  writeJsonFile(configPath, {
    version: 1,
    enabled: true,
    mode: "local-first-read-through",
    liveSupermemorySearch: false,
    mirrorWritesToSupermemory: false,
    exportCachePath: "",
    recallPolicy: "periodic-or-signal",
    recallEveryPrompts: 8,
    recallMinIntervalMinutes: 20,
    recallOnLongPromptChars: 1200,
    maxContextItems: 5,
    maxContextChars: 4000,
    useDistilledRecall: true,
    maxTranscriptBytes: 5000000,
  });
  writeJsonl(join(storeRoot, "events.jsonl"), [
    { type: "prompt", at: "2026-05-26T12:00:00.000Z", promptHash: "fixture-prompt-hash", redactions: 0, length: 1200 },
    { type: "recall-run", at: "2026-05-26T12:00:01.000Z", promptHash: "fixture-prompt-hash", reason: "long-prompt", promptCount: 8, matches: 3 },
    { type: "recall-skip", at: "2026-05-26T12:05:00.000Z", promptHash: "fixture-skip-hash", reason: "throttle", promptCount: 9 },
    {
      type: "stop",
      at: "2026-05-26T12:10:00.000Z",
      sourceId: "codex-stop-fixture",
      transcriptCopy: "/example/.codex/selfmem-bridge/store/transcripts/codex-stop-fixture.jsonl",
      sourcePathHash: "fixture-source-path-hash",
      redactions: 1,
      candidates: 3,
      written: 2,
    },
  ]);
  writeJsonl(join(storeRoot, "memories.jsonl"), [
    { id: "mem_fixture_1", kind: "conversation", text: "Procedure: keep Codex memory writes local-first.", scope: "codex_global" },
    { id: "mem_fixture_2", kind: "conversation", text: "Decision: use distilled recall by default.", scope: "codex_global" },
  ]);
  writeJsonl(join(storeRoot, "distilled-memories.jsonl"), [
    { id: "distilled_fixture_1", kind: "Procedure", text: "Use prompt-submit recall and stop flush lifecycle hooks." },
  ]);
  writeJsonl(join(transcriptRoot, "codex-stop-fixture.jsonl"), [
    { role: "user", content: "Preference: keep raw session evidence local." },
    { role: "assistant", content: "Decision: use distilled summaries by default." },
  ]);
  return { hooksPath, bridgeRoot, configPath, storeRoot };
}

function readOptional(path) {
  if (!existsSync(path)) return { present: false, text: "" };
  assert.ok(statSync(path).isFile(), `expected file: ${displayPath(path)}`);
  return { present: true, text: readFileSync(path, "utf8") };
}

function parseJsonOrNull(raw) {
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function writeJsonFile(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeJsonl(path, values) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${values.map((value) => JSON.stringify(value)).join("\n")}\n`, "utf8");
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

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function countUnsafeText(text) {
  const string = String(text ?? "");
  const secretPattern =
    /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
  const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/i;
  return Number(secretPattern.test(string)) + Number(privateTagPattern.test(string));
}

function assertSafePublicText(text, label) {
  const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|\/tmp\/|\/home\/|[A-Za-z]:\\Users\\)/i;
  assert.equal(countUnsafeText(text), 0, `${label} contains secret-shaped or private-tag text`);
  assert.equal(privatePathPattern.test(text), false, `${label} contains absolute private path`);
}
