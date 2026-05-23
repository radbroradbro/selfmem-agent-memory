import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const fixtureModeByArgs = Boolean(args.fixture) || (!args.privateMap && !args.discovery);
const liveRequested = Boolean(args.live) || process.env.RECALLWEAVE_BASELINE_LIVE === "1";
const discoveryPath = args.discovery ?? process.env.RECALLWEAVE_BASELINE_DISCOVERY_OUTPUT_JSON ?? null;
const privateMapPath = args.privateMap ?? process.env.RECALLWEAVE_BASELINE_PRIVATE_MAP ?? null;
const requestedCandidateId = args.candidateId ?? process.env.RECALLWEAVE_BASELINE_CANDIDATE_ID ?? null;
const querySetOutput = args.querysetOutput ?? args.querySetOutput ?? process.env.RECALLWEAVE_BASELINE_QUERYSET_OUTPUT ?? join(tmpdir(), "recallweave-hosted-baseline-queryset.private.json");
const outputPath = args.output ?? process.env.RECALLWEAVE_BASELINE_QUERYSET_AUTHOR_REPORT_JSON ?? null;
const maxQueries = positiveInt(args.maxQueries ?? process.env.RECALLWEAVE_BASELINE_QUERYSET_MAX_QUERIES ?? 8, "maxQueries");
const minQueries = positiveInt(args.minQueries ?? process.env.RECALLWEAVE_BASELINE_QUERYSET_MIN_QUERIES ?? 3, "minQueries");
const limit = positiveInt(args.limit ?? process.env.RECALLWEAVE_BASELINE_QUERYSET_AUTHOR_LIMIT ?? 50, "limit");
const maxPages = positiveInt(args.maxPages ?? process.env.RECALLWEAVE_BASELINE_QUERYSET_AUTHOR_MAX_PAGES ?? 3, "maxPages");
const timeoutMs = positiveInt(args.timeoutMs ?? process.env.RECALLWEAVE_BASELINE_TIMEOUT_MS ?? 15000, "timeoutMs");
const judgeModel = args.judgeModel ?? process.env.RECALLWEAVE_BASELINE_JUDGE_MODEL ?? "manual-review-required";
const answerModel = args.answerModel ?? process.env.RECALLWEAVE_BASELINE_ANSWER_MODEL ?? "manual-review-required";

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;

if (!fixtureModeByArgs) {
  assert.equal(liveRequested, true, "live query-set authoring requires --live or RECALLWEAVE_BASELINE_LIVE=1");
  assert.ok(process.env.SUPERMEMORY_API_KEY, "SUPERMEMORY_API_KEY must be present for live query-set authoring");
  assert.ok(privateMapPath, "live query-set authoring requires --private-map");
}

const discovery = discoveryPath ? loadDiscovery(discoveryPath) : fixtureDiscovery();
const privateMap = privateMapPath ? loadPrivateMap(privateMapPath) : fixturePrivateMap();
const candidateId = requestedCandidateId ?? discovery.recommendedCandidateId ?? privateMap[0]?.candidateId ?? null;
assert.ok(candidateId, "no candidate id available for hosted baseline query-set authoring");
const selected = privateMap.find((entry) => entry.candidateId === candidateId);
assert.ok(selected, `candidate ${candidateId} was not found in the private container map`);
validateRawContainerTag(selected.rawContainerTag);

const fixtureOnly = fixtureModeByArgs || discovery.fixtureOnly === true;
const source = fixtureOnly
  ? fixtureDocuments(selected.rawContainerTag)
  : await collectHostedDocuments({
      apiKey: process.env.SUPERMEMORY_API_KEY,
      containerTag: selected.rawContainerTag,
      limit,
      maxPages,
      timeoutMs,
    });
const textDocuments = source.documents
  .map(normalizeDocumentForQuestion)
  .filter((document) => document.text.length >= 40)
const queries = buildUniqueQueries(textDocuments, maxQueries);
assert.ok(queries.length >= minQueries, `not enough unique hosted documents to author query set: ${queries.length} < ${minQueries}`);

const querySet = {
  schemaVersion: 1,
  fixtureOnly,
  datasetSlice: fixtureOnly ? "fixture-hosted-queryset-author-slice" : `hosted-container-canary-${candidateId}-${new Date().toISOString().slice(0, 10)}`,
  judgeModel,
  answerModel,
  authoring: {
    mode: "private-auto-draft",
    reviewRequired: true,
    selectedCandidateId: candidateId,
    sourceDocumentCount: source.documents.length,
  },
  queries,
};
const querySetPath = writePrivateQuerySet(querySetOutput, querySet);
const querySetHash = stableHash({
  schemaVersion: querySet.schemaVersion,
  datasetSlice: querySet.datasetSlice,
  queries: querySet.queries.map((query) => ({
    id: query.id,
    q: query.q,
    expectedResultIds: query.expectedResultIds ?? [],
    expectedResultHashes: query.expectedResultHashes ?? [],
  })),
});

const report = {
  ok: true,
  mode: "hosted-baseline-queryset-author",
  schemaVersion: 1,
  fixtureOnly,
  evidenceType: fixtureOnly ? "fixture-hosted-baseline-queryset-author" : "live-hosted-baseline-queryset-author",
  writesRealFiles: true,
  callsHostedProvider: !fixtureOnly,
  publicSafe: true,
  metricsOnly: true,
  rawLabelsIncluded: false,
  rawTitlesIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPromptIncluded: false,
  rawAnswerIncluded: false,
  rawQueryIncluded: false,
  rawExpectedIdsIncluded: false,
  rawExpectedHashesIncluded: false,
  privacyLeakCount: 0,
  redactionFailureCount: 0,
  countsAsBenchmarkEvidence: false,
  authoringReviewRequired: true,
  selectedCandidate: {
    candidateId,
    rawLabelLength: selected.rawContainerTag.length,
    selectionFingerprint: `sha256:${shortHash(`queryset-author-v1:${candidateId}:${selected.rawContainerTag.length}`)}`,
  },
  sourceStats: {
    endpoint: fixtureOnly ? "fixture" : "https://api.supermemory.ai/v3/documents/list",
    pagesRead: source.pagesRead,
    documentsSeen: source.documents.length,
    textBearingDocuments: textDocuments.length,
    authoredQueryCount: querySet.queries.length,
    errors: source.errors,
  },
  privateQuerySet: {
    written: true,
    basename: basename(querySetPath),
    mode: "0600",
    containsRawQueries: true,
    containsExpectedResultRefs: true,
    attachToPublicEvidence: false,
  },
  querySetEvidence: {
    queryCount: querySet.queries.length,
    uniqueQueryCount: uniqueCount(querySet.queries.map((query) => query.q)),
    duplicateQueryCount: querySet.queries.length - uniqueCount(querySet.queries.map((query) => query.q)),
    expectedResultRefCount: querySet.queries.reduce((sum, query) => sum + arrayLength(query.expectedResultIds) + arrayLength(query.expectedResultHashes), 0),
    minExpectedRefsPerQuery: Math.min(...querySet.queries.map((query) => arrayLength(query.expectedResultIds) + arrayLength(query.expectedResultHashes))),
    publicBenchmarkReadyAfterReview: true,
    querySetHash: `sha256:${querySetHash}`,
  },
  queryFingerprints: querySet.queries.map((query) => ({
    queryIdHash: shortHash(query.id),
    queryHash: shortHash(query.q),
    expectedResultIdCount: arrayLength(query.expectedResultIds),
    expectedResultHashCount: arrayLength(query.expectedResultHashes),
  })),
  safety: {
    printsCredentialValues: false,
    printsRawContainerLabels: false,
    printsMemoryText: false,
    privateMapRejectedInsideRepository: true,
    privateQuerySetRejectedInsideRepository: true,
    liveHostedWriteBack: false,
  },
  nextActions: [
    "Review the private query set locally before collecting metrics.",
    "Run baseline:queryset -- --queryset <private-query-set> --strict --output <public-queryset-report>.",
    "Use the same private query set for hosted and RecallWeave collection.",
    "Attach only the metrics-only author report and query-set inspection report, not the private query set.",
  ],
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
assertSafePublicText(serialized, "hosted baseline query-set author report");
if (outputPath) writeOutput(outputPath, serialized);
process.stdout.write(serialized);

async function collectHostedDocuments({ apiKey, containerTag, limit, maxPages, timeoutMs }) {
  const documents = [];
  const errors = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages && page <= maxPages) {
    const response = await fetch("https://api.supermemory.ai/v3/documents/list", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "user-agent": "recallweave-hosted-baseline-queryset-author",
      },
      body: JSON.stringify({
        limit,
        page,
        includeContent: true,
        order: "desc",
        sort: "updatedAt",
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const payload = await safeJson(response);
    if (!response.ok) {
      errors.push({ page, status: response.status, errorClass: String(payload?.error ?? payload?.code ?? "unknown").slice(0, 80) });
      break;
    }
    totalPages = Number(payload.pagination?.totalPages ?? page);
    const memories = Array.isArray(payload.memories) ? payload.memories : [];
    documents.push(...memories.map(normalizeHostedDocument).filter((document) => document.containerTags.includes(containerTag)));
    page += 1;
  }
  return { pagesRead: page - 1, documents, errors };
}

async function safeJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { parseError: true, rawLength: text.length };
  }
}

function normalizeHostedDocument(memory) {
  return {
    id: String(memory.id ?? memory.documentId ?? memory.customId ?? ""),
    containerTags: normalizeTags(memory.containerTags ?? memory.containerTag ?? memory.container ?? memory.metadata?.containerTags),
    text: extractDocumentText(memory),
    updatedAt: stringOrNull(memory.updatedAt),
  };
}

function normalizeDocumentForQuestion(document) {
  const redacted = redactForPrivateQuery(document.text);
  return {
    id: String(document.id ?? ""),
    contentHash: document.text ? `sha256:${stableHash(document.text)}` : null,
    text: redacted,
    updatedAt: stringOrNull(document.updatedAt),
  };
}

function extractDocumentText(memory) {
  const candidates = [
    memory.memory,
    memory.content,
    memory.text,
    memory.body,
    memory.summary,
    memory.title,
    memory.metadata?.memory,
    memory.metadata?.content,
    memory.metadata?.text,
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  return candidates.sort((left, right) => right.length - left.length)[0] ?? "";
}

function buildUniqueQueries(documents, maxQueries) {
  const queries = [];
  const usedContentHashes = new Set();
  const usedQueryHashes = new Set();

  for (const document of documents) {
    if (document.contentHash && usedContentHashes.has(document.contentHash)) continue;

    const phrase = makeQuestionPhraseCandidates(document.text).find((candidate) => {
      const queryHash = stableHash(`What memory discusses ${candidate}?`);
      return !usedQueryHashes.has(queryHash);
    });
    if (!phrase) continue;

    const query = buildQuery(document, queries.length, phrase);
    usedQueryHashes.add(stableHash(query.q));
    if (document.contentHash) usedContentHashes.add(document.contentHash);
    queries.push(query);
    if (queries.length >= maxQueries) break;
  }

  return queries;
}

function buildQuery(document, index, phrase) {
  const expectedResultIds = document.id ? [document.id] : [];
  const expectedResultHashes = document.contentHash ? [document.contentHash] : [];
  return {
    id: `hosted-q-${index + 1}-${shortHash(`${document.id}:${phrase}`)}`,
    q: `What memory discusses ${phrase}?`,
    expectedResultIds,
    expectedResultHashes,
  };
}

function makeQuestionPhraseCandidates(text) {
  const seen = new Set();
  const phrases = [];
  const sentences = String(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const pools = [...sentences, String(text)];

  for (const pool of pools) {
    const words = tokenizeQuestionWords(pool);
    for (const size of [10, 8, 6]) {
      for (let start = 0; start <= Math.max(0, words.length - size); start += Math.max(1, Math.floor(size / 2))) {
        const phrase = words.slice(start, start + size).join(" ").trim();
        if (!phrase || seen.has(phrase)) continue;
        seen.add(phrase);
        phrases.push(phrase);
      }
    }
  }

  if (phrases.length === 0) {
    const fallback = tokenizeQuestionWords(text).slice(0, 10).join(" ").trim();
    if (fallback) phrases.push(fallback);
  }

  return phrases;
}

function tokenizeQuestionWords(text) {
  return String(text)
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\w\s.'-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !/^(the|and|that|this|with|from|into|about|should|would|could|there|their|when|where|what|memory|remember|stored|user|agent|assistant)$/i.test(word));
}

function fixtureDiscovery() {
  return {
    mode: "hosted-baseline-discovery",
    fixtureOnly: true,
    publicSafe: true,
    metricsOnly: true,
    rawLabelsIncluded: false,
    rawMemoryIncluded: false,
    recommendedCandidateId: "c_8f4ad3c9e3efb8c1",
    containerCandidates: [{ candidateId: "c_8f4ad3c9e3efb8c1", documentCount: 3 }],
  };
}

function fixturePrivateMap() {
  return [{ candidateId: "c_8f4ad3c9e3efb8c1", rawContainerTag: "fixture-personal", documentCount: 3 }];
}

function fixtureDocuments(containerTag) {
  return {
    pagesRead: 1,
    errors: [],
    documents: [
      {
        id: "fixture-doc-alpha",
        containerTags: [containerTag],
        text: "RecallWeave keeps local writes as the default and uses hosted Supermemory only for bounded read-through during explicit lookup.",
        updatedAt: "2026-05-22T12:00:00.000Z",
      },
      {
        id: "fixture-doc-beta",
        containerTags: [containerTag],
        text: "Strict real canary evidence requires lifecycle coverage, hybrid search, local writes, latency fields, rollback readiness, and zero privacy leaks.",
        updatedAt: "2026-05-22T13:00:00.000Z",
      },
      {
        id: "fixture-doc-gamma",
        containerTags: [containerTag],
        text: "The Brain UI uses a Nucleus Index with wiki links, retrieval traces, research lineage, and editable derived memory documents.",
        updatedAt: "2026-05-22T14:00:00.000Z",
      },
    ],
  };
}

function loadDiscovery(inputPath) {
  const path = resolveInputPath(inputPath);
  const discovery = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(discovery.mode, "hosted-baseline-discovery", "discovery file must come from baseline:discover");
  assert.equal(discovery.publicSafe, true, "discovery file must be public-safe");
  assert.equal(discovery.metricsOnly, true, "discovery file must be metrics-only");
  assert.equal(discovery.rawLabelsIncluded, false, "discovery report must not include raw labels");
  assert.equal(discovery.rawMemoryIncluded, false, "discovery report must not include raw memory");
  return discovery;
}

function loadPrivateMap(inputPath) {
  const path = resolve(inputPath);
  assertOutsideRepository(path, "private container map");
  assert.ok(existsSync(path), "private container map does not exist");
  assert.equal(statSync(path).mode & 0o777, 0o600, "private container map must use 0600 permissions");
  const entries = readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => parsePrivateMapLine(line, index + 1));
  assert.ok(entries.length > 0, "private container map is empty");
  return entries;
}

function parsePrivateMapLine(line, lineNumber) {
  const parsed = JSON.parse(line);
  const candidateId = String(parsed.candidateId ?? "");
  const rawContainerTag = String(parsed.rawContainerTag ?? "");
  assert.match(candidateId, /^c_[a-f0-9]{16}$/, `private map line ${lineNumber} has invalid candidateId`);
  validateRawContainerTag(rawContainerTag);
  return { candidateId, rawContainerTag, documentCount: numberOrNull(parsed.documentCount) };
}

function writePrivateQuerySet(inputPath, querySet) {
  const path = resolve(inputPath);
  assertOutsideRepository(path, "private hosted baseline query set");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(querySet, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  chmodSync(path, 0o600);
  assert.equal(statSync(path).mode & 0o777, 0o600, "private hosted baseline query set must use 0600 permissions");
  return path;
}

function writeOutput(inputPath, serialized) {
  const path = isAbsolute(inputPath) ? inputPath : resolve(root, inputPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serialized, { encoding: "utf8", mode: 0o600 });
}

function resolveInputPath(inputPath) {
  return isAbsolute(inputPath) ? inputPath : resolve(root, inputPath);
}

function assertOutsideRepository(path, label) {
  const rel = relative(root, path).replaceAll("\\", "/");
  assert.ok(rel.startsWith("../") || rel === ".." || isAbsolute(rel), `${label} must be outside the repository`);
  assert.ok(!existsSync(path) || statSync(path).isFile(), `${label} path is not a file`);
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a private path`);
  assert.doesNotMatch(text, /fixture-personal|fixture-agent|fixture-doc-alpha|fixture-doc-beta|fixture-doc-gamma/i, `${label} contains raw fixture query-set data`);
  assert.doesNotMatch(text, /expectedResultIds|expectedResultHashes|"\s*q"\s*:|"\s*id"\s*:/, `${label} contains raw query-set fields`);
}

function validateRawContainerTag(value) {
  assert.ok(value, "raw container tag is required");
  assert.doesNotMatch(value, /[\r\n\0]/, "raw container tag contains a control character");
  assert.doesNotMatch(value, secretPattern, "raw container tag looks like a credential");
}

function redactForPrivateQuery(text) {
  return String(text)
    .replace(/<private>[\s\S]*?(?:<\/private>|$)/gi, " ")
    .replace(secretPattern, " ")
    .replace(privatePathPattern, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTags(value) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.map((item) => String(item).trim()).filter(Boolean);
}

function arrayLength(value) {
  return Array.isArray(value) ? value.filter((item) => String(item).trim()).length : 0;
}

function uniqueCount(values) {
  return new Set(values.map((value) => stableHash(String(value)))).size;
}

function stringOrNull(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveInt(value, name) {
  const parsed = Number(value);
  assert.ok(Number.isInteger(parsed) && parsed > 0, `${name} must be a positive integer`);
  return parsed;
}

function stableHash(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(text).digest("hex");
}

function shortHash(value) {
  return stableHash(String(value)).slice(0, 16);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (!item.startsWith("--")) continue;
    const key = toCamel(item.slice(2));
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
