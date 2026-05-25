import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;
const args = parseArgs(process.argv.slice(2));
const targetPath = resolveInputPath(args.target ?? process.env.RECALLWEAVE_MEMORYBENCH_TARGET ?? "reviews/overnight-20260522/public-longmemeval-expanded-run-target.json");
const querySetPath = resolveOptionalPath(args.queryset ?? args.querySet ?? process.env.RECALLWEAVE_BASELINE_QUERYSET ?? null);
const memoriesPath = resolveOptionalPath(args.memories ?? args.memoriesJsonl ?? process.env.RECALLWEAVE_BASELINE_MEMORIES_JSONL ?? null);
const answerLabelsPath = resolveOptionalPath(args.answerLabels ?? process.env.RECALLWEAVE_MEMORYBENCH_ANSWER_LABELS ?? null);
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();
const requireReady = Boolean(args.requireReady);
const armSpecs = parseArmSpecs(args.arm ?? args.arms);

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(existsSync(targetPath), `benchmark target missing: ${displayPath(targetPath)}`);
assert.ok(statSync(targetPath).size > 0, `benchmark target empty: ${displayPath(targetPath)}`);

const targetRaw = readFileSync(targetPath, "utf8");
assertSafePublicText(targetRaw, "benchmark target");
const target = JSON.parse(targetRaw);
const targetOk = target.fixtureOnly === false && target.benchmark?.family === "longmemeval" && target.claimTier === "run-only";
const answerQualityCallsEnabled = truthyEnv("RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS");
const publicDataConfirmed = truthyEnv("RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA");
const noRawTextOutputConfirmed = truthyEnv("RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT");
const answerModel = envPresence("RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL", "RECALLWEAVE_BASELINE_ANSWER_MODEL");
const judgeModel = envPresence("RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL", "RECALLWEAVE_BASELINE_JUDGE_MODEL");
const baseUrl = envPresence("RECALLWEAVE_MEMORYBENCH_BASE_URL");
const apiKey = envPresence("RECALLWEAVE_MEMORYBENCH_API_KEY");
const endpointIsLocal = isLocalUrl(process.env.RECALLWEAVE_MEMORYBENCH_BASE_URL ?? "");

const privateInputs = inspectPrivateInputs();
const arms = inspectArms();
const strategyNames = arms.map((arm) => arm.strategy);
const challengerStrategies = strategyNames.filter((strategy) => !["bm25-lite", "full-hybrid-rerank"].includes(strategy));
const envReady =
  answerQualityCallsEnabled &&
  publicDataConfirmed &&
  noRawTextOutputConfirmed &&
  answerModel.present &&
  judgeModel.present &&
  baseUrl.present &&
  (endpointIsLocal || apiKey.present);
const privateInputsReady = privateInputs.querySet.present && privateInputs.memories.present && privateInputs.answerLabels.present;
const armsReady = arms.length > 0 && arms.every((arm) => arm.present && arm.parseable);
const sameDataReady =
  privateInputs.querySet.matchesTarget !== false &&
  privateInputs.answerLabels.matchesTarget !== false &&
  arms.every((arm) => arm.querySetMatches !== false);
const requiredStrategyCoverage = {
  hasBm25Lite: strategyNames.includes("bm25-lite"),
  hasFullHybridRerank: strategyNames.includes("full-hybrid-rerank"),
  hasChallenger: challengerStrategies.length > 0,
};

const blockers = [
  !targetOk ? "target-not-public-longmemeval-run-only" : null,
  !answerQualityCallsEnabled ? "RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS-not-enabled" : null,
  !publicDataConfirmed ? "RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA-not-confirmed" : null,
  !noRawTextOutputConfirmed ? "RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT-not-confirmed" : null,
  !answerModel.present ? "answer-model-missing" : null,
  !judgeModel.present ? "judge-model-missing" : null,
  !baseUrl.present ? "openai-compatible-base-url-missing" : null,
  baseUrl.present && !endpointIsLocal && !apiKey.present ? "cloud-endpoint-api-key-missing" : null,
  !privateInputs.querySet.present ? "private-queryset-missing" : null,
  !privateInputs.memories.present ? "private-memories-missing" : null,
  !privateInputs.answerLabels.present ? "private-answer-labels-missing" : null,
  privateInputs.querySet.matchesTarget === false ? "private-queryset-hash-mismatch" : null,
  privateInputs.answerLabels.matchesTarget === false ? "private-answer-labels-hash-mismatch" : null,
  arms.length === 0 ? "response-arm-exports-missing" : null,
  !armsReady && arms.length > 0 ? "response-arm-export-not-ready" : null,
  arms.some((arm) => arm.querySetMatches === false) ? "response-arm-queryset-hash-mismatch" : null,
  !requiredStrategyCoverage.hasBm25Lite ? "bm25-lite-arm-missing" : null,
  !requiredStrategyCoverage.hasFullHybridRerank ? "full-hybrid-rerank-arm-missing" : null,
  !requiredStrategyCoverage.hasChallenger ? "provider-or-local-challenger-arm-missing" : null,
].filter(Boolean);
const ready = blockers.length === 0;

const report = {
  schemaVersion: 1,
  ok: !requireReady || ready,
  mode: "public-benchmark-answer-quality-preflight",
  status: ready ? "READY_FOR_LIVE_ANSWER_QUALITY" : "BLOCKED_ANSWER_QUALITY_ENV",
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  metricsOnly: true,
  publicSafe: true,
  callsProviderApis: false,
  sendsBenchmarkTextToProvider: false,
  rawQuestionIdsIncluded: false,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPromptIncluded: false,
  printsCredentials: false,
  generatedAt: new Date().toISOString(),
  target: {
    path: displayPath(targetPath),
    hash: `sha256:${sha256(targetRaw)}`,
    fixtureOnly: Boolean(target.fixtureOnly),
    benchmark: target.benchmark?.family ?? target.benchmark?.name ?? null,
    claimTier: target.claimTier ?? null,
    answerLabelsHash: target.benchmark?.answerLabelsHash ?? null,
    scoringCodeHash: target.benchmark?.scoringCodeHash ?? null,
  },
  consent: {
    answerQualityCallsEnabled,
    publicDataConfirmed,
    noRawTextOutputConfirmed,
  },
  endpoint: {
    baseUrlPresent: baseUrl.present,
    endpointIsLocal,
    apiKeyPresent: apiKey.present,
    valuePrinted: false,
  },
  models: {
    answerModelPresent: answerModel.present,
    judgeModelPresent: judgeModel.present,
    valuesPrinted: false,
  },
  privateInputs,
  arms,
  requiredStrategyCoverage,
  readiness: {
    envReady,
    privateInputsReady,
    armsReady,
    sameDataReady,
    liveAnswerQualityCanRun: ready,
    readyForEndToEndMemoryScoreGate: ready,
    countsAsFullMemorySotaEvidence: false,
  },
  blockers,
  nextActions: ready
    ? [
        "Run benchmark:answer-quality with --live against the private materialized inputs and response arm exports.",
        "Attach the metrics-only result to benchmark:memory-score:result-gate --require-ready.",
        "Send the metrics-only packet to independent reviewers before public benchmark wording changes.",
      ]
    : [
        "Materialize the source-locked target into an operator-private directory outside the repository.",
        "Export one private RecallWeave response file per strategy with baseline:export:recallweave.",
        "Set explicit answer-quality model-call, public-data, and no-raw-output consent flags before live scoring.",
        "Include bm25-lite, full-hybrid-rerank, and at least one provider or local challenger arm.",
      ],
  liveCommandTemplate: liveCommandTemplate(),
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "answer-quality preflight report");
assertSafePublicText(markdownText, "answer-quality preflight markdown");
if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (!report.ok) process.exitCode = 1;

function inspectPrivateInputs() {
  const querySet = inspectPrivateJson(querySetPath, "queryset", inspectQuerySet);
  const memories = inspectPrivateJsonl(memoriesPath, "memories");
  const answerLabels = inspectPrivateJson(answerLabelsPath, "answer-labels", inspectAnswerLabels);
  return { querySet, memories, answerLabels };
}

function inspectPrivateJson(path, role, inspector) {
  if (!path) return { role, present: false, rawTextPrivate: true };
  assertPrivateFile(path, role);
  const raw = readFileSync(path, "utf8");
  assert.doesNotMatch(raw, secretPattern, `${role} contains a key-shaped secret`);
  const parsed = JSON.parse(raw);
  return {
    role,
    present: true,
    rawTextPrivate: true,
    pathLabel: "external-input",
    name: basename(path),
    hash: `sha256:${sha256(raw)}`,
    ...inspector(parsed),
  };
}

function inspectPrivateJsonl(path, role) {
  if (!path) return { role, present: false, rawTextPrivate: true };
  assertPrivateFile(path, role);
  const raw = readFileSync(path, "utf8");
  assert.doesNotMatch(raw, secretPattern, `${role} contains a key-shaped secret`);
  const lineCount = raw.split(/\r?\n/).filter((line) => line.trim()).length;
  return {
    role,
    present: true,
    rawTextPrivate: true,
    pathLabel: "external-input",
    name: basename(path),
    hash: `sha256:${sha256(raw)}`,
    lineCount,
  };
}

function inspectQuerySet(value) {
  const querySetHash = `sha256:${sha256(canonicalJson(collectorQuerySetHashPayload(value)))}`;
  const expectedAnswerLabelsHash = target.benchmark?.answerLabelsHash ?? null;
  const expectedScoringCodeHash = target.benchmark?.scoringCodeHash ?? null;
  return {
    querySetHash,
    queryCount: Number(value.queries?.length ?? 0),
    answerLabelsHash: value.authoring?.answerLabelsHash ?? null,
    scoringCodeHash: value.authoring?.scoringCodeHash ?? null,
    matchesTarget:
      value.authoring?.answerLabelsHash === expectedAnswerLabelsHash &&
      value.authoring?.scoringCodeHash === expectedScoringCodeHash,
  };
}

function inspectAnswerLabels(value) {
  return {
    labelCount: Number(value.labels?.length ?? 0),
    answerLabelsHash: value.answerLabelsHash ?? null,
    scoringCodeHash: value.scoringCodeHash ?? null,
    matchesTarget:
      value.answerLabelsHash === (target.benchmark?.answerLabelsHash ?? null) &&
      value.scoringCodeHash === (target.benchmark?.scoringCodeHash ?? null),
  };
}

function inspectArms() {
  return armSpecs.map((arm) => {
    assertSafeStrategy(arm.strategy);
    assertPrivateFile(arm.path, `${arm.strategy} response arm`);
    const raw = readFileSync(arm.path, "utf8");
    assert.doesNotMatch(raw, secretPattern, `${arm.strategy} response arm contains a key-shaped secret`);
    const parsed = JSON.parse(raw);
    const querySetHash = parsed.querySetHash ?? null;
    return {
      strategy: arm.strategy,
      present: true,
      parseable: true,
      rawTextPrivate: true,
      pathLabel: "external-input",
      name: basename(arm.path),
      hash: `sha256:${sha256(raw)}`,
      querySetHash,
      responseCount: parsed.responses && typeof parsed.responses === "object" ? Object.keys(parsed.responses).length : 0,
      querySetMatches:
        privateInputs?.querySet?.querySetHash && querySetHash ? querySetHash === privateInputs.querySet.querySetHash : null,
    };
  });
}

function parseArmSpecs(value) {
  return coerceArray(value).flatMap((item) =>
    String(item)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const match = part.match(/^([^:=]+)[:=](.+)$/);
        assert.ok(match, `invalid arm spec: ${part}; expected strategy=/private/responses.json`);
        return { strategy: match[1], path: resolveInputPath(match[2]) };
      }),
  );
}

function liveCommandTemplate() {
  return [
    "RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS=1",
    "RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA=1",
    "RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT=1",
    "RECALLWEAVE_MEMORYBENCH_BASE_URL=<openai-compatible-base-url>",
    "RECALLWEAVE_MEMORYBENCH_API_KEY=<env-only-if-cloud-endpoint>",
    "RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL=<answer-model>",
    "RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL=<judge-model>",
    [
      "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality -- --live",
      `--target ${displayPath(targetPath)}`,
      "--queryset <private-output-dir>/materialized/longmemeval-queryset.private.json",
      "--memories <private-output-dir>/materialized/longmemeval-memories.private.jsonl",
      "--answer-labels <private-output-dir>/materialized/longmemeval-answer-labels.private.json",
      "--arm bm25-lite=<private-output-dir>/bm25-lite-responses.private.json",
      "--arm full-hybrid-rerank=<private-output-dir>/full-hybrid-rerank-responses.private.json",
      "--arm <provider-or-local-arm>=<private-output-dir>/<provider-or-local-arm>-responses.private.json",
      "--output <public-answer-quality-output.json>",
    ].join(" "),
  ];
}

function renderMarkdown(value) {
  return [
    "# Answer-Quality Benchmark Preflight",
    "",
    `- Status: ${value.status}`,
    `- Live answer-quality can run: ${value.readiness.liveAnswerQualityCanRun}`,
    `- Ready for end-to-end memory score gate: ${value.readiness.readyForEndToEndMemoryScoreGate}`,
    `- Calls provider APIs: ${value.callsProviderApis}`,
    `- Sends benchmark text to provider: ${value.sendsBenchmarkTextToProvider}`,
    `- Target hash: ${value.target.hash}`,
    "",
    "## Readiness",
    `- Env ready: ${value.readiness.envReady}`,
    `- Private inputs ready: ${value.readiness.privateInputsReady}`,
    `- Response arms ready: ${value.readiness.armsReady}`,
    `- Same-data hashes ready: ${value.readiness.sameDataReady}`,
    "",
    "## Strategy Coverage",
    `- BM25 lite: ${value.requiredStrategyCoverage.hasBm25Lite}`,
    `- Full hybrid rerank: ${value.requiredStrategyCoverage.hasFullHybridRerank}`,
    `- Provider or local challenger: ${value.requiredStrategyCoverage.hasChallenger}`,
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
    "",
    "## Live Command Template",
    "```bash",
    ...value.liveCommandTemplate,
    "```",
  ].join("\n");
}

function collectorQuerySetHashPayload(querySet) {
  return {
    schemaVersion: querySet.schemaVersion ?? 1,
    datasetSlice: querySet.datasetSlice ?? null,
    queries: (querySet.queries ?? []).map((query) => ({
      id: query.id,
      q: query.q,
      expectedResultIds: query.expectedResultIds ?? [],
      expectedResultHashes: query.expectedResultHashes ?? [],
    })),
  };
}

function assertPrivateFile(path, label) {
  assert.ok(path, `${label} is required`);
  assert.ok(existsSync(path), `${label} missing: external-input`);
  assert.ok(statSync(path).size > 0, `${label} empty: external-input`);
  assertOutsideRepo(path, label);
}

function assertOutsideRepo(path, label) {
  const rel = relative(root, resolve(path));
  assert.ok(rel.startsWith("..") || isAbsolute(rel), `${label} must stay outside the repository`);
}

function assertSafeStrategy(value) {
  assert.match(String(value), /^[A-Za-z0-9_.-]+$/, `unsafe strategy label: ${value}`);
}

function envPresence(...names) {
  const presentNames = names.filter((name) => String(process.env[name] ?? "").trim());
  return { present: presentNames.length > 0, envNames: names, presentEnvNames: presentNames, valuePrinted: false };
}

function truthyEnv(name) {
  return /^(1|true|yes|on)$/i.test(String(process.env[name] ?? ""));
}

function isLocalUrl(value) {
  try {
    const host = new URL(value).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function coerceArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (!item.startsWith("--")) continue;
    const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    const value = !next || next.startsWith("--") ? true : next;
    if (parsed[key] == null) parsed[key] = value;
    else if (Array.isArray(parsed[key])) parsed[key].push(value);
    else parsed[key] = [parsed[key], value];
    if (value !== true) index += 1;
  }
  return parsed;
}

function resolveOptionalPath(value) {
  return value ? resolveInputPath(value) : null;
}

function resolveInputPath(value) {
  return isAbsolute(String(value ?? "")) ? String(value) : resolve(root, String(value ?? ""));
}

function displayPath(value) {
  const rel = relative(root, value).replaceAll("\\", "/");
  return rel.startsWith("..") ? "external-input" : rel;
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(String(text), secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(String(text), privatePathPattern, `${label} contains a private local path`);
  assert.doesNotMatch(String(text), privateTagPattern, `${label} contains private tags`);
  assert.doesNotMatch(String(text), /\b(q|answer|content|memory|text|raw|prompt)"\s*:/, `${label} contains raw text-like fields`);
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function canonicalJson(value) {
  return JSON.stringify(sortForHash(value));
}

function sortForHash(value) {
  if (Array.isArray(value)) return value.map((item) => sortForHash(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortForHash(child)]),
    );
  }
  return value;
}
