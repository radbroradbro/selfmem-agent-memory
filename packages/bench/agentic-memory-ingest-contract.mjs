import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const format = String(args.format ?? "json").toLowerCase();
const reviewDir = String(args.reviewDir ?? process.env.RECALLWEAVE_REVIEW_DIR ?? "reviews/overnight-20260522");
const sourceLockPath = resolveInputPath(
  args.sourceLock ?? `${reviewDir}/agentic-memory-source-lock-live-20260529.json`,
);
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const strict = Boolean(args.strict);

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern =
  /(\/Users\/[^/\s"]+|\/Volumes\/[^/\s"]+|\/private\/[^/\s"]+|\/var\/folders\/[^/\s"]+|\/tmp\/[^/\s"]+|\/home\/[^/\s"]+|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*|memories\.jsonl|raw_events\.jsonl|lossless_context\.jsonl)/i;

const sourceLock = loadSourceLock(sourceLockPath);
const canonicalContract = buildCanonicalContract(sourceLock);
const contractHash = `sha256:${stableHash(canonicalJson(canonicalContract))}`;
const report = buildReport({ sourceLock, canonicalContract, contractHash });
const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "agentic memory ingest contract report");
assertSafePublicText(markdownText, "agentic memory ingest contract markdown");
if (strict) {
  assert.equal(report.ok, true, jsonText);
  assert.equal(report.publicSafe, true, jsonText);
  assert.equal(report.metricsOnly, true, jsonText);
  assert.equal(report.rawTrajectoryIncluded, false, jsonText);
  assert.equal(report.rawMemoryIncluded, false, jsonText);
  assert.equal(report.readyForSourceLockProof, true, jsonText);
  assert.match(report.contractHash, /^sha256:[a-f0-9]{64}$/);
}
if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);

function loadSourceLock(path) {
  if (!path || !existsSync(path)) return null;
  const text = readFileSync(path, "utf8");
  assertSafePublicText(text, "agentic source-lock input");
  return JSON.parse(text);
}

function buildCanonicalContract(sourceLock) {
  const live = sourceLock?.liveSourceSnapshot ?? {};
  return {
    schemaVersion: 1,
    id: "longmemeval-v2-to-recallweave-ingest-v1",
    benchmark: "longmemeval-v2",
    sourceRevisions: {
      repoCommit: live.repoCommit ?? null,
      datasetRevision: live.datasetRevision ?? null,
      repoContentsHash: live.repoContentsHash ?? null,
      datasetSiblingsHash: live.datasetSiblingsHash ?? null,
    },
    inputBoundary: {
      operatorPrivateRawRows: true,
      rawRowsInRepository: false,
      rawTrajectoryTextInPublicReport: false,
      rawImagesInPublicReport: false,
      publicArtifactsContain: ["counts", "hashes", "strategy names", "reason codes", "model ids"],
      privateArtifactsContain: ["raw trajectory rows", "raw observations", "raw actions", "answer labels", "candidate chunks"],
    },
    sessionization: {
      sessionUnit: "one benchmark trajectory becomes one RecallWeave session",
      sessionIdDerivation: "sha256(benchmark-id | dataset-revision | trajectory-id)",
      chunkIdDerivation: "sha256(session-id | event-index | event-kind | normalized-content-hash)",
      eventKinds: ["task_prompt", "observation", "action", "state_delta", "tool_result", "checkpoint", "final_answer"],
      chunkBoundaries: [
        "split on benchmark trajectory event boundaries first",
        "preserve observation/action adjacency as retrieval neighbors",
        "clip oversized observations into ordered private chunks",
        "store chunk hashes and token counts in public reports only",
      ],
    },
    topicMapping: {
      rootTopicPath: "Benchmarks / LongMemEval-V2 / {domain}",
      subtopicPath: "{ability-family} / {task-entity-fingerprint} / {temporal-state-phase}",
      multiTopicLinks: true,
      maxTopicLinksPerChunk: 4,
      salienceScale: "0.0-1.0",
      requiredReasonCodes: ["domain", "ability", "entity-page", "temporal-state", "user-task-intent"],
      lowConfidencePolicy: "link to benchmark/domain root and retain private vector chunk for later review",
    },
    wikiLayer: {
      publicWikiStoresRawText: false,
      publicWikiStores: ["topic title", "summary", "subtopic edges", "source fingerprints", "revision hashes"],
      editableByHuman: true,
      titleAmplificationDefault: "off-until-answer-quality-win",
      subtopicAmplificationDefault: "experimental-gated",
      summarySessionDefault: "experimental-gated",
    },
    vectorLayer: {
      vectorizesFullSessionChunks: true,
      vectorStoreVisibility: "operator-private",
      denseSearchDefault: "available-but-not-required-for-every-query",
      lexicalControl: "bm25-lite",
      hybridPolicy: [
        "start with lexical control and topic/wiki candidates",
        "use vector session chunks when lexical or topic recall lacks enough evidence",
        "rerank only within the configured candidate budget",
        "log provider, cache hit, candidate count, and fallback reason codes",
      ],
    },
    lifecycleAndCompaction: {
      preCompactCheckpointRequired: true,
      storeFullSessionBeforeSummary: true,
      condensedSummaryLinksToSessionHashes: true,
      lifecycleEvents: ["ingest-start", "chunked", "topic-linked", "vectorized", "wiki-updated", "retrieval-used", "pre-compact-checkpoint"],
      lcmCompressionDefault: "off-until-benchmark-positive",
    },
    benchmarkIsolation: {
      hostedSupermemorySearchDisabledForMethodology: true,
      hostedWriteBackDisabled: true,
      rawSourceRetentionPrivate: true,
      sameDataComparatorsRequired: true,
      answerAndJudgeModelsPinnedBySourceLock: true,
      countsAsScore: false,
    },
    validation: {
      requiredBeforeMaterialization: [
        "source-lock repo commit",
        "source-lock dataset revision",
        "leaderboard tier",
        "question id hash",
        "answer label hash",
        "scoring code hash",
        "leaderboard row hash",
        "reader model",
        "judge model",
      ],
      metricsToLog: ["coverage", "candidate counts", "context tokens", "latency", "fallback reason codes", "privacy failures"],
      failureModesToTrack: ["unlinked chunks", "overbroad topic links", "topic drift", "query expansion harm", "vector-only miss", "bm25-only miss"],
    },
  };
}

function buildReport({ sourceLock, canonicalContract, contractHash }) {
  const checks = [
    check("contract-id", canonicalContract.id === "longmemeval-v2-to-recallweave-ingest-v1"),
    check("raw-public-disabled", canonicalContract.inputBoundary.rawRowsInRepository === false),
    check("sessionization-present", canonicalContract.sessionization.eventKinds.length >= 6),
    check("topic-mapping-present", canonicalContract.topicMapping.multiTopicLinks === true),
    check("wiki-layer-present", canonicalContract.wikiLayer.editableByHuman === true),
    check("vector-layer-present", canonicalContract.vectorLayer.vectorizesFullSessionChunks === true),
    check("lifecycle-checkpoint-present", canonicalContract.lifecycleAndCompaction.preCompactCheckpointRequired === true),
    check("benchmark-isolation", canonicalContract.benchmarkIsolation.hostedSupermemorySearchDisabledForMethodology === true),
  ];
  const failedChecks = checks.filter((item) => !item.ok).map((item) => item.name);
  return {
    schemaVersion: 1,
    ok: failedChecks.length === 0,
    mode: "agentic-memory-ingest-contract",
    generatedAt: new Date().toISOString(),
    writesRealFiles: Boolean(outputPath || markdownOutputPath),
    metricsOnly: true,
    publicSafe: true,
    callsProviderApis: false,
    callsHostedSupermemory: false,
    sendsBenchmarkTextToProvider: false,
    rawTrajectoryIncluded: false,
    rawQuestionIdsIncluded: false,
    rawQuestionsIncluded: false,
    rawAnswersIncluded: false,
    rawMemoryIncluded: false,
    rawTranscriptIncluded: false,
    countsAsBenchmarkScore: false,
    publicBenchmarkClaimsAllowed: false,
    readyForSourceLockProof: failedChecks.length === 0,
    contractHash,
    sourceLock: sourceLock
      ? {
          mode: sourceLock.mode ?? null,
          targetId: sourceLock.target?.id ?? null,
          liveChecksRequested: sourceLock.liveChecksRequested === true,
          liveSourceSnapshotOk: sourceLock.liveSourceSnapshot?.ok === true,
          repoCommitHash: sourceLock.liveSourceSnapshot?.repoCommit ? `sha256:${stableHash(sourceLock.liveSourceSnapshot.repoCommit)}` : null,
          datasetRevisionHash: sourceLock.liveSourceSnapshot?.datasetRevision
            ? `sha256:${stableHash(sourceLock.liveSourceSnapshot.datasetRevision)}`
            : null,
        }
      : null,
    contract: canonicalContract,
    checks,
    failedChecks,
    sourceLockProof: {
      proofField: "trajectoryIngestContractHash",
      proofValue: contractHash,
      commandArg: `--ingest-contract-hash ${contractHash}`,
    },
    nextActions: [
      "Feed sourceLockProof.proofValue into benchmark:agentic-source-lock when regenerating the LongMemEval-V2 source-lock packet.",
      "Use this contract when materializing LongMemEval-V2 rows into private sessions and public wiki/topic evidence.",
      "Keep title, subtopic, and summary-session amplification gated until answer-quality shards prove a win.",
    ],
  };
}

function renderMarkdown(report) {
  return [
    "# Agentic Memory Ingest Contract",
    "",
    `- OK: ${report.ok}`,
    `- Contract hash: ${report.contractHash}`,
    `- Ready for source-lock proof: ${report.readyForSourceLockProof}`,
    `- Counts as benchmark score: ${report.countsAsBenchmarkScore}`,
    `- Public benchmark claims allowed: ${report.publicBenchmarkClaimsAllowed}`,
    `- Raw trajectory included: ${report.rawTrajectoryIncluded}`,
    "",
    "## Contract Shape",
    "",
    `- Session unit: ${report.contract.sessionization.sessionUnit}`,
    `- Topic root: ${report.contract.topicMapping.rootTopicPath}`,
    `- Subtopic path: ${report.contract.topicMapping.subtopicPath}`,
    `- Wiki raw text: ${report.contract.wikiLayer.publicWikiStoresRawText}`,
    `- Vector visibility: ${report.contract.vectorLayer.vectorStoreVisibility}`,
    `- Pre-compact checkpoint: ${report.contract.lifecycleAndCompaction.preCompactCheckpointRequired}`,
    "",
    "## Next Actions",
    "",
    ...report.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}

function check(name, ok) {
  return { name, ok: Boolean(ok) };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (!item.startsWith("--")) continue;
    const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function resolveInputPath(value) {
  return isAbsolute(String(value ?? "")) ? String(value) : resolve(root, String(value ?? ""));
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
}

function stableHash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value) {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortDeep(value[key])]));
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(String(text), secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(String(text), privatePathPattern, `${label} contains a private path`);
}
