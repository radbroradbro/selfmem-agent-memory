import assert from "node:assert/strict";
import { createServer } from "node:http";

const args = parseArgs(process.argv.slice(2));
const host = String(args.host ?? process.env.SELFMEM_LOCAL_RERANK_SIDECAR_HOST ?? "127.0.0.1");
const port = positiveInt(args.port ?? process.env.SELFMEM_LOCAL_RERANK_SIDECAR_PORT ?? 8092, "port");
const chatBaseUrl = String(
  args.chatBaseUrl ?? process.env.SELFMEM_LOCAL_RERANK_CHAT_BASE_URL ?? process.env.RECALLWEAVE_MEMORYBENCH_BASE_URL ?? "http://127.0.0.1:8080/v1",
).replace(/\/+$/, "");
const chatModel = String(
  args.chatModel ??
    process.env.SELFMEM_LOCAL_RERANK_CHAT_MODEL ??
    process.env.RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL ??
    process.env.SELFMEM_QUERY_EXPANSION_MODEL ??
    "local-openai-compatible-rerank",
);
const maxDocuments = positiveInt(args.maxDocuments ?? process.env.SELFMEM_LOCAL_RERANK_MAX_DOCUMENTS ?? 40, "max documents");
const maxDocumentChars = positiveInt(args.maxDocumentChars ?? process.env.SELFMEM_LOCAL_RERANK_MAX_DOCUMENT_CHARS ?? 700, "max document chars");
const timeoutMs = positiveInt(args.timeoutMs ?? process.env.SELFMEM_LOCAL_RERANK_TIMEOUT_MS ?? 120_000, "timeout ms");
const requestMaxBytes = positiveInt(args.requestMaxBytes ?? process.env.SELFMEM_LOCAL_RERANK_REQUEST_MAX_BYTES ?? 2_000_000, "request max bytes");
const maxOutputTokens = positiveInt(args.maxOutputTokens ?? process.env.SELFMEM_LOCAL_RERANK_MAX_OUTPUT_TOKENS ?? 1024, "max output tokens");

if (args.help) {
  process.stdout.write(
    [
      "Usage: node packages/bench/local-openai-rerank-sidecar.mjs [--host 127.0.0.1] [--port 8092]",
      "",
      "Environment:",
      "  SELFMEM_LOCAL_RERANK_CHAT_BASE_URL  OpenAI-compatible local chat base URL",
      "  SELFMEM_LOCAL_RERANK_CHAT_MODEL     Local chat model used for reranking",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${host}:${port}`);
    if (request.method === "GET" && (url.pathname === "/healthz" || url.pathname === "/health")) {
      writeJson(response, 200, { ok: true, mode: "local-openai-rerank-sidecar", model: chatModel });
      return;
    }
    if (request.method === "GET" && (url.pathname === "/v1/models" || url.pathname === "/models")) {
      writeJson(response, 200, {
        object: "list",
        data: [{ id: chatModel, object: "model", owned_by: "local-openai-rerank-sidecar" }],
      });
      return;
    }
    if (request.method !== "POST" || !["/v1/rerank", "/rerank"].includes(url.pathname)) {
      writeJson(response, 404, { error: "not found" });
      return;
    }
    const payload = JSON.parse(await readBody(request));
    const result = await rerank(payload);
    writeJson(response, 200, result);
  } catch (error) {
    writeJson(response, 500, {
      error: "local rerank failed",
      detail: safeError(error?.message ?? error),
    });
  }
});

server.listen(port, host, () => {
  process.stdout.write(`local-openai-rerank-sidecar ready at http://${host}:${port}/v1/rerank using ${chatModel}\n`);
});

async function rerank(payload) {
  const query = providerSafeText(payload?.query?.text ?? payload?.query).trim();
  const documents = coerceDocuments(payload?.documents ?? payload?.passages ?? payload?.texts);
  assert.ok(query, "query is required");
  assert.ok(documents.length > 0, "documents are required");
  assert.ok(documents.length <= maxDocuments, `too many documents; max ${maxDocuments}`);

  const prompt = [
    "Score each document for how well it helps answer the query.",
    "Return JSON only with one key named scores.",
    "scores must be an array of numbers from 0 to 1 in the same order as the documents.",
    "",
    `Query: ${query}`,
    "",
    "Documents:",
    ...documents.map((document, index) => `[${index}] ${clipDocument(document)}`),
  ].join("\n");

  const text = await callChat(prompt);
  const scores = normalizeScores(parseScores(text), documents.length);
  const ranked = scores
    .map((score, index) => ({ index, score }))
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const topN = Math.min(documents.length, positiveInt(payload?.top_n ?? payload?.topK ?? payload?.top_k ?? documents.length, "top_n"));
  return {
    model: String(payload?.model ?? chatModel),
    object: "list",
    results: ranked.slice(0, topN),
    data: ranked.slice(0, topN),
    usage: {
      queryCount: 1,
      documentCount: documents.length,
      localChatCalls: 1,
    },
  };
}

async function callChat(prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(chatCompletionsUrl(chatBaseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: chatModel,
        temperature: 0,
        max_tokens: maxOutputTokens,
        response_format: { type: "json_object" },
        chat_template_kwargs: { enable_thinking: false, preserve_thinking: false },
        messages: [
          { role: "system", content: "You are a local numeric reranker. Return valid JSON only." },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    const raw = await response.text();
    assert.ok(response.ok, `chat endpoint returned HTTP ${response.status}: ${safeError(raw)}`);
    const json = JSON.parse(raw);
    const content = json?.choices?.[0]?.message?.content ?? json?.choices?.[0]?.text ?? "";
    assert.ok(String(content).trim(), "chat endpoint returned empty rerank content");
    return String(content);
  } finally {
    clearTimeout(timeout);
  }
}

function parseScores(text) {
  const normalized = String(text ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const json = JSON.parse(extractJsonObject(normalized));
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.scores)) return json.scores;
  if (Array.isArray(json.results)) return json.results.map((item) => item.score ?? item.relevance_score ?? item.value);
  if (Array.isArray(json.rankings)) return json.rankings.map((item) => item.score ?? item.relevance_score ?? item.value);
  throw new Error("rerank response did not contain scores");
}

function normalizeScores(values, expectedLength) {
  assert.equal(values.length, expectedLength, "rerank score count mismatch");
  return values.map((value) => {
    const number = Number(value);
    assert.ok(Number.isFinite(number), "rerank score must be numeric");
    if (number > 1) return Math.max(0, Math.min(1, number / 100));
    return Math.max(0, Math.min(1, number));
  });
}

function coerceDocuments(value) {
  assert.ok(Array.isArray(value), "documents must be an array");
  return value.map((item) => {
    if (typeof item === "string") return item;
    if (typeof item?.text === "string") return item.text;
    if (typeof item?.content === "string") return item.content;
    if (typeof item?.document === "string") return item.document;
    return "";
  });
}

function clipDocument(value) {
  return providerSafeText(value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxDocumentChars);
}

function providerSafeText(value) {
  const text = String(value ?? "");
  if (typeof text.toWellFormed === "function") return text.toWellFormed();
  return text.replace(/[\uD800-\uDFFF]/g, " ");
}

function extractJsonObject(text) {
  const trimmed = String(text ?? "").trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function chatCompletionsUrl(baseUrl) {
  const normalized = String(baseUrl ?? "").replace(/\/+$/, "");
  if (normalized.endsWith("/chat/completions")) return normalized;
  return normalized.endsWith("/v1") ? `${normalized}/chat/completions` : `${normalized}/v1/chat/completions`;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      total += chunk.length;
      if (total > requestMaxBytes) {
        reject(new Error("request body too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function writeJson(response, status, value) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(`${JSON.stringify(value)}\n`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    parsed[key] = !next || next.startsWith("--") ? true : next;
    if (parsed[key] !== true) index += 1;
  }
  return parsed;
}

function positiveInt(value, label) {
  const parsed = Number(value);
  assert.ok(Number.isInteger(parsed) && parsed > 0, `${label} must be a positive integer`);
  return parsed;
}

function safeError(value) {
  return String(value ?? "")
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/g, "$1<redacted>")
    .replace(/(sk-(?:proj-)?)[A-Za-z0-9_-]+/g, "$1<redacted>")
    .replace(/(AIza)[A-Za-z0-9_-]+/g, "$1<redacted>")
    .slice(0, 300);
}
