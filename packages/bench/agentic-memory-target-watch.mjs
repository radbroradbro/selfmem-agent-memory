import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const format = String(args.format ?? "json").toLowerCase();
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const strict = Boolean(args.strict);
const live = Boolean(args.live);

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern =
  /(\/Users\/[^/\s"]+|\/Volumes\/[^/\s"]+|\/private\/[^/\s"]+|\/var\/folders\/[^/\s"]+|\/tmp\/[^/\s"]+|\/home\/[^/\s"]+|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*|memories\.jsonl|raw_events\.jsonl|lossless_context\.jsonl)/i;

const candidates = [
  {
    id: "longmemeval-v2",
    name: "LongMemEval-V2",
    priority: 1,
    status: "NEXT_SOURCE_LOCK_CANDIDATE",
    fit: "agent-work-memory",
    why: [
      "state-recall",
      "dynamic-state-tracking",
      "workflow-knowledge",
      "environment-gotchas",
      "premise-awareness",
    ],
    publicSources: [
      "https://github.com/xiaowu0162/LongMemEval-V2",
      "https://huggingface.co/datasets/xiaowu0162/longmemeval-v2",
      "https://xiaowu0162.github.io/longmemeval-v2/#leaderboard",
      "https://arxiv.org/abs/2605.12493",
    ],
    knownShape: {
      questionCount: 451,
      publicLeaderboardTiers: ["small", "medium"],
      largestHaystackTokens: "up-to-115M",
      domains: ["web", "enterprise"],
      runnerLanguage: "python",
      memoryModules: ["no_retrieval", "rag_query_to_slice", "rag_query_to_slice_notes", "agentrunbook_r", "codex", "agentrunbook_c"],
    },
    blockersBeforeRun: [
      "source-lock-repo-commit-and-data-revision",
      "pin-small-or-medium-tier",
      "hash-question-ids-labels-and-scoring-code",
      "map-trajectory-history-to-recallweave-ingest-contract",
      "pin-reader-answer-model-and-judge-model",
      "attach-comparable-leaderboard-row",
    ],
  },
  {
    id: "ama-bench",
    name: "AMA-Bench",
    priority: 2,
    status: "WATCH_TARGET",
    fit: "long-horizon-agent-trajectories",
    why: ["recall", "causal-inference", "state-updating", "state-abstraction"],
    publicSources: [
      "https://huggingface.co/datasets/AMA-bench/AMA-bench",
      "https://huggingface.co/spaces/AMA-bench/AMA-bench-Leaderboard",
      "https://github.com/AMA-Bench/AMA-Hub",
      "https://arxiv.org/abs/2602.22769",
    ],
    knownShape: {
      datasetFile: "test/open_end_qa_set.jsonl",
      evaluation: "llm-as-judge",
      trajectoryFields: ["action", "observation"],
      questionTypes: ["recall", "causal-inference", "state-updating", "state-abstraction"],
    },
    blockersBeforeRun: [
      "source-lock-github-and-dataset-revision",
      "pin-llm-as-judge-rule",
      "hash-open-ended-qa-labels",
      "attach-comparable-leaderboard-row",
    ],
  },
  {
    id: "agent-memory-benchmark",
    name: "Agent Memory Benchmark",
    priority: 3,
    status: "WATCH_TARGET",
    fit: "provider-memory-product-parity",
    why: ["agentic-tasks", "document-research-memory", "preferences-in-multi-step-decisions", "accuracy-speed-token-cost"],
    publicSources: [
      "https://github.com/vectorize-io/agent-memory-benchmark",
      "https://agentmemorybenchmark.ai/",
    ],
    knownShape: {
      harness: "ingest-retrieve-generate-judge",
      judgeFamily: "gemini",
      outputPathPattern: "outputs/{dataset}/{memory}/{mode}/{domain}.json",
      reportedDimensions: ["accuracy", "speed", "token-cost"],
    },
    blockersBeforeRun: [
      "source-lock-repo-commit",
      "select-dataset-domain-and-mode",
      "pin-gemini-generation-and-judge-models",
      "attach-reproducible-comparison-row",
    ],
  },
];

const liveChecks = live ? await Promise.all(candidates.flatMap((candidate) => candidate.publicSources.map((url) => checkUrl(candidate.id, url)))) : [];
const report = buildReport({ candidates, liveChecks });
const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "agentic memory target watch report");
assertSafePublicText(markdownText, "agentic memory target watch markdown");

if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (strict && !report.ok) process.exit(1);

function buildReport({ candidates, liveChecks }) {
  const sorted = [...candidates].sort((left, right) => left.priority - right.priority);
  const primary = sorted[0];
  const failedChecks = [];
  if (primary?.id !== "longmemeval-v2") failedChecks.push("primary-agentic-target-not-longmemeval-v2");
  if (sorted.length < 3) failedChecks.push("agentic-watch-targets-missing");
  for (const candidate of sorted) {
    if (!candidate.publicSources?.every(requiredHttpsUrl)) failedChecks.push(`${candidate.id}-source-url-invalid`);
    if (!candidate.blockersBeforeRun?.length) failedChecks.push(`${candidate.id}-blockers-missing`);
    if (!candidate.why?.length) failedChecks.push(`${candidate.id}-fit-reasons-missing`);
  }
  if (live) {
    for (const check of liveChecks) {
      if (!check.ok) failedChecks.push(`${check.candidateId}-live-source-unreachable`);
    }
  }
  return {
    schemaVersion: 1,
    ok: failedChecks.length === 0,
    mode: "agentic-memory-target-watch",
    generatedAt: new Date().toISOString(),
    writesRealFiles: Boolean(outputPath || markdownOutputPath),
    metricsOnly: true,
    publicSafe: true,
    liveChecksRequested: live,
    publicBenchmarkClaimsAllowed: false,
    countsAsBenchmarkScore: false,
    sourceLockReady: false,
    rawQuestionIdsIncluded: false,
    rawQuestionsIncluded: false,
    rawAnswersIncluded: false,
    rawMemoryIncluded: false,
    rawTranscriptIncluded: false,
    primaryCandidate: summarizeCandidate(primary),
    candidates: sorted.map(summarizeCandidate),
    liveChecks,
    failedChecks,
    nextActions: [
      "Source-lock LongMemEval-V2 repo commit, dataset revision, tier, scorer, labels, and leaderboard row before materialization.",
      "Add a LongMemEval-V2 materializer only after the source-lock report proves no raw data or private paths are committed.",
      "Keep AMA-Bench and Agent Memory Benchmark as second-wave targets until their scorer/model/split parity is pinned.",
    ],
    safety: {
      storesRawBenchmarkData: false,
      storesCredentials: false,
      sourceWatchOnly: true,
      publicClaimsRequireFutureScoreGate: true,
    },
  };
}

function summarizeCandidate(candidate) {
  return {
    id: candidate.id,
    name: candidate.name,
    priority: candidate.priority,
    status: candidate.status,
    fit: candidate.fit,
    why: candidate.why,
    publicSourceHosts: candidate.publicSources.map(urlHost),
    publicSourcesHash: `sha256:${stableHash(candidate.publicSources.join("\n"))}`,
    knownShape: candidate.knownShape,
    blockersBeforeRun: candidate.blockersBeforeRun,
  };
}

async function checkUrl(candidateId, url) {
  try {
    const response = await fetch(url, { method: "HEAD", redirect: "follow" });
    return {
      candidateId,
      host: urlHost(url),
      urlHash: `sha256:${stableHash(url)}`,
      ok: response.ok,
      status: response.status,
    };
  } catch (error) {
    return {
      candidateId,
      host: urlHost(url),
      urlHash: `sha256:${stableHash(url)}`,
      ok: false,
      status: null,
      error: String(error?.name ?? "fetch-error"),
    };
  }
}

function renderMarkdown(report) {
  return [
    "# Agentic Memory Target Watch",
    "",
    `- OK: ${report.ok}`,
    `- Primary candidate: ${report.primaryCandidate.name}`,
    `- Source-lock ready: ${report.sourceLockReady}`,
    `- Counts as benchmark score: ${report.countsAsBenchmarkScore}`,
    `- Public benchmark claims allowed: ${report.publicBenchmarkClaimsAllowed}`,
    `- Failed checks: ${report.failedChecks.length ? report.failedChecks.join(", ") : "none"}`,
    "",
    "## Candidates",
    "",
    ...report.candidates.map(
      (candidate) =>
        `- ${candidate.name}: ${candidate.status}; fit=${candidate.fit}; blockers=${candidate.blockersBeforeRun.length}`,
    ),
    "",
    "## Next Actions",
    "",
    ...report.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
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

function requiredHttpsUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    return url.protocol === "https:" && Boolean(url.host);
  } catch {
    return false;
  }
}

function urlHost(value) {
  try {
    return new URL(String(value ?? "")).host;
  } catch {
    return "";
  }
}

function stableHash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(String(text), secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(String(text), privatePathPattern, `${label} contains a private path`);
}
