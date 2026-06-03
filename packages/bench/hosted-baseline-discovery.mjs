import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const liveRequested = Boolean(args.live) || process.env.RECALLWEAVE_BASELINE_LIVE === "1";
const fixtureRequested = Boolean(args.fixture) || !liveRequested;
const limit = positiveInt(args.limit ?? process.env.RECALLWEAVE_BASELINE_DISCOVERY_LIMIT ?? 50, "limit");
const maxPages = positiveInt(args.maxPages ?? args.maxpages ?? process.env.RECALLWEAVE_BASELINE_DISCOVERY_MAX_PAGES ?? 2, "maxPages");
const timeoutMs = positiveInt(args.timeoutMs ?? process.env.RECALLWEAVE_BASELINE_TIMEOUT_MS ?? 15000, "timeoutMs");
const outputPath = args.output ?? process.env.RECALLWEAVE_BASELINE_DISCOVERY_OUTPUT_JSON ?? null;
const privateMapOutput = args.privateMapOutput ?? process.env.RECALLWEAVE_BASELINE_PRIVATE_MAP_OUTPUT ?? null;
const allowPrivateLabels = process.env.RECALLWEAVE_BASELINE_ALLOW_PRIVATE_LABELS === "1";
const apiKey = process.env.SUPERMEMORY_API_KEY ?? "";

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;
const fixtureSalt = "recallweave-fixture-baseline-discovery-v1";

if (!fixtureRequested) {
  assert.equal(liveRequested, true, "hosted baseline discovery requires --live or RECALLWEAVE_BASELINE_LIVE=1");
  assert.ok(apiKey, "SUPERMEMORY_API_KEY must be present in the environment for live discovery");
}
if (privateMapOutput) {
  assert.equal(
    allowPrivateLabels,
    true,
    "private container map output requires RECALLWEAVE_BASELINE_ALLOW_PRIVATE_LABELS=1",
  );
}

const runAt = new Date().toISOString();
const source = fixtureRequested
  ? fixtureDocuments()
  : await collectHostedMetadata({ apiKey, limit, maxPages, timeoutMs });
const candidates = summarizeContainers(source.documents, fixtureRequested ? fixtureSalt : apiKeyFingerprint(apiKey));
const privateMapPath = privateMapOutput ? writePrivateMap(privateMapOutput, candidates) : null;

const report = {
  ok: true,
  mode: "hosted-baseline-discovery",
  schemaVersion: 1,
  fixtureOnly: fixtureRequested,
  evidenceType: fixtureRequested ? "fixture-hosted-baseline-discovery" : "live-hosted-baseline-discovery",
  writesRealFiles: Boolean(outputPath || privateMapPath),
  callsHostedProvider: !fixtureRequested,
  publicSafe: true,
  metricsOnly: true,
  rawLabelsIncluded: false,
  rawTitlesIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPromptIncluded: false,
  rawAnswerIncluded: false,
  privacyLeakCount: 0,
  redactionFailureCount: 0,
  runAt,
  discoveryConfig: {
    endpoint: fixtureRequested ? "fixture" : "https://api.supermemory.ai/v3/documents/list",
    includeContent: false,
    limit,
    maxPages,
    sort: "updatedAt",
    order: "desc",
  },
  sourceStats: {
    pagesRead: source.pagesRead,
    documentsSeen: source.documents.length,
    errors: source.errors,
  },
  containerCandidateCount: candidates.length,
  recommendedCandidateId: candidates[0]?.candidateId ?? null,
  containerCandidates: candidates.map((candidate) => publicCandidate(candidate)),
  privateMap: privateMapPath
    ? {
        written: true,
        basename: basename(privateMapPath),
        mode: "0600",
        entryCount: candidates.length,
        containsRawLabels: true,
        attachToPublicEvidence: false,
      }
    : {
        written: false,
        containsRawLabels: false,
        attachToPublicEvidence: false,
      },
  nextActions: [
    "Use the candidate ids and counts to choose the likely hosted baseline source.",
    "If raw hosted container labels are needed, rerun with RECALLWEAVE_BASELINE_ALLOW_PRIVATE_LABELS=1 and --private-map-output pointing outside the repository.",
    "Copy the selected raw label from the private map into RECALLWEAVE_BASELINE_CONTAINER on that local machine only.",
    "Run baseline:collect with the same source-locked query set and metrics-only flags.",
  ],
  safety: {
    printsCredentialValues: false,
    printsRawContainerLabels: false,
    printsMemoryText: false,
    privateMapRequiresExplicitOptIn: true,
    privateMapRejectedInsideRepository: true,
    liveHostedWriteBack: false,
  },
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
assertSafePublicText(serialized, "hosted baseline discovery report");
if (outputPath) writeOutput(outputPath, serialized);
process.stdout.write(serialized);

async function collectHostedMetadata({ apiKey, limit, maxPages, timeoutMs }) {
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
        "user-agent": "recallweave-hosted-baseline-discovery",
      },
      body: JSON.stringify({
        limit,
        page,
        includeContent: false,
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
    const memories = Array.isArray(payload.memories) ? payload.memories : [];
    totalPages = Number(payload.pagination?.totalPages ?? page);
    documents.push(...memories.map(normalizeDocument));
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

function fixtureDocuments() {
  return {
    pagesRead: 1,
    errors: [],
    documents: [
      {
        id: "fixture-doc-1",
        type: "memory",
        status: "active",
        containerTags: ["fixture-personal"],
        createdAt: "2026-05-20T12:00:00.000Z",
        updatedAt: "2026-05-22T12:00:00.000Z",
      },
      {
        id: "fixture-doc-2",
        type: "memory",
        status: "active",
        containerTags: ["fixture-personal"],
        createdAt: "2026-05-21T12:00:00.000Z",
        updatedAt: "2026-05-22T13:00:00.000Z",
      },
      {
        id: "fixture-doc-3",
        type: "source",
        status: "active",
        containerTags: ["fixture-agent"],
        createdAt: "2026-05-22T10:00:00.000Z",
        updatedAt: "2026-05-22T14:00:00.000Z",
      },
    ].map(normalizeDocument),
  };
}

function normalizeDocument(memory) {
  return {
    id: String(memory.id ?? memory.documentId ?? memory.customId ?? ""),
    type: String(memory.type ?? "unknown"),
    status: String(memory.status ?? "unknown"),
    containerTags: normalizeTags(memory.containerTags ?? memory.containerTag ?? memory.container ?? memory.metadata?.containerTags),
    createdAt: stringOrNull(memory.createdAt),
    updatedAt: stringOrNull(memory.updatedAt),
  };
}

function normalizeTags(value) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const tags = values.map((item) => String(item).trim()).filter(Boolean);
  return tags.length ? tags : ["__untagged__"];
}

function summarizeContainers(documents, salt) {
  const byLabel = new Map();
  for (const document of documents) {
    for (const rawLabel of document.containerTags) {
      const label = String(rawLabel);
      const existing =
        byLabel.get(label) ??
        {
          rawLabel: label,
          candidateId: `c_${shortHash(`${salt}:${label}`)}`,
          documentCount: 0,
          typeCounts: {},
          statusCounts: {},
          firstCreatedAt: null,
          lastUpdatedAt: null,
          sampleDocumentHashes: [],
        };
      existing.documentCount += 1;
      existing.typeCounts[document.type] = (existing.typeCounts[document.type] ?? 0) + 1;
      existing.statusCounts[document.status] = (existing.statusCounts[document.status] ?? 0) + 1;
      existing.firstCreatedAt = earliestIso(existing.firstCreatedAt, document.createdAt);
      existing.lastUpdatedAt = latestIso(existing.lastUpdatedAt, document.updatedAt);
      if (document.id && existing.sampleDocumentHashes.length < 3) {
        existing.sampleDocumentHashes.push(`sha256:${shortHash(`${salt}:doc:${document.id}`)}`);
      }
      byLabel.set(label, existing);
    }
  }

  return [...byLabel.values()].sort((left, right) => {
    if (right.documentCount !== left.documentCount) return right.documentCount - left.documentCount;
    return Date.parse(right.lastUpdatedAt ?? "1970-01-01T00:00:00.000Z") - Date.parse(left.lastUpdatedAt ?? "1970-01-01T00:00:00.000Z");
  });
}

function publicCandidate(candidate) {
  return {
    candidateId: candidate.candidateId,
    documentCount: candidate.documentCount,
    firstCreatedAt: candidate.firstCreatedAt,
    lastUpdatedAt: candidate.lastUpdatedAt,
    typeCounts: sortObject(candidate.typeCounts),
    statusCounts: sortObject(candidate.statusCounts),
    sampleDocumentHashes: candidate.sampleDocumentHashes,
  };
}

function writePrivateMap(inputPath, candidates) {
  const path = resolve(inputPath);
  assertOutsideRepository(path, "private container map");
  const lines = candidates.map((candidate) => {
    assert.doesNotMatch(candidate.rawLabel, secretPattern, "raw hosted container label looks like a credential");
    return JSON.stringify({
      candidateId: candidate.candidateId,
      rawContainerTag: candidate.rawLabel,
      documentCount: candidate.documentCount,
      firstCreatedAt: candidate.firstCreatedAt,
      lastUpdatedAt: candidate.lastUpdatedAt,
    });
  });
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${lines.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
  chmodSync(path, 0o600);
  assert.equal(statSync(path).mode & 0o777, 0o600, "private container map must use 0600 permissions");
  return path;
}

function writeOutput(inputPath, serialized) {
  const path = isAbsolute(inputPath) ? inputPath : resolve(root, inputPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serialized, { encoding: "utf8", mode: 0o600 });
}

function assertOutsideRepository(path, label) {
  const rel = relative(root, path).replaceAll("\\", "/");
  assert.ok(rel.startsWith("../") || rel === ".." || isAbsolute(rel), `${label} must be written outside the repository`);
  assert.ok(!existsSync(path) || statSync(path).isFile(), `${label} path is not a file`);
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a private path`);
  assert.doesNotMatch(text, /fixture-personal|fixture-agent/, `${label} contains fixture raw container labels`);
}

function positiveInt(value, name) {
  const parsed = Number(value);
  assert.ok(Number.isInteger(parsed) && parsed > 0, `${name} must be a positive integer`);
  return parsed;
}

function stringOrNull(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

function earliestIso(left, right) {
  if (!right) return left;
  if (!left) return right;
  return Date.parse(right) < Date.parse(left) ? right : left;
}

function latestIso(left, right) {
  if (!right) return left;
  if (!left) return right;
  return Date.parse(right) > Date.parse(left) ? right : left;
}

function sortObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

function shortHash(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function apiKeyFingerprint(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
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
