import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
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
const sha256Pattern = /^sha256:[a-f0-9]{64}$/i;
const commitPattern = /^[a-f0-9]{40}$/i;

const contract = {
  id: "longmemeval-v2",
  name: "LongMemEval-V2",
  sourceUrls: {
    repository: "https://github.com/xiaowu0162/LongMemEval-V2",
    dataset: "https://huggingface.co/datasets/xiaowu0162/longmemeval-v2",
    leaderboard: "https://xiaowu0162.github.io/longmemeval-v2/#leaderboard",
    paper: "https://arxiv.org/abs/2605.12493",
  },
  expectedPublicShape: {
    questionCount: 451,
    publicLeaderboardTiers: ["small", "medium"],
    largestHaystackTokens: "up-to-115M",
    domains: ["web", "enterprise"],
    abilityFamilies: [
      "state-recall",
      "dynamic-state-tracking",
      "workflow-knowledge",
      "environment-gotchas",
      "premise-awareness",
    ],
    memoryModules: [
      "no_retrieval",
      "rag_query_to_slice",
      "rag_query_to_slice_notes",
      "agentrunbook_r",
      "codex",
      "agentrunbook_c",
    ],
  },
  requiredProofFields: [
    {
      field: "repoCommit",
      source: "RECALLWEAVE_LONGMEMEVAL_V2_REPO_COMMIT or --repo-commit",
      kind: "git-commit",
      reason: "Pin the exact benchmark harness revision before comparing scores.",
    },
    {
      field: "datasetRevision",
      source: "RECALLWEAVE_LONGMEMEVAL_V2_DATASET_REVISION or --dataset-revision",
      kind: "revision-id",
      reason: "Pin the public dataset snapshot without committing raw rows.",
    },
    {
      field: "leaderboardTier",
      source: "RECALLWEAVE_LONGMEMEVAL_V2_TIER or --tier",
      kind: "enum:small|medium",
      reason: "Keep comparison rows on the same cost/scale tier.",
    },
    {
      field: "questionIdsHash",
      source: "RECALLWEAVE_LONGMEMEVAL_V2_QUESTION_IDS_HASH or --question-ids-hash",
      kind: "sha256",
      reason: "Prove the evaluated question set while hiding raw ids.",
    },
    {
      field: "answerLabelsHash",
      source: "RECALLWEAVE_LONGMEMEVAL_V2_ANSWER_LABELS_HASH or --answer-labels-hash",
      kind: "sha256",
      reason: "Bind scoring to the exact labels without committing labels.",
    },
    {
      field: "scoringCodeHash",
      source: "RECALLWEAVE_LONGMEMEVAL_V2_SCORING_CODE_HASH or --scoring-code-hash",
      kind: "sha256",
      reason: "Make score changes reviewable when the scorer changes.",
    },
    {
      field: "leaderboardRowHash",
      source: "RECALLWEAVE_LONGMEMEVAL_V2_LEADERBOARD_ROW_HASH or --leaderboard-row-hash",
      kind: "sha256",
      reason: "Attach a comparable public row without copying leaderboard text.",
    },
    {
      field: "trajectoryIngestContractHash",
      source: "RECALLWEAVE_LONGMEMEVAL_V2_INGEST_CONTRACT_HASH or --ingest-contract-hash",
      kind: "sha256",
      reason: "Pin how agent trajectories become RecallWeave sessions/wiki topics.",
    },
    {
      field: "readerModel",
      source: "RECALLWEAVE_LONGMEMEVAL_V2_READER_MODEL or --reader-model",
      kind: "model-id",
      reason: "Record the model that answers from retrieved memory.",
    },
    {
      field: "judgeModel",
      source: "RECALLWEAVE_LONGMEMEVAL_V2_JUDGE_MODEL or --judge-model",
      kind: "model-id",
      reason: "Record the model that grades output so judge strength is not hidden.",
    },
  ],
};

const supplied = {
  repoCommit: stringArg("repoCommit", "RECALLWEAVE_LONGMEMEVAL_V2_REPO_COMMIT"),
  datasetRevision: stringArg("datasetRevision", "RECALLWEAVE_LONGMEMEVAL_V2_DATASET_REVISION"),
  leaderboardTier: stringArg("tier", "RECALLWEAVE_LONGMEMEVAL_V2_TIER"),
  questionIdsHash: stringArg("questionIdsHash", "RECALLWEAVE_LONGMEMEVAL_V2_QUESTION_IDS_HASH"),
  answerLabelsHash: stringArg("answerLabelsHash", "RECALLWEAVE_LONGMEMEVAL_V2_ANSWER_LABELS_HASH"),
  scoringCodeHash: stringArg("scoringCodeHash", "RECALLWEAVE_LONGMEMEVAL_V2_SCORING_CODE_HASH"),
  leaderboardRowHash: stringArg("leaderboardRowHash", "RECALLWEAVE_LONGMEMEVAL_V2_LEADERBOARD_ROW_HASH"),
  trajectoryIngestContractHash: stringArg("ingestContractHash", "RECALLWEAVE_LONGMEMEVAL_V2_INGEST_CONTRACT_HASH"),
  readerModel: stringArg("readerModel", "RECALLWEAVE_LONGMEMEVAL_V2_READER_MODEL"),
  judgeModel: stringArg("judgeModel", "RECALLWEAVE_LONGMEMEVAL_V2_JUDGE_MODEL"),
};

const liveChecks = live
  ? await Promise.all(Object.entries(contract.sourceUrls).map(([role, url]) => checkUrl(role, url)))
  : [];
const liveSourceSnapshot = live ? await fetchLiveSourceSnapshot(contract) : null;
const report = buildReport({ contract, supplied: applyLiveProofs(supplied, liveSourceSnapshot), liveChecks, liveSourceSnapshot });
const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "agentic memory source-lock report");
assertSafePublicText(markdownText, "agentic memory source-lock markdown");

if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (strict && !report.ok) process.exit(1);

function buildReport({ contract: value, supplied: proof, liveChecks, liveSourceSnapshot }) {
  const structuralChecks = [
    check("target-is-longmemeval-v2", value.id === "longmemeval-v2"),
    check("source-url-count", Object.keys(value.sourceUrls).length === 4),
    check("source-urls-https", Object.values(value.sourceUrls).every(requiredHttpsUrl)),
    check("expected-public-shape", value.expectedPublicShape.questionCount === 451 && value.expectedPublicShape.abilityFamilies.length >= 5),
    check("required-proof-fields", value.requiredProofFields.length >= 10),
  ];
  if (live) {
    for (const item of liveChecks) {
      structuralChecks.push(check(`${item.role}-live-source-reachable`, item.ok));
    }
    structuralChecks.push(check("live-source-snapshot", liveSourceSnapshot?.ok === true));
  }

  const proofChecks = value.requiredProofFields.map((field) => {
    const actual = proof[field.field];
    return {
      field: field.field,
      provided: proofProvided(field, actual),
      kind: field.kind,
      reason: field.reason,
      valueHash: actual ? `sha256:${stableHash(actual)}` : null,
    };
  });
  const blockers = proofChecks.filter((item) => !item.provided).map((item) => `missing-${item.field}`);
  const structuralFailures = structuralChecks.filter((item) => !item.ok).map((item) => item.name);
  const ready = blockers.length === 0;
  const nextMissingProofActions = [
    blockers.includes("missing-trajectoryIngestContractHash")
      ? "Map trajectory history into the RecallWeave ingest/wiki-session contract before materialization."
      : null,
    blockers.some((blocker) => blocker !== "missing-trajectoryIngestContractHash")
      ? "Fill the remaining missing proof fields with hashes and model ids, not raw rows."
      : null,
    "Regenerate this report, then materialize only from a source-lock-ready report.",
  ].filter(Boolean);

  return {
    schemaVersion: 1,
    ok: structuralFailures.length === 0,
    mode: "agentic-memory-source-lock-check",
    generatedAt: new Date().toISOString(),
    writesRealFiles: Boolean(outputPath || markdownOutputPath),
    metricsOnly: true,
    publicSafe: true,
    liveChecksRequested: live,
    publicBenchmarkClaimsAllowed: false,
    countsAsBenchmarkScore: false,
    sourceLockReadyForMaterialization: ready,
    sourceLockReadyForPublicClaim: false,
    rawQuestionIdsIncluded: false,
    rawQuestionsIncluded: false,
    rawAnswersIncluded: false,
    rawMemoryIncluded: false,
    rawTranscriptIncluded: false,
    target: {
      id: value.id,
      name: value.name,
      sourceHosts: Object.fromEntries(Object.entries(value.sourceUrls).map(([role, url]) => [role, urlHost(url)])),
      sourceUrlsHash: `sha256:${stableHash(Object.values(value.sourceUrls).join("\n"))}`,
      expectedPublicShape: value.expectedPublicShape,
    },
    proofChecks,
    structuralChecks,
    liveChecks,
    liveSourceSnapshot,
    failedChecks: structuralFailures,
    blockersBeforeRun: blockers,
    nextActions: ready
      ? [
          "Materialize LongMemEval-V2 through an operator-private run directory.",
          "Export RecallWeave arms with raw rows retained outside the repository.",
          "Run the same reader and judge model declared in this source-lock report.",
          "Compare only against the same leaderboard tier and scoring contract.",
        ]
      : nextMissingProofActions,
    safety: {
      storesRawBenchmarkData: false,
      storesCredentials: false,
      printsPrivatePaths: false,
      permitsProviderCalls: false,
      sourceLockOnly: true,
    },
  };
}

function applyLiveProofs(proof, snapshot) {
  if (!snapshot?.ok) return proof;
  return {
    ...proof,
    repoCommit: proof.repoCommit || snapshot.repoCommit || "",
    datasetRevision: proof.datasetRevision || snapshot.datasetRevision || "",
  };
}

async function fetchLiveSourceSnapshot(value) {
  const checkedAt = new Date().toISOString();
  const repo = await fetchJson("https://api.github.com/repos/xiaowu0162/LongMemEval-V2/commits/main");
  const repoRoot = await fetchJson("https://api.github.com/repos/xiaowu0162/LongMemEval-V2/contents?ref=main");
  const dataset = await fetchJson("https://huggingface.co/api/datasets/xiaowu0162/longmemeval-v2");
  const repoNames = Array.isArray(repoRoot.data) ? repoRoot.data.map((item) => String(item.name ?? "")).filter(Boolean).sort() : [];
  const datasetSiblings = Array.isArray(dataset.data?.siblings)
    ? dataset.data.siblings.map((item) => String(item.rfilename ?? "")).filter(Boolean).sort()
    : [];
  const requiredRepoEntries = ["README.md", "LICENSE", "data", "evaluation", "leaderboard", "memory_modules"];
  const requiredDatasetEntries = ["README.md", "DATA_CARD.md", "SCHEMA.md", "LICENSE"];
  const repoCommit = String(repo.data?.sha ?? "");
  const datasetRevision = String(dataset.data?.sha ?? "");
  const ok =
    repo.ok &&
    dataset.ok &&
    commitPattern.test(repoCommit) &&
    commitPattern.test(datasetRevision) &&
    requiredRepoEntries.every((entry) => repoNames.includes(entry)) &&
    requiredDatasetEntries.every((entry) => datasetSiblings.includes(entry));
  return {
    ok,
    checkedAt,
    repoHost: urlHost(value.sourceUrls.repository),
    datasetHost: urlHost(value.sourceUrls.dataset),
    repoCommit,
    datasetRevision,
    repoContentsHash: `sha256:${stableHash(repoNames.join("\n"))}`,
    datasetSiblingsHash: `sha256:${stableHash(datasetSiblings.join("\n"))}`,
    repoEntryCount: repoNames.length,
    datasetSiblingCount: datasetSiblings.length,
    requiredRepoEntriesPresent: requiredRepoEntries.filter((entry) => repoNames.includes(entry)),
    requiredDatasetEntriesPresent: requiredDatasetEntries.filter((entry) => datasetSiblings.includes(entry)),
    errors: [repo, repoRoot, dataset]
      .filter((item) => !item.ok)
      .map((item) => ({ role: item.role, status: item.status, error: item.error ?? null })),
  };
}

async function fetchJson(url) {
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "recallweave-source-lock-check",
      },
      redirect: "follow",
    });
    if (!response.ok) {
      return { role: urlHost(url), ok: false, status: response.status, data: null };
    }
    return { role: urlHost(url), ok: true, status: response.status, data: await response.json() };
  } catch (error) {
    return {
      role: urlHost(url),
      ok: false,
      status: null,
      data: null,
      error: String(error?.name ?? "fetch-error"),
    };
  }
}

function proofProvided(field, value) {
  if (!value) return false;
  if (field.kind === "git-commit") return commitPattern.test(value);
  if (field.kind === "sha256") return sha256Pattern.test(value);
  if (field.kind === "enum:small|medium") return ["small", "medium"].includes(value.toLowerCase());
  return value.trim().length > 0;
}

async function checkUrl(role, url) {
  try {
    const response = await fetch(url, { method: "HEAD", redirect: "follow" });
    return {
      role,
      host: urlHost(url),
      urlHash: `sha256:${stableHash(url)}`,
      ok: response.ok,
      status: response.status,
    };
  } catch (error) {
    return {
      role,
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
    "# Agentic Memory Source Lock Check",
    "",
    `- OK: ${report.ok}`,
    `- Target: ${report.target.name}`,
    `- Source-lock ready for materialization: ${report.sourceLockReadyForMaterialization}`,
    `- Counts as benchmark score: ${report.countsAsBenchmarkScore}`,
    `- Public benchmark claims allowed: ${report.publicBenchmarkClaimsAllowed}`,
    `- Missing proof fields: ${report.blockersBeforeRun.length ? report.blockersBeforeRun.join(", ") : "none"}`,
    "",
    "## Required Proof",
    "",
    ...report.proofChecks.map((item) => `- ${item.field}: ${item.provided ? "provided" : "missing"} (${item.kind})`),
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

function stringArg(argName, envName) {
  const value = args[argName] ?? process.env[envName] ?? "";
  return String(value).trim();
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

function check(name, ok) {
  return { name, ok: Boolean(ok) };
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(String(text), secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(String(text), privatePathPattern, `${label} contains a private path`);
}
