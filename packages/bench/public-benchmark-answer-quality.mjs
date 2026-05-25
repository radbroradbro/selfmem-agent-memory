import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const fixtureRequested = Boolean(args.fixture) || !args.live;
const targetPath = resolveInputPath(args.target ?? "reviews/overnight-20260522/public-longmemeval-expanded-run-target.json");
const querySetPath = resolveInputPath(args.queryset ?? args.querySet ?? process.env.RECALLWEAVE_BASELINE_QUERYSET ?? null);
const memoriesPath = resolveInputPath(args.memories ?? args.memoriesJsonl ?? process.env.RECALLWEAVE_BASELINE_MEMORIES_JSONL ?? null);
const answerLabelsPath = resolveInputPath(args.answerLabels ?? process.env.RECALLWEAVE_MEMORYBENCH_ANSWER_LABELS ?? null);
const outputPath = args.output ? resolve(root, args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolve(root, args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();
const requireLiveReady = Boolean(args.requireReady);
const maxQueries = optionalPositiveInt(args.maxQueries ?? process.env.RECALLWEAVE_MEMORYBENCH_MAX_QUERIES ?? null, "max queries");
const maxContextChars = optionalPositiveInt(args.maxContextChars ?? process.env.RECALLWEAVE_MEMORYBENCH_MAX_CONTEXT_CHARS ?? 12000, "max context chars");
const answerModel = String(args.answerModel ?? process.env.RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL ?? process.env.RECALLWEAVE_BASELINE_ANSWER_MODEL ?? "").trim();
const judgeModel = String(args.judgeModel ?? process.env.RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL ?? process.env.RECALLWEAVE_BASELINE_JUDGE_MODEL ?? "").trim();
const baseUrl = String(args.baseUrl ?? process.env.RECALLWEAVE_MEMORYBENCH_BASE_URL ?? "").trim();
const apiKey = String(args.apiKey ?? process.env.RECALLWEAVE_MEMORYBENCH_API_KEY ?? "").trim();
const allowAnswerQualityCalls = process.env.RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS === "1";
const publicDataConfirmed = process.env.RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA === "1";
const noRawTextOutput = process.env.RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT === "1";

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(targetPath && existsSync(targetPath), `target missing: ${displayPath(targetPath)}`);
assert.ok(statSync(targetPath).size > 0, `target empty: ${displayPath(targetPath)}`);

const targetRaw = readFileSync(targetPath, "utf8");
assertSafePublicText(targetRaw, "target");
const target = JSON.parse(targetRaw);
const run = fixtureRequested ? fixtureRun() : await liveRun();
const jsonText = `${JSON.stringify(run, null, 2)}\n`;
const markdownText = `${renderMarkdown(run)}\n`;
assertSafePublicText(jsonText, "answer quality report");
assertSafePublicText(markdownText, "answer quality markdown");

if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (requireLiveReady && !run.readyForEndToEndMemoryScoreGate) process.exit(1);

function fixtureRun() {
  const fixture = fixtureInputs();
  const arms = fixture.armSpecs.map((arm) =>
    scoreArm({
      strategy: arm.strategy,
      responses: arm.responses,
      queries: fixture.queries,
      memories: fixture.memories,
      labelsByQueryId: fixture.labelsByQueryId,
      fixture: true,
    }),
  );
  return buildReport({
    fixtureOnly: true,
    inputSource: "fixture-answer-quality-smoke",
    querySet: fixture.querySet,
    querySetHash: `sha256:${stableHash(collectorQuerySetHashPayload(fixture.querySet))}`,
    memoriesHash: `sha256:${stableHash(fixture.memories.map((item) => JSON.stringify(item)).join("\n"))}`,
    answerLabelsHash: fixture.answerLabelsHash,
    materializerHash: null,
    arms,
    provider: {
      answerModel: "fixture-answer-model",
      judgeModel: "fixture-judge-model",
      answerQualityCallsAllowed: false,
      publicDataConfirmed: false,
      callsMade: 0,
      endpointLabel: null,
    },
  });
}

async function liveRun() {
  assert.equal(Boolean(args.live), true, "live answer-quality scoring requires --live");
  assert.equal(allowAnswerQualityCalls, true, "set RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS=1 before live answer-quality scoring");
  assert.equal(publicDataConfirmed, true, "set RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA=1 before sending benchmark text to a model endpoint");
  assert.equal(noRawTextOutput, true, "set RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT=1 before live answer-quality scoring");
  assert.ok(answerModel, "answer model is required via --answer-model or RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL");
  assert.ok(judgeModel, "judge model is required via --judge-model or RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL");
  assert.ok(baseUrl, "OpenAI-compatible base URL is required via --base-url or RECALLWEAVE_MEMORYBENCH_BASE_URL");
  if (!isLocalUrl(baseUrl)) assert.ok(apiKey, "cloud answer-quality endpoints require RECALLWEAVE_MEMORYBENCH_API_KEY");
  assertPrivateFile(querySetPath, "private query set");
  assertPrivateFile(memoriesPath, "private memories");
  assertPrivateFile(answerLabelsPath, "private answer labels");

  const querySet = loadJson(querySetPath, "private query set");
  const answerLabels = loadJson(answerLabelsPath, "private answer labels");
  const memories = loadMemories(memoriesPath);
  const armSpecs = liveArmSpecs();
  const labelsByQueryId = labelsByQuery(answerLabels);
  const expectedAnswerLabelsHash = target.benchmark?.answerLabelsHash ?? null;
  assert.equal(answerLabels.answerLabelsHash, expectedAnswerLabelsHash, "private answer-label hash must match target");
  assert.equal(answerLabels.scoringCodeHash, target.benchmark?.scoringCodeHash, "private scoring-code hash must match target");
  assert.equal(querySet.authoring?.answerLabelsHash, expectedAnswerLabelsHash, "query-set answer-label hash must match target");
  assert.equal(querySet.authoring?.scoringCodeHash, target.benchmark?.scoringCodeHash, "query-set scoring-code hash must match target");

  let providerCalls = 0;
  const arms = [];
  for (const arm of armSpecs) {
    const responsesEnvelope = loadJson(arm.responsesPath, `${arm.strategy} responses`);
    assert.equal(responsesEnvelope.querySetHash, `sha256:${stableHash(collectorQuerySetHashPayload(querySet))}`, `${arm.strategy} responses must match query-set hash`);
    const scoredArm = await scoreArmAsync({
      strategy: arm.strategy,
      responses: responsesEnvelope.responses ?? {},
      queries: querySet.queries,
      memories,
      labelsByQueryId,
    });
    providerCalls += scoredArm.provider.answerCalls + scoredArm.provider.judgeCalls;
    arms.push(scoredArm);
  }

  return buildReport({
    fixtureOnly: false,
    inputSource: "materialized-source-locked-longmemeval",
    querySet,
    querySetHash: `sha256:${stableHash(collectorQuerySetHashPayload(querySet))}`,
    memoriesHash: `sha256:${fileHash(memoriesPath)}`,
    answerLabelsHash: answerLabels.answerLabelsHash,
    materializerHash: querySet.authoring?.materializerHash ?? null,
    arms,
    provider: {
      answerModel,
      judgeModel,
      answerQualityCallsAllowed: true,
      publicDataConfirmed: true,
      callsMade: providerCalls,
      endpointLabel: endpointLabel(baseUrl),
    },
  });
}

function liveArmSpecs() {
  const rawSpecs = coerceArray(args.arm ?? args.arms);
  if (rawSpecs.length === 0 && args.responses) {
    rawSpecs.push(`${String(args.strategy ?? "recallweave-answer-quality")}:${args.responses}`);
  }
  assert.ok(rawSpecs.length > 0, "pass at least one --arm strategy=/private/responses.json");
  return rawSpecs.flatMap((item) =>
    String(item)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const match = part.match(/^([^:=]+)[:=](.+)$/);
        assert.ok(match, `invalid arm spec: ${part}; expected strategy=/private/responses.json`);
        const responsesPath = resolveInputPath(match[2]);
        assertPrivateFile(responsesPath, `${match[1]} responses`);
        return { strategy: match[1], responsesPath };
      }),
  );
}

function scoreArm({ strategy, responses, queries, memories, labelsByQueryId, fixture }) {
  const memoryIndex = memoryLookup(memories);
  const selectedQueries = maxQueries ? queries.slice(0, maxQueries) : queries;
  const scored = selectedQueries.map((query) => {
    const response = responses[query.id] ?? emptyResponse();
    const contextItems = contextFor(response, memoryIndex);
    const expected = labelsByQueryId.get(query.id);
    assert.ok(expected, `missing answer label for query ${query.id}`);
    const candidateAnswer = fixtureAnswer(query, expected, contextItems);
    const judge = fixtureJudge(candidateAnswer, expected.answer);
    return scoreFingerprint({ query, response, contextItems, candidateAnswer, judge, elapsedMs: Number(response.timing ?? 1) });
  });
  return summarizeArm({ strategy, scored, provider: { answerCalls: 0, judgeCalls: 0, fixtureJudge: true } });
}

async function scoreArmAsync({ strategy, responses, queries, memories, labelsByQueryId }) {
  const memoryIndex = memoryLookup(memories);
  const selectedQueries = maxQueries ? queries.slice(0, maxQueries) : queries;
  const scored = [];
  let answerCalls = 0;
  let judgeCalls = 0;
  for (const query of selectedQueries) {
    const response = responses[query.id] ?? emptyResponse();
    const contextItems = contextFor(response, memoryIndex);
    const expected = labelsByQueryId.get(query.id);
    assert.ok(expected, `missing answer label for query ${query.id}`);
    const started = performance.now();
    const candidateAnswer = await callAnswerModel({ query, contextItems });
    answerCalls += 1;
    const judge = await callJudgeModel({ query, expectedAnswer: expected.answer, candidateAnswer });
    judgeCalls += 1;
    scored.push(scoreFingerprint({ query, response, contextItems, candidateAnswer, judge, elapsedMs: Math.round(performance.now() - started) }));
  }
  return summarizeArm({ strategy, scored, provider: { answerCalls, judgeCalls, fixtureJudge: false } });
}

function buildReport({ fixtureOnly, inputSource, querySet, querySetHash, memoriesHash, answerLabelsHash, materializerHash, arms, provider }) {
  const bestArm = bestByAnswerQuality(arms);
  const report = {
    schemaVersion: 1,
    ok: true,
    mode: "public-benchmark-answer-quality",
    fixtureOnly,
    benchmark: target.benchmark?.family ?? target.benchmark?.name ?? "longmemeval",
    metricsOnly: true,
    publicSafe: true,
    retrievalProxyOnly: false,
    memoryBenchAnswerQuality: true,
    readyForEndToEndMemoryScoreGate: !fixtureOnly && provider.callsMade > 0,
    publicBenchmarkClaimsAllowed: false,
    callsProviderApis: !fixtureOnly,
    sendsBenchmarkTextToProvider: !fixtureOnly,
    rawQuestionIdsIncluded: false,
    rawQuestionsIncluded: false,
    rawAnswersIncluded: false,
    rawMemoryIncluded: false,
    rawTranscriptIncluded: false,
    rawPromptIncluded: false,
    generatedAt: new Date().toISOString(),
    target: {
      hash: `sha256:${stableHash(targetRaw)}`,
      benchmark: target.benchmark?.family ?? target.benchmark?.name ?? null,
      claimTier: target.claimTier ?? null,
      answerLabelsHash: target.benchmark?.answerLabelsHash ?? null,
      scoringCodeHash: target.benchmark?.scoringCodeHash ?? null,
      judgeModel: target.benchmark?.judgeModel ?? null,
      answerModel: target.benchmark?.answerModel ?? null,
    },
    input: {
      source: inputSource,
      targetHash: `sha256:${stableHash(targetRaw)}`,
      querySetHash,
      materializerHash,
      memoriesHash,
      answerLabelsHash,
      scoringCodeHash: target.benchmark?.scoringCodeHash ?? null,
      datasetSlice: querySet.datasetSlice ?? null,
      queryCount: Number(querySet.queries?.length ?? 0),
      scoredQueryCount: arms[0]?.scoredQueryCount ?? 0,
    },
    provider,
    metrics: bestArm?.metrics ?? null,
    strategies: arms,
    winner: bestArm
      ? {
          strategy: bestArm.strategy,
          answerQuality: bestArm.metrics.answerQuality,
          judgeCorrectRate: bestArm.metrics.judgeCorrectRate,
          answerLatencyP50Ms: bestArm.metrics.answerLatencyP50Ms,
        }
      : null,
    reviewerApprovalCount: Number(process.env.RECALLWEAVE_REVIEWER_APPROVAL_COUNT ?? 0),
    privacyLeakCount: 0,
    redactionFailureCount: 0,
    safety: {
      metricsOnly: true,
      publicSafe: true,
      rawQuestionsIncluded: false,
      rawAnswersIncluded: false,
      rawMemoryIncluded: false,
      rawTranscriptIncluded: false,
      privateInputsStoredOutsideRepository: true,
    },
    nextActions: fixtureOnly
      ? [
          "Run this harness with --live against private materialized LongMemEval inputs and explicit model-call consent.",
          "Attach the metrics-only answer-quality result to benchmark:memory-score:result-gate.",
        ]
      : [
          "Run benchmark:memory-score:result-gate with this result.",
          "Send the exact metrics-only packet to independent reviewers before public benchmark wording changes.",
        ],
  };
  return report;
}

function summarizeArm({ strategy, scored, provider }) {
  const scores = scored.map((item) => item.score);
  const latencies = scored.map((item) => item.elapsedMs).filter(Number.isFinite).sort((a, b) => a - b);
  return {
    strategy,
    metrics: {
      answerQuality: round(average(scores)),
      memoryScore: round(average(scores)),
      longmemevalScore: round(average(scores)),
      quality: round(average(scores) / 100),
      judgeCorrectRate: round(average(scored.map((item) => (item.correct ? 1 : 0)))),
      answerLatencyP50Ms: percentile(latencies, 0.5),
      answerLatencyP95Ms: percentile(latencies, 0.95),
      contextTokensAvg: Math.round(average(scored.map((item) => item.contextTokens))),
    },
    provider,
    privacyLeakCount: 0,
    redactionFailureCount: 0,
    scoredQueryCount: scored.length,
    resultFingerprints: scored.map((item) => item.fingerprint),
  };
}

function scoreFingerprint({ query, response, contextItems, candidateAnswer, judge, elapsedMs }) {
  const score = Math.max(0, Math.min(100, Number(judge.score ?? 0)));
  return {
    score,
    correct: Boolean(judge.correct ?? score >= 50),
    elapsedMs,
    contextTokens: estimateTokens(contextItems.map((item) => item.content).join("\n")),
    fingerprint: {
      queryIdHash: shortHash(query.id),
      queryHash: shortHash(query.q),
      candidateAnswerHash: `sha256:${stableHash(normalizeText(candidateAnswer))}`,
      judgeDecisionHash: `sha256:${stableHash(canonicalJson(judge))}`,
      contextResultCount: contextItems.length,
      responseTotal: Number(response.total ?? contextItems.length),
      score: round(score),
      correct: Boolean(judge.correct ?? score >= 50),
    },
  };
}

async function callAnswerModel({ query, contextItems }) {
  const context = boundedContext(contextItems);
  const prompt = [
    "Answer the memory benchmark question using only the provided context.",
    "If the answer is not supported, say \"unknown\".",
    "",
    `Question: ${query.q}`,
    "",
    "Context:",
    context,
  ].join("\n");
  assertNoUnsafePrompt(prompt, "answer prompt");
  return callOpenAiCompatible({ model: answerModel, prompt, system: "Return only the answer text. Be concise." });
}

async function callJudgeModel({ query, expectedAnswer, candidateAnswer }) {
  const prompt = [
    "Score whether the candidate answer matches the gold answer for this memory benchmark question.",
    "Return JSON only with keys: score (0-100), correct (boolean), rationale (short string).",
    "",
    `Question: ${query.q}`,
    `Gold answer: ${expectedAnswer}`,
    `Candidate answer: ${candidateAnswer}`,
  ].join("\n");
  assertNoUnsafePrompt(prompt, "judge prompt");
  const text = await callOpenAiCompatible({
    model: judgeModel,
    prompt,
    system: "You are a strict memory benchmark judge. Return only one JSON object.",
    jsonMode: true,
  });
  return normalizeJudge(text);
}

async function callOpenAiCompatible({ model, system, prompt, jsonMode = false }) {
  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    temperature: 0,
    stream: false,
  };
  if (jsonMode) body.response_format = { type: "json_object" };
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const response = await fetch(chatCompletionsUrl(baseUrl), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  assertNoUnsafePrompt(raw, "model response");
  assert.ok(response.ok, `answer-quality model endpoint failed with HTTP ${response.status}: ${safeError(raw)}`);
  const json = JSON.parse(raw);
  const content = String(json.choices?.[0]?.message?.content ?? "").trim();
  assert.ok(content, "model endpoint returned empty content");
  assertNoUnsafePrompt(content, "model content");
  return content;
}

function normalizeJudge(text) {
  try {
    const json = JSON.parse(text);
    return {
      score: Math.max(0, Math.min(100, Number(json.score ?? 0))),
      correct: Boolean(json.correct ?? Number(json.score ?? 0) >= 50),
      rationaleHash: shortHash(String(json.rationale ?? "")),
    };
  } catch {
    const match = String(text).match(/(?:score|rating)\D+(\d+(?:\.\d+)?)/i);
    const score = match ? Number(match[1]) : 0;
    return { score: Math.max(0, Math.min(100, score)), correct: score >= 50, rationaleHash: shortHash(text) };
  }
}

function fixtureInputs() {
  const queries = [
    { id: "fixture-q-policy", q: "What is the write policy?", expectedResultIds: ["fixture-session-policy"], expectedResultHashes: [] },
    { id: "fixture-q-state", q: "When does launch remain blocked?", expectedResultIds: ["fixture-session-launch"], expectedResultHashes: [] },
  ];
  const memories = [
    { id: "fixture-session-policy", content: "RecallWeave writes stay local by default and hosted write-back remains off." },
    { id: "fixture-session-launch", content: "Public launch remains blocked until owner approval and real production canary evidence exist." },
  ];
  const labels = [
    { queryId: "fixture-q-policy", questionId: "fixture-question-policy", questionType: "single-session-preference", answer: "Writes stay local by default." },
    { queryId: "fixture-q-state", questionId: "fixture-question-launch", questionType: "multi-session", answer: "Launch remains blocked until owner approval and production canary evidence." },
  ];
  const responses = Object.fromEntries(
    queries.map((query) => [
      query.id,
      {
        timing: 3,
        total: 1,
        results: [
          {
            id: query.expectedResultIds[0],
            contentHash: `sha256:${stableHash(normalizeText(memories.find((item) => item.id === query.expectedResultIds[0])?.content ?? ""))}`,
            score: 1,
            estimatedTokens: 24,
            source: "fixture",
          },
        ],
      },
    ]),
  );
  const answerLabelsHash = `sha256:${stableHash(canonicalJson(labels.map((item) => ({
    questionId: item.questionId,
    questionType: item.questionType,
    answer: item.answer,
  }))))}`;
  return {
    querySet: {
      schemaVersion: 1,
      fixtureOnly: true,
      datasetSlice: "fixture-answer-quality",
      queries,
    },
    queries,
    memories,
    labelsByQueryId: labelsByQuery({ labels }),
    answerLabelsHash,
    armSpecs: [
      { strategy: "bm25-lite", responses },
      { strategy: "full-hybrid-rerank", responses },
      { strategy: "query-expanded-full-hybrid-rerank", responses },
    ],
  };
}

function fixtureAnswer(query, expected, contextItems) {
  const context = contextItems.map((item) => normalizeText(item.content)).join(" ");
  return context ? expected.answer : "unknown";
}

function fixtureJudge(candidateAnswer, expectedAnswer) {
  const candidate = normalizeText(candidateAnswer);
  const expected = normalizeText(expectedAnswer);
  const correct = candidate.includes(expected.split(" ").slice(0, 3).join(" ")) || expected.includes(candidate.split(" ").slice(0, 3).join(" "));
  return { score: correct ? 100 : 0, correct, rationaleHash: shortHash(`${candidate}:${expected}`) };
}

function contextFor(response, index) {
  return (response.results ?? [])
    .map((result) => index.byId.get(String(result.id ?? "")) ?? index.byHash.get(String(result.contentHash ?? "")))
    .filter(Boolean);
}

function boundedContext(items) {
  let remaining = maxContextChars;
  const chunks = [];
  for (const [index, item] of items.entries()) {
    if (remaining <= 0) break;
    const text = item.content.slice(0, remaining);
    chunks.push(`[${index + 1}] ${text}`);
    remaining -= text.length;
  }
  return chunks.join("\n\n") || "No retrieved context.";
}

function memoryLookup(memories) {
  const byId = new Map();
  const byHash = new Map();
  for (const memory of memories) {
    byId.set(String(memory.id), memory);
    byHash.set(`sha256:${stableHash(normalizeText(memory.content))}`, memory);
  }
  return { byId, byHash };
}

function loadMemories(path) {
  const text = readFileSync(path, "utf8");
  assert.doesNotMatch(text, secretPattern, `${displayPath(path)} contains a key-shaped secret`);
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => {
      const json = JSON.parse(line);
      const content = extractMemoryText(json);
      assert.ok(content.trim(), `memory line ${index + 1} has no content`);
      return {
        id: String(json.id ?? json.memory_id ?? json.memoryId ?? `line-${index + 1}`),
        content: redactPrivateTags(content),
      };
    });
}

function extractMemoryText(item) {
  for (const key of ["content", "memory", "text", "summary", "value", "distilled", "replacementText"]) {
    if (typeof item?.[key] === "string") return item[key];
  }
  for (const key of ["content", "memory", "text", "summary"]) {
    if (typeof item?.metadata?.[key] === "string") return item.metadata[key];
  }
  return "";
}

function labelsByQuery(answerLabels) {
  const labels = new Map();
  for (const item of answerLabels.labels ?? []) {
    assert.ok(item.queryId, "answer label needs queryId");
    assert.ok(item.answer, `answer label ${item.queryId} needs answer`);
    labels.set(String(item.queryId), {
      questionId: String(item.questionId ?? ""),
      questionType: String(item.questionType ?? ""),
      answer: String(item.answer),
    });
  }
  return labels;
}

function renderMarkdown(value) {
  return [
    "# Public Benchmark Answer Quality",
    "",
    `- Fixture only: ${value.fixtureOnly}`,
    `- Ready for end-to-end memory score gate: ${value.readyForEndToEndMemoryScoreGate}`,
    `- Public benchmark claims allowed: ${value.publicBenchmarkClaimsAllowed}`,
    `- Benchmark: ${value.benchmark}`,
    `- Query count: ${value.input.queryCount}`,
    `- Scored query count: ${value.input.scoredQueryCount}`,
    `- Answer-label hash: ${value.input.answerLabelsHash}`,
    "",
    "## Arms",
    ...value.strategies.map(
      (arm) =>
        `- ${arm.strategy}: answerQuality=${arm.metrics.answerQuality}, correctRate=${arm.metrics.judgeCorrectRate}, p50=${arm.metrics.answerLatencyP50Ms}ms`,
    ),
    "",
    "## Safety",
    `- Metrics only: ${value.metricsOnly}`,
    `- Raw questions included: ${value.rawQuestionsIncluded}`,
    `- Raw answers included: ${value.rawAnswersIncluded}`,
    `- Raw memory included: ${value.rawMemoryIncluded}`,
    `- Raw transcript included: ${value.rawTranscriptIncluded}`,
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}

function bestByAnswerQuality(arms) {
  return [...arms].sort(
    (left, right) =>
      Number(right.metrics.answerQuality) - Number(left.metrics.answerQuality) ||
      Number(left.metrics.answerLatencyP50Ms) - Number(right.metrics.answerLatencyP50Ms),
  )[0];
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
  assert.ok(existsSync(path), `${label} missing: ${displayPath(path)}`);
  assert.ok(statSync(path).size > 0, `${label} empty: ${displayPath(path)}`);
  assertOutsideRepo(path, label);
}

function assertOutsideRepo(path, label) {
  const rel = relative(root, resolve(path));
  assert.ok(rel.startsWith("..") || isAbsolute(rel), `${label} must stay outside the repository`);
}

function loadJson(path, label) {
  const text = readFileSync(path, "utf8");
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  return JSON.parse(text);
}

function emptyResponse() {
  return { timing: 0, total: 0, results: [] };
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

function assertNoUnsafePrompt(text, label) {
  assert.doesNotMatch(String(text), secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(String(text), privateTagPattern, `${label} contains private tags`);
}

function safeError(text) {
  return String(text).replace(secretPattern, "[redacted-key]").slice(0, 300);
}

function chatCompletionsUrl(value) {
  const clean = String(value).replace(/\/+$/, "");
  if (clean.endsWith("/chat/completions")) return clean;
  if (clean.endsWith("/v1")) return `${clean}/chat/completions`;
  return `${clean}/v1/chat/completions`;
}

function endpointLabel(value) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "configured-openai-compatible-endpoint";
  }
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

function resolveInputPath(value) {
  if (!value) return null;
  return isAbsolute(String(value)) ? String(value) : resolve(root, String(value));
}

function displayPath(value) {
  if (!value) return "missing";
  const rel = relative(root, value).replaceAll("\\", "/");
  return rel.startsWith("..") ? basename(value) : rel;
}

function fileHash(path) {
  return stableHash(readFileSync(path, "utf8"));
}

function stableHash(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(text).digest("hex");
}

function shortHash(value) {
  return stableHash(String(value)).slice(0, 16);
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

function normalizeText(text) {
  return String(text).toLowerCase().replace(/\s+/g, " ").trim();
}

function redactPrivateTags(text) {
  return String(text).replace(privateTagPattern, " ").replace(/\s+/g, " ").trim();
}

function estimateTokens(text) {
  return Math.ceil(String(text).length / 4);
}

function average(values) {
  const valid = values.map(Number).filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function percentile(values, percentileValue) {
  if (!values.length) return 0;
  const index = Math.min(values.length - 1, Math.ceil(values.length * percentileValue) - 1);
  return Math.round(values[index]);
}

function round(value) {
  return Number(Number(value).toFixed(4));
}

function optionalPositiveInt(value, label) {
  if (value == null || value === "") return null;
  const number = Number(value);
  assert.ok(Number.isInteger(number) && number > 0, `${label} must be a positive integer`);
  return number;
}
