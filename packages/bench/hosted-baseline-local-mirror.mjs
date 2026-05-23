import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const liveRequested = Boolean(args.live) || process.env.RECALLWEAVE_BASELINE_LIVE === "1";
const fixtureModeByArgs = Boolean(args.fixture) || (!liveRequested && !args.privateMap);
const discoveryPath = args.discovery ?? process.env.RECALLWEAVE_BASELINE_DISCOVERY_OUTPUT_JSON ?? null;
const privateMapPath = args.privateMap ?? process.env.RECALLWEAVE_BASELINE_PRIVATE_MAP ?? null;
const requestedCandidateId = args.candidateId ?? process.env.RECALLWEAVE_BASELINE_CANDIDATE_ID ?? null;
const outputDirArg = args.outputDir ?? args.containerDir ?? process.env.RECALLWEAVE_BASELINE_MIRROR_DIR ?? null;
const outputPath = args.output ?? process.env.RECALLWEAVE_BASELINE_MIRROR_OUTPUT_JSON ?? null;
const limit = positiveInt(args.limit ?? process.env.RECALLWEAVE_BASELINE_MIRROR_LIMIT ?? 50, "limit");
const maxPages = positiveInt(args.maxPages ?? args.maxpages ?? process.env.RECALLWEAVE_BASELINE_MIRROR_MAX_PAGES ?? 3, "maxPages");
const timeoutMs = positiveInt(args.timeoutMs ?? process.env.RECALLWEAVE_BASELINE_TIMEOUT_MS ?? 15000, "timeoutMs");
const overwrite = Boolean(args.overwrite) || process.env.RECALLWEAVE_BASELINE_MIRROR_OVERWRITE === "1";

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;
const privatePathRedactionPattern =
  /(?:\/Users\/[^\s"'`<>)}\]]+|\/Volumes\/[^\s"'`<>)}\]]+|\/private\/[^\s"'`<>)}\]]+|\/var\/folders\/[^\s"'`<>)}\]]+|[A-Za-z]:\\Users\\[^\s"'`<>)}\]]+)/gi;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;

if (!fixtureModeByArgs) {
  assert.equal(liveRequested, true, "live hosted mirror requires --live or RECALLWEAVE_BASELINE_LIVE=1");
  assert.ok(process.env.SUPERMEMORY_API_KEY, "SUPERMEMORY_API_KEY must be present for live hosted mirror");
  assert.ok(privateMapPath, "live hosted mirror requires --private-map");
}

const discovery = discoveryPath ? loadDiscovery(discoveryPath) : fixtureDiscovery();
const privateMap = privateMapPath ? loadPrivateMap(privateMapPath) : fixturePrivateMap();
const fixtureOnly = fixtureModeByArgs || discovery.fixtureOnly === true;
const candidateId = requestedCandidateId ?? discovery.recommendedCandidateId ?? privateMap[0]?.candidateId ?? null;
assert.ok(candidateId, "no candidate id available for hosted mirror");
const selected = privateMap.find((entry) => entry.candidateId === candidateId);
assert.ok(selected, `candidate ${candidateId} was not found in the private container map`);
validateRawContainerTag(selected.rawContainerTag);

const source = fixtureOnly
  ? fixtureDocuments(selected.rawContainerTag)
  : await collectHostedDocuments({
      apiKey: process.env.SUPERMEMORY_API_KEY,
      containerTag: selected.rawContainerTag,
      limit,
      maxPages,
      timeoutMs,
    });

const mirror = buildMirror(source.documents, selected.rawContainerTag, candidateId);
assert.ok(mirror.memories.length > 0, "hosted mirror found no text-bearing memories after redaction");
const outputDir = prepareOutputDir(outputDirArg, overwrite);
const memoriesPath = join(outputDir, "memories.jsonl");
const containerMapPath = join(outputDir, "container-map.json");
writePrivateFile(memoriesPath, `${mirror.memories.map((memory) => JSON.stringify(memory)).join("\n")}\n`);
writePrivateFile(containerMapPath, `${JSON.stringify(mirror.containerMap, null, 2)}\n`);

const report = {
  ok: true,
  mode: "hosted-baseline-local-mirror",
  schemaVersion: 1,
  fixtureOnly,
  evidenceType: fixtureOnly ? "fixture-hosted-baseline-local-mirror" : "live-hosted-baseline-local-mirror",
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
  selectedCandidate: {
    candidateId,
    rawLabelLength: selected.rawContainerTag.length,
    sourceLabelHash: shortHash(selected.rawContainerTag),
    selectionFingerprint: `sha256:${shortHash(`mirror-v1:${candidateId}:${selected.rawContainerTag.length}`)}`,
  },
  sourceStats: {
    endpoint: fixtureOnly ? "fixture" : "https://api.supermemory.ai/v3/documents/list",
    pagesRead: source.pagesRead,
    documentsSeen: source.documents.length,
    textBearingDocuments: mirror.textBearingDocuments,
    mirroredMemoryCount: mirror.memories.length,
    skippedFullyPrivate: mirror.skippedFullyPrivate,
    skippedEmpty: mirror.skippedEmpty,
    errors: source.errors,
  },
  redaction: {
    privateTagRedactionCount: mirror.privateTagRedactionCount,
    keyRedactionCount: mirror.keyRedactionCount,
    privatePathRedactionCount: mirror.privatePathRedactionCount,
  },
  localMirror: {
    containerDirHash: shortHash(outputDir),
    memoriesFileName: "memories.jsonl",
    containerMapFileName: "container-map.json",
    fileMode: "0600",
    directoryMode: "0700",
    containsRedactedMemoryText: true,
    attachToPublicEvidence: false,
    outputIdMode: "preserve-hosted-ids",
    sourceLabelHash: shortHash(selected.rawContainerTag),
    localContainerHash: shortHash(mirror.containerMap.localContainer),
  },
  sourceMatchHint: {
    command: "RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 npm exec --yes pnpm@10.23.0 -- baseline:source-match -- --live --queryset <reviewed-queryset> --container-dir <hosted-mirror-dir> --preserve-ids --strict --output <source-match-report>",
    localMap: "<hosted-mirror-dir>/container-map.json",
    privateMap: "<private-hosted-container-map.jsonl>",
  },
  safety: {
    printsCredentialValues: false,
    printsRawContainerLabels: false,
    printsMemoryText: false,
    privateMapRejectedInsideRepository: true,
    mirrorDirRejectedInsideRepository: true,
    liveHostedWriteBack: false,
    hostedReadOnly: true,
  },
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
assertSafePublicText(serialized, "hosted local mirror report");
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
        "user-agent": "recallweave-hosted-baseline-local-mirror",
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

function buildMirror(documents, rawContainerTag, candidateId) {
  const memories = [];
  let textBearingDocuments = 0;
  let skippedFullyPrivate = 0;
  let skippedEmpty = 0;
  let privateTagRedactionCount = 0;
  let keyRedactionCount = 0;
  let privatePathRedactionCount = 0;

  for (const document of documents) {
    const text = extractDocumentText(document);
    if (!text.trim()) {
      skippedEmpty += 1;
      continue;
    }
    textBearingDocuments += 1;
    const redacted = redactForMirror(text);
    privateTagRedactionCount += redacted.privateTagRedactionCount;
    keyRedactionCount += redacted.keyRedactionCount;
    privatePathRedactionCount += redacted.privatePathRedactionCount;
    if (!redacted.text.trim()) {
      skippedFullyPrivate += 1;
      continue;
    }
    const id = document.id || `hosted:${shortHash(`${candidateId}:${redacted.text}`)}`;
    memories.push({
      id,
      sourceId: id,
      content: redacted.text,
      kind: "hosted-mirror",
      metadata: {
        source: "hosted-supermemory",
        candidateId,
        updatedAt: document.updatedAt,
        contentHash: `sha256:${stableHash(normalizeText(redacted.text))}`,
      },
    });
  }

  return {
    memories,
    textBearingDocuments,
    skippedFullyPrivate,
    skippedEmpty,
    privateTagRedactionCount,
    keyRedactionCount,
    privatePathRedactionCount,
    containerMap: {
      schemaVersion: 1,
      fixtureOnly,
      sourceSupermemoryContainer: rawContainerTag,
      localContainer: `recallweave_hosted_mirror_${candidateId}`,
      agentIdentity: "hosted-baseline-mirror",
      createdAt: new Date().toISOString(),
      memoryCount: memories.length,
    },
  };
}

function normalizeHostedDocument(memory) {
  return {
    id: String(memory.id ?? memory.documentId ?? memory.customId ?? ""),
    containerTags: normalizeTags(memory.containerTags ?? memory.containerTag ?? memory.container ?? memory.metadata?.containerTags),
    content: extractDocumentText(memory),
    updatedAt: stringOrNull(memory.updatedAt),
  };
}

function extractDocumentText(memory) {
  const candidates = [
    memory.content,
    memory.memory,
    memory.text,
    memory.body,
    memory.summary,
    memory.title,
    memory.metadata?.content,
    memory.metadata?.memory,
    memory.metadata?.text,
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  return candidates.sort((left, right) => right.length - left.length)[0] ?? "";
}

function redactForMirror(text) {
  const privateMatches = String(text).match(privateTagPattern) ?? [];
  let redacted = String(text).replace(privateTagPattern, " ");
  const keyMatches = redacted.match(secretPattern) ?? [];
  redacted = redacted.replace(secretPattern, " ");
  const privatePathMatches = redacted.match(privatePathRedactionPattern) ?? [];
  redacted = redacted.replace(privatePathRedactionPattern, " ");
  return {
    text: redacted.replace(/\s+/g, " ").trim(),
    privateTagRedactionCount: privateMatches.length,
    keyRedactionCount: keyMatches.length,
    privatePathRedactionCount: privatePathMatches.length,
  };
}

function prepareOutputDir(inputPath, overwrite) {
  const path = inputPath ? resolve(inputPath) : mkdtempSync(join(tmpdir(), "recallweave-hosted-mirror-"));
  assertOutsideRepository(path, "hosted local mirror directory");
  if (existsSync(path)) {
    assert.ok(statSync(path).isDirectory(), "hosted local mirror path is not a directory");
    if (!overwrite) {
      assert.ok(!existsSync(join(path, "memories.jsonl")), "hosted local mirror memories.jsonl already exists; pass --overwrite to replace it");
      assert.ok(!existsSync(join(path, "container-map.json")), "hosted local mirror container-map.json already exists; pass --overwrite to replace it");
    }
  }
  mkdirSync(path, { recursive: true, mode: 0o700 });
  chmodSync(path, 0o700);
  return path;
}

function writePrivateFile(path, text) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
  chmodSync(path, 0o600);
  assert.equal(statSync(path).mode & 0o777, 0o600, `${path} must use 0600 permissions`);
}

function writeOutput(inputPath, serialized) {
  const path = isAbsolute(inputPath) ? inputPath : resolve(root, inputPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serialized, { encoding: "utf8", mode: 0o600 });
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
        content: "RecallWeave keeps local writes as the default and uses hosted Supermemory only for bounded read-through during explicit lookup.",
        updatedAt: "2026-05-22T12:00:00.000Z",
      },
      {
        id: "fixture-doc-beta",
        containerTags: [containerTag],
        content: "Strict real canary evidence requires lifecycle coverage, hybrid search, local writes, latency fields, rollback readiness, and zero privacy leaks.",
        updatedAt: "2026-05-22T13:00:00.000Z",
      },
      {
        id: "fixture-doc-gamma",
        containerTags: [containerTag],
        content: "The Brain UI uses a Nucleus Index with wiki links, retrieval traces, research lineage, and editable derived memory documents.",
        updatedAt: "2026-05-22T14:00:00.000Z",
      },
    ],
  };
}

function validateRawContainerTag(value) {
  assert.ok(value, "raw container tag is required");
  assert.doesNotMatch(value, /[\r\n\0]/, "raw container tag contains a control character");
  assert.doesNotMatch(value, secretPattern, "raw container tag looks like a credential");
}

function normalizeTags(value) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeText(text) {
  return String(text)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
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

function resolveInputPath(inputPath) {
  return isAbsolute(inputPath) ? inputPath : resolve(root, inputPath);
}

function assertOutsideRepository(path, label) {
  const rel = relative(root, path).replaceAll("\\", "/");
  assert.ok(rel.startsWith("../") || rel === ".." || isAbsolute(rel), `${label} must be outside the repository`);
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a private path`);
  assert.doesNotMatch(text, privateTagPattern, `${label} contains private tags`);
  assert.doesNotMatch(text, /fixture-personal|fixture-agent|fixture-doc-alpha|fixture-doc-beta|fixture-doc-gamma/i, `${label} contains raw fixture mirror data`);
  assert.doesNotMatch(text, /"\s*(?:content|memory|text|raw|rawText|document|q|id)"\s*:/i, `${label} contains raw memory, query, or id fields`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (!item.startsWith("--")) continue;
    const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
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
