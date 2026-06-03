import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const variantSpecs = coerceArray(args.variant ?? args.variants);
const outputPath = args.output ? resolve(root, args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolve(root, args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();
const requireReady = Boolean(args.requireReady);

const unknownAnswerHash = `sha256:${stableHash("unknown")}`;
const bareOneAnswerHash = `sha256:${stableHash("1")}`;
const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern =
  /(\/Users\/[^/\s"]+|\/Volumes\/[^/\s"]+|\/private\/[^/\s"]+|\/var\/folders\/[^/\s"]+|\/tmp\/[^/\s"]+|\/home\/[^/\s"]+|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*|memories\.jsonl|raw_events\.jsonl|lossless_context\.jsonl)/i;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(variantSpecs.length >= 2, "pass at least two --variant label=diagnostic.json entries");

const report = buildReport();
const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "context policy ablation");
assertSafePublicText(markdownText, "context policy ablation markdown");

if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (requireReady && report.status !== "READY_FOR_SOURCE_GRANULARITY_FIX_LOOP") process.exit(1);

function buildReport() {
  const variants = variantSpecs.map(loadVariant);
  const querySelectionHashes = new Set(variants.map((item) => item.queryShard.selectedQuestionIdsHash).filter(Boolean));
  const sameRawQuerySelection = querySelectionHashes.size === 1;
  const bestByScore = [...variants].sort(
    (left, right) =>
      Number(right.metrics.challengerAnswerQuality) - Number(left.metrics.challengerAnswerQuality) ||
      Number(right.metrics.challengerHitToCorrectRate) - Number(left.metrics.challengerHitToCorrectRate) ||
      Number(left.collapse.repeatedWrongUseTotal) - Number(right.collapse.repeatedWrongUseTotal),
  )[0];
  const bestByCollapse = [...variants].sort(
    (left, right) =>
      Number(left.collapse.repeatedWrongUseTotal) - Number(right.collapse.repeatedWrongUseTotal) ||
      Number(right.metrics.challengerHitToCorrectRate) - Number(left.metrics.challengerHitToCorrectRate),
  )[0];
  const scoreLiftObserved = variants.some((item) => Number(item.metrics.answerQualityDelta) > 0);
  const collapseReduced = Number(bestByCollapse.collapse.repeatedWrongUseTotal) < Number(variants[0].collapse.repeatedWrongUseTotal);
  const status = sameRawQuerySelection && !scoreLiftObserved && collapseReduced
    ? "READY_FOR_SOURCE_GRANULARITY_FIX_LOOP"
    : "BLOCKED_CONTEXT_POLICY_ABLATION_INCONCLUSIVE";
  return {
    schemaVersion: 1,
    ok: true,
    mode: "answer-quality-context-policy-ablation",
    generatedAt: new Date().toISOString(),
    publicSafe: true,
    metricsOnly: true,
    callsProviderApis: false,
    sendsBenchmarkTextToProvider: false,
    readsPrivateMaterializedInputs: false,
    publicBenchmarkClaimsAllowed: false,
    rawQuestionIdsIncluded: false,
    rawQuestionsIncluded: false,
    rawAnswersIncluded: false,
    rawMemoryIncluded: false,
    rawTranscriptIncluded: false,
    rawPrivateOutputPathIncluded: false,
    queryShard: {
      sameRawQuerySelectionAcrossVariants: sameRawQuerySelection,
      selectedQuestionIdsHash: sameRawQuerySelection ? [...querySelectionHashes][0] : null,
      variantCount: variants.length,
    },
    status,
    blockers: [
      sameRawQuerySelection ? null : "variants-not-same-query-selection",
      scoreLiftObserved ? "score-lift-already-observed" : null,
      collapseReduced ? null : "repeated-collapse-not-reduced",
    ].filter(Boolean),
    conclusion:
      status === "READY_FOR_SOURCE_GRANULARITY_FIX_LOOP"
        ? "Prompt and context packaging variants reduced repeated answer collapse, but did not improve answer-quality; the next bounded loop should target source granularity, answer-bearing span coverage, or expected-answer support selection."
        : "The compared public diagnostics do not yet isolate a clean no-score-lift context-policy ablation.",
    variants,
    bestByAnswerQuality: {
      label: bestByScore.label,
      challengerAnswerQuality: bestByScore.metrics.challengerAnswerQuality,
      challengerHitToCorrectRate: bestByScore.metrics.challengerHitToCorrectRate,
      repeatedWrongUseTotal: bestByScore.collapse.repeatedWrongUseTotal,
    },
    bestByCollapseReduction: {
      label: bestByCollapse.label,
      challengerAnswerQuality: bestByCollapse.metrics.challengerAnswerQuality,
      challengerHitToCorrectRate: bestByCollapse.metrics.challengerHitToCorrectRate,
      repeatedWrongUseTotal: bestByCollapse.collapse.repeatedWrongUseTotal,
      unknownCollapseUseCount: bestByCollapse.collapse.unknownCollapseUseCount,
      bareOneCollapseUseCount: bestByCollapse.collapse.bareOneCollapseUseCount,
    },
    nextActions:
      status === "READY_FOR_SOURCE_GRANULARITY_FIX_LOOP"
        ? [
            "Do not expand the benchmark or promote the challenger from prompt/context-policy changes alone.",
            "Add a bounded public-safe source-granularity or answer-bearing-span diagnostic for the same q150-q155 shard.",
            "Prioritize support selection: the challenger retrieves support but still fails answer-quality conversion.",
          ]
        : [
            "Compare same-shard diagnostics with answer-quality and retrieval-autopsy evidence before choosing the next layer.",
          ],
    countsAsAnswerQualityEvidence: true,
    countsAsFullMemorySotaEvidence: false,
    countsAsProductionRolloutEvidence: false,
  };
}

function loadVariant(spec) {
  const match = String(spec).match(/^([^=]+)=(.+)$/);
  assert.ok(match, `invalid variant spec: ${spec}; expected label=diagnostic.json`);
  const label = match[1].trim();
  const diagnosticPath = resolve(root, match[2].trim());
  const diagnostic = loadPublicJson(diagnosticPath, `${label} diagnostic`);
  assert.equal(diagnostic.mode, "answer-quality-context-synthesis-diagnostic", `${label} must be a context synthesis diagnostic`);
  const answerQualityPath = diagnostic.evidence?.answerQualityPath ? resolve(root, diagnostic.evidence.answerQualityPath) : null;
  const answerQuality = answerQualityPath && existsSync(answerQualityPath) ? loadPublicJson(answerQualityPath, `${label} answer-quality report`) : null;
  const policy = policySummary(answerQuality);
  const repeated = diagnostic.comparison?.repeatedWrongAnswerHashes ?? [];
  const repeatedWrongUseTotal = repeated.reduce((sum, item) => sum + Number(item.wrongUseCount ?? 0), 0);
  return {
    label,
    evidence: {
      diagnosticPath: relativeEvidencePath(diagnosticPath),
      diagnosticHash: `sha256:${fileHash(diagnosticPath)}`,
      answerQualityPath: answerQualityPath ? relativeEvidencePath(answerQualityPath) : null,
      answerQualityHash: answerQualityPath && existsSync(answerQualityPath) ? `sha256:${fileHash(answerQualityPath)}` : null,
      resultGateStatus: diagnostic.evidence?.resultGateStatus ?? null,
      resultGateBlockers: diagnostic.evidence?.resultGateBlockers ?? [],
    },
    policy,
    status: diagnostic.status,
    queryShard: {
      sameRawQuerySelectionAcrossMethods: diagnostic.queryShard?.sameRawQuerySelectionAcrossMethods === true,
      selectedQuestionIdsHash: diagnostic.queryShard?.selectedQuestionIdsHash ?? null,
    },
    metrics: {
      retrievalHitRateLift: diagnostic.comparison?.retrievalHitRateLift ?? null,
      answerQualityDelta: diagnostic.comparison?.answerQualityDelta ?? null,
      baselineAnswerQuality: diagnostic.comparison?.baseline?.answerQuality ?? null,
      challengerAnswerQuality: diagnostic.comparison?.challenger?.answerQuality ?? null,
      baselineHitToCorrectRate: diagnostic.comparison?.conversion?.baselineHitToCorrectRate ?? null,
      challengerHitToCorrectRate: diagnostic.comparison?.conversion?.challengerHitToCorrectRate ?? null,
      challengerOnlyHitConvertedCount: diagnostic.comparison?.conversion?.challengerOnlyHitConvertedCount ?? null,
      challengerOnlyHitCount: diagnostic.comparison?.conversion?.challengerOnlyHitCount ?? null,
    },
    collapse: {
      repeatedWrongHashCount: repeated.length,
      repeatedWrongUseTotal,
      unknownCollapseUseCount: collapseUseCount(repeated, unknownAnswerHash),
      bareOneCollapseUseCount: collapseUseCount(repeated, bareOneAnswerHash),
    },
    failureClasses: diagnostic.failureClasses ?? {},
  };
}

function policySummary(report) {
  return {
    answerPromptPolicy: report?.answerPromptPolicy ?? report?.answerQualityReports?.[0]?.answerPromptPolicy ?? null,
    contextPackagingPolicy: report?.contextPackagingPolicy ?? report?.answerQualityReports?.[0]?.contextPackagingPolicy ?? "ranked-prefix-v1",
  };
}

function collapseUseCount(items, hash) {
  return Number(items.find((item) => item.candidateAnswerHash === hash)?.wrongUseCount ?? 0);
}

function renderMarkdown(value) {
  const lines = [
    "# Answer-Quality Context Policy Ablation",
    "",
    `- Status: ${value.status}`,
    `- Same raw query selection: ${value.queryShard.sameRawQuerySelectionAcrossVariants}`,
    `- Public benchmark claims allowed: ${value.publicBenchmarkClaimsAllowed}`,
    `- Best by answer quality: ${value.bestByAnswerQuality.label} (${value.bestByAnswerQuality.challengerAnswerQuality})`,
    `- Best by collapse reduction: ${value.bestByCollapseReduction.label} (repeated wrong uses=${value.bestByCollapseReduction.repeatedWrongUseTotal})`,
    "",
    "## Variants",
    "",
    ...value.variants.flatMap((variant) => [
      `- ${variant.label}: answerPrompt=${variant.policy.answerPromptPolicy}, contextPackaging=${variant.policy.contextPackagingPolicy}, challengerAQ=${variant.metrics.challengerAnswerQuality}, delta=${variant.metrics.answerQualityDelta}, hitToCorrect=${variant.metrics.challengerHitToCorrectRate}, repeatedWrongUses=${variant.collapse.repeatedWrongUseTotal}, unknownUses=${variant.collapse.unknownCollapseUseCount}, bareOneUses=${variant.collapse.bareOneCollapseUseCount}`,
    ]),
    "",
    "## Conclusion",
    "",
    value.conclusion,
    "",
    "## Next Actions",
    "",
    ...value.nextActions.map((item) => `- ${item}`),
  ];
  return lines.join("\n");
}

function loadPublicJson(path, label) {
  assert.ok(path && existsSync(path), `${label} missing: ${path}`);
  assert.ok(statSync(path).size > 0, `${label} empty: ${path}`);
  const text = readFileSync(path, "utf8");
  assertSafePublicText(text, label);
  return JSON.parse(text);
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
}

function assertSafePublicText(text, label) {
  assertNoPattern(text, secretPattern, `${label} contains a key-shaped secret`);
  assertNoPattern(text, privatePathPattern, `${label} contains a private local path`);
  assertNoPattern(text, privateTagPattern, `${label} contains private tags`);
  assertNoPattern(text, /\b(q|answer|content|memory|text|raw|prompt)"\s*:/, `${label} contains raw text-like fields`);
}

function assertNoPattern(text, pattern, message) {
  pattern.lastIndex = 0;
  if (pattern.test(String(text))) throw new Error(message);
}

function relativeEvidencePath(path) {
  const resolved = resolve(path);
  assert.ok(resolved.startsWith(root), `evidence path must be inside repository: ${path}`);
  return resolved.slice(root.length).replace(/^\/+/, "");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      if (parsed[key] == null) parsed[key] = next;
      else if (Array.isArray(parsed[key])) parsed[key].push(next);
      else parsed[key] = [parsed[key], next];
      index += 1;
    }
  }
  return parsed;
}

function coerceArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function fileHash(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function stableHash(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(text).digest("hex");
}
