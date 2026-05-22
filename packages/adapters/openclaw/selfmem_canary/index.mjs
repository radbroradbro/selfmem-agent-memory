import { mkdirSync, readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { homedir } from "node:os";

const DEFAULT_LIMIT = 5;
const DEFAULT_RERANK_CANDIDATE_LIMIT = 20;
const DEFAULT_RERANK_TOKEN_BUDGET = 50000;
const SUPERMEMORY_SEARCH_URL = "https://api.supermemory.ai/v4/search";
const VOYAGE_EMBED_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_RERANK_URL = "https://api.voyageai.com/v1/rerank";
const VOYAGE_EMBED_MODEL = "voyage-4-large";
const VOYAGE_RERANK_MODEL = "rerank-2.5";
const VOYAGE_DIMENSIONS = 1024;
const COMPRESSION_EVENT_NAMES = [
  "pre_compress",
  "before_compress",
  "before_context_compress",
  "lcm_pre_compress",
  "context_pre_compress",
  "memory_pre_compress",
];
const KEY_PATTERNS = [
  /pa-[A-Za-z0-9_-]{40,}/g,
  /AIza[0-9A-Za-z_-]{30,}/g,
  /jina_[0-9A-Za-z_-]{20,}/g,
  /sk-[A-Za-z0-9_-]{32,}/g,
  /sm_[A-Za-z0-9_-]{40,}/g,
  /nvapi-[A-Za-z0-9_-]{32,}/g,
];
const MAINTENANCE_RE = /\b(heartbeat|cron|watchdog|diagnostic|doctor|reliability|status|healthcheck|health check|memory monitor|silent run|update check|ping|no-op|noop)\b/i;
const RECALL_INTENT_RE = /\b(remember|recall|retrieve|search memory|find memory|durable|preference|decision|bug|fix|workflow|container|lcm|compress|compression|identity|profile)\b/i;

export function createSelfmemOpenClawCanary(options = {}) {
  const home = resolveOpenClawHome(options);
  loadSelfmemEnv(home);
  const identityPin = loadProfileIdentityPin(home);
  const configuredIdentity = options.agentIdentity || process.env.OPENCLAW_AGENT_IDENTITY || process.env.OPENCLAW_BOT_NAME || identityPin.agent_identity || identityPin.agentIdentity || identityPin.bot_name || identityPin.botName || identityPin.name || "";
  const identityResolved = Boolean(configuredIdentity && configuredIdentity !== "unknown-agent");
  const agentIdentity = configuredIdentity || "unknown-agent";
  const setup = loadAgentSetup(home, agentIdentity);
  const sourceSupermemoryContainer = options.supermemoryContainer || setup.source_supermemory_container || identityPin.source_supermemory_container || identityPin.sourceSupermemoryContainer || identityPin.supermemory_container || identityPin.supermemoryContainer || process.env.SELFMEM_SOURCE_SUPERMEMORY_CONTAINER || process.env.SUPERMEMORY_CONTAINER_TAG || "";
  const readOnly = Boolean(options.readOnly || setup.read_only || setup.readOnly || identityPin.read_only || identityPin.readOnly || !identityResolved);
  const localContainer = options.localContainer || setup.local_container || setup.localSelfmemContainer || identityPin.local_container || identityPin.localSelfmemContainer || localContainerFor(sourceSupermemoryContainer || agentIdentity);
  const storeDir = join(home, "selfmem", "containers", safeName(localContainer));
  mkdirSync(storeDir, { recursive: true });
  const paths = {
    memories: join(storeDir, "memories.jsonl"),
    trace: join(storeDir, "trace.jsonl"),
    raw: join(storeDir, "raw_events.jsonl"),
    containerMap: join(storeDir, "container-map.json"),
  };
  writeFileSync(paths.containerMap, JSON.stringify({
    host: "openclaw",
    agent_identity: agentIdentity,
    source_supermemory_container: sourceSupermemoryContainer || null,
    local_container: localContainer,
    store_dir: storeDir,
    mode: "local-write-supermemory-read-through",
    search_policy: "union_local_and_supermemory_read_through",
    identity_resolved: identityResolved,
    read_only: readOnly,
  }, null, 2));

  const state = { home, agentIdentity, identityResolved, readOnly, sourceSupermemoryContainer, localContainer, storeDir, paths };
  state.supermemoryKey = options.supermemoryKey || process.env.SELFMEM_SUPERMEMORY_READ_KEY || process.env.SUPERMEMORY_READ_API_KEY || process.env.SUPERMEMORY_API_KEY || process.env.SUPERMEMORY_CC_API_KEY || "";
  state.supermemoryReadThrough = Boolean(state.supermemoryKey && sourceSupermemoryContainer && process.env.SELFMEM_SUPERMEMORY_READ_THROUGH !== "0");
  state.voyageKeys = options.voyageKeys || voyageKeysFromEnv();
  state.voyageKeyIndex = 0;
  state.usage = {
    embedding_tokens: 0,
    rerank_tokens: 0,
    embedding_calls: 0,
    rerank_calls: 0,
    embedding_cache_hits: 0,
    embedding_cache_misses: 0,
    recall_skipped: 0,
    dedupe_suppressed: 0,
  };
  state.providerMode = `${state.voyageKeys.length ? `${VOYAGE_EMBED_MODEL}+${VOYAGE_RERANK_MODEL}` : "local_lexical"}${state.supermemoryReadThrough ? "+supermemory-read-through" : ""}`;
  return {
    kind: "memory",
    name: "selfmem_canary",
    id: "selfmem_canary",
    tools: makeTools(state),
    session_start(session = {}) {
      trace(state, "session_start", { session_id: session.id || session.session_id || "", local_container: localContainer });
      return status(state);
    },
    async before_prompt_build(input = {}) {
      const query = coerceText(input.query || input.prompt || input.message || input.content || "");
      if (isCompressionLike(input)) {
        trace(state, "lcm_after_compression_prompt_build", {
          query: query.slice(0, 160),
          keys: Object.keys(input).slice(0, 20),
        });
      }
      const decision = shouldRecall(input, query);
      if (!decision.recall) {
        state.usage.recall_skipped += 1;
        trace(state, "before_prompt_build_skipped", {
          reason: decision.reason,
          query: query.slice(0, 160),
          keys: Object.keys(input || {}).slice(0, 20),
        });
        return "";
      }
      const results = await search(state, query, DEFAULT_LIMIT);
      trace(state, "before_prompt_build", { query: query.slice(0, 160), result_count: results.length });
      if (!results.length) return "";
      return ["<selfmem-context>", "## Relevant selfmem OpenClaw canary memories", ...results.map((item) => `- [${sourceLabel(item)} ${item.id}] ${item.content}`), "</selfmem-context>"].join("\n");
    },
    agent_end(event = {}) {
      const content = coerceText(event.summary || event.content || event.message || event.output || "");
      if (state.readOnly) {
        trace(state, "agent_end_write_suppressed", { reason: "identity-unresolved-or-read-only", content_length: content.length });
        return;
      }
      rawEvent(state, "agent_end_raw", { content });
      if (content.trim()) store(state, content, { source: "openclaw", type: "agent_end" });
      trace(state, "agent_end", { stored: Boolean(content.trim()) });
    },
    compression_checkpoint(event = {}) {
      return compressionCheckpoint(state, event);
    },
    status() {
      return status(state);
    },
  };
}

function makeTools(state) {
  return {
    selfmem_store: (args = {}) => toolStore(state, args),
    selfmem_search: async (args = {}) => ({ results: await search(state, coerceText(args.query || ""), clampLimit(args.limit)) }),
    selfmem_forget: (args = {}) => forget(state, String(args.id || ""), coerceText(args.query || "")),
    selfmem_profile: async (args = {}) => ({ profile: (await search(state, coerceText(args.query || ""), DEFAULT_LIMIT)).map((item) => item.content) }),
    selfmem_status: () => status(state),
    supermemory_store: (args = {}) => toolStore(state, args),
    supermemory_search: async (args = {}) => ({ results: await search(state, coerceText(args.query || ""), clampLimit(args.limit)) }),
    supermemory_forget: (args = {}) => forget(state, String(args.id || ""), coerceText(args.query || "")),
    supermemory_profile: async (args = {}) => ({ profile: (await search(state, coerceText(args.query || ""), DEFAULT_LIMIT)).map((item) => item.content) }),
    supermemory_status: () => status(state),
  };
}

function toolStore(state, args) {
  if (state.readOnly) return { success: false, message: "Read-only mode: identity is unresolved, so writes are suppressed." };
  const redacted = redact(coerceText(args.content || ""));
  if (redacted.fullyPrivate) return { success: false, message: "Rejected fully private memory." };
  const item = store(state, redacted.text, { source: "tool", metadata: args.metadata || {}, redacted: redacted.redacted });
  return { success: true, id: item.id, redacted: redacted.redacted };
}

function store(state, content, metadata = {}) {
  if (state.readOnly) throw new Error("Read-only mode: identity is unresolved, so writes are suppressed.");
  const redacted = redact(content);
  if (redacted.fullyPrivate) throw new Error("Cannot store fully private memory.");
  const distilled = distill(redacted.text, metadata) || redacted.text.slice(0, 1200);
  const existing = findDuplicate(state, distilled);
  if (existing) {
    state.usage.dedupe_suppressed += 1;
    trace(state, "store_deduped", { id: existing.id, local_container: state.localContainer });
    return existing;
  }
  const item = {
    id: `selfmem-${Date.now()}-${sha256(distilled).slice(0, 10)}`,
    created_at: new Date().toISOString(),
    content: distilled,
    raw_ref: `raw:${sha256(redacted.text).slice(0, 24)}`,
    metadata: {
      ...metadata,
      distilled: true,
      host: "openclaw",
      agent_identity: state.agentIdentity,
      local_container: state.localContainer,
      source_supermemory_container: state.sourceSupermemoryContainer,
    },
  };
  appendFileSync(state.paths.memories, `${JSON.stringify(item)}\n`);
  trace(state, "store", { id: item.id, local_container: state.localContainer });
  return item;
}

function compressionCheckpoint(state, event = {}) {
  const content = coerceText(event.summary || event.content || event.message || event.output || event.compressed || "");
  trace(state, "compression_checkpoint", {
    source_event: event.event || event.type || "unknown",
    content_length: content.length,
    read_only: state.readOnly,
  });
  if (state.readOnly) {
    trace(state, "compression_checkpoint_write_suppressed", { reason: "identity-unresolved-or-read-only", content_length: content.length });
    return { success: false, stored: false, reason: "read-only" };
  }
  if (!content.trim()) {
    return { success: false, stored: false, reason: "empty" };
  }
  rawEvent(state, "compression_checkpoint_raw", { content, event });
  const item = store(state, content, { source: "openclaw", type: "compression_checkpoint" });
  return { success: true, stored: true, id: item.id };
}

async function search(state, query, limit) {
  const local = await searchLocal(state, query, limit);
  let remote = [];
  let remoteError = "";
  if (state.supermemoryReadThrough) {
    try {
      remote = await searchSupermemory(state, query, Math.max(limit * 2, limit));
    } catch (error) {
      remoteError = sanitizeError(error?.message || String(error));
      trace(state, "supermemory_read_through_error", {
        message: remoteError,
        source_supermemory_container: state.sourceSupermemoryContainer || null,
      });
    }
  }
  const results = mergeRanked([local, remote], limit);
  trace(state, "search", {
    query: query.slice(0, 160),
    result_count: results.length,
    local_result_count: results.filter((item) => item.memory_source === "local_selfmem").length,
    supermemory_result_count: results.filter((item) => item.memory_source === "supermemory_read_through").length,
    supermemory_read_through: state.supermemoryReadThrough,
    supermemory_error: remoteError,
    provider_mode: state.providerMode,
    usage: state.usage,
  });
  return results;
}

async function searchLocal(state, query, limit) {
  if (!state.voyageKeys.length) return searchLocalLexical(state, query, limit);
  try {
    return await searchLocalVoyage(state, query, limit);
  } catch (error) {
    trace(state, "voyage_search_error", { message: sanitizeError(error?.message || String(error)) });
    return searchLocalLexical(state, query, limit);
  }
}

function searchLocalLexical(state, query, limit) {
  const queryTokens = new Set(tokens(query));
  if (!queryTokens.size) return [];
  const scored = readAll(state).map((item) => {
    const docTokens = new Set(tokens(item.content || ""));
    let score = 0;
    for (const token of queryTokens) if (docTokens.has(token)) score += 1;
    return { ...item, score, memory_source: "local_selfmem" };
  }).filter((item) => item.score > 0);
  scored.sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)));
  return scored.slice(0, limit).map((item) => {
    const clone = { ...item };
    delete clone.embedding;
    return clone;
  });
}

async function searchLocalVoyage(state, query, limit) {
  const items = readAll(state).slice(-200);
  if (!items.length || !String(query || "").trim()) return [];
  const [queryVector] = await voyageEmbed(state, [query], "query");
  const itemsWithEmbeddings = await ensureDocumentEmbeddings(state, items);
  const candidates = itemsWithEmbeddings.map((item) => ({
    ...item,
    dense_score: cosine(queryVector || [], Array.isArray(item.embedding) ? item.embedding : []),
    memory_source: "local_selfmem",
  })).filter((item) => Number.isFinite(item.dense_score) && item.dense_score > 0);
  candidates.sort((a, b) => b.dense_score - a.dense_score || String(a.id).localeCompare(String(b.id)));
  const topCandidates = candidates.slice(0, Math.min(rerankCandidateLimit(), candidates.length));
  if (!topCandidates.length) return searchLocalLexical(state, query, limit);
  const documents = topCandidates.map((item) => String(item.content || ""));
  if (!canRerank(state, query, documents)) {
    trace(state, "rerank_budget_skipped", {
      candidate_count: topCandidates.length,
      rerank_tokens_used: state.usage.rerank_tokens,
      rerank_token_budget: rerankTokenBudget(),
    });
    return topCandidates.slice(0, limit).map((item) => {
      const clone = { ...item, score: item.dense_score, provider_mode: `${state.providerMode}+dense-budget`, memory_source: "local_selfmem" };
      delete clone.embedding;
      return clone;
    });
  }
  const reranked = await voyageRerank(state, query, documents, Math.min(limit, topCandidates.length));
  return reranked.flatMap((result) => {
    const item = topCandidates[result.index];
    if (!item) return [];
    const clone = { ...item, score: result.score, provider_mode: state.providerMode, memory_source: "local_selfmem" };
    delete clone.embedding;
    return [clone];
  });
}

async function searchSupermemory(state, query, limit) {
  if (!state.supermemoryKey || !state.sourceSupermemoryContainer) return [];
  const response = await fetch(SUPERMEMORY_SEARCH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${state.supermemoryKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      containerTag: state.sourceSupermemoryContainer,
      limit: Math.max(1, Math.min(20, limit)),
      threshold: 0,
      rerank: true,
      rewriteQuery: false,
      searchMode: "memories",
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supermemory read-through HTTP ${response.status}: ${sanitizeError(text)}`);
  }
  const data = JSON.parse(text);
  return (data.results || []).flatMap((item, index) => {
    const redacted = redact(String(item.memory || item.chunk || item.content || "").trim());
    if (redacted.fullyPrivate || !redacted.text.trim()) return [];
    const remoteId = String(item.id || `rank-${index}`);
    return [{
      id: `supermemory:${remoteId}`,
      created_at: "",
      content: redacted.text,
      score: Number(item.similarity || item.score || 0),
      provider_mode: "supermemory_read_through",
      memory_source: "supermemory_read_through",
      metadata: {
        supermemory_id: remoteId,
        source_supermemory_container: state.sourceSupermemoryContainer,
        redacted: redacted.redacted,
      },
    }];
  });
}

async function voyageEmbed(state, texts, inputType) {
  const data = await voyageFetch(state, VOYAGE_EMBED_URL, {
    input: texts,
    model: VOYAGE_EMBED_MODEL,
    input_type: inputType,
    output_dimension: VOYAGE_DIMENSIONS,
    output_dtype: "float",
    truncation: true,
  });
  state.usage.embedding_calls += 1;
  state.usage.embedding_tokens += Number(data.usage?.total_tokens || 0);
  return (data.data || [])
    .sort((a, b) => Number(a.index || 0) - Number(b.index || 0))
    .map((item) => {
      if (!Array.isArray(item.embedding)) throw new Error("Voyage embedding response missing vector.");
      return item.embedding;
    });
}

async function voyageRerank(state, query, documents, topK) {
  const data = await voyageFetch(state, VOYAGE_RERANK_URL, {
    query,
    documents,
    model: VOYAGE_RERANK_MODEL,
    top_k: topK,
    return_documents: false,
    truncation: true,
  });
  state.usage.rerank_calls += 1;
  state.usage.rerank_tokens += Number(data.usage?.total_tokens || 0);
  return (data.data || []).map((item) => ({
    index: Number(item.index ?? -1),
    score: Number(item.relevance_score || 0),
  })).filter((item) => item.index >= 0);
}

async function voyageFetch(state, url, body) {
  if (!state.voyageKeys.length) throw new Error("Voyage key missing.");
  let lastError = "";
  const attempts = Math.max(1, state.voyageKeys.length);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const key = nextVoyageKey(state);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    if (response.ok) {
      return JSON.parse(text);
    }
    lastError = `Voyage HTTP ${response.status}: ${sanitizeError(text)}`;
    trace(state, "voyage_key_fallback", { status: response.status, attempt: attempt + 1 });
    if (![401, 402, 403, 408, 409, 429, 500, 502, 503, 504].includes(response.status)) break;
  }
  throw new Error(lastError || "Voyage request failed.");
}

function nextVoyageKey(state) {
  const key = state.voyageKeys[state.voyageKeyIndex % state.voyageKeys.length];
  state.voyageKeyIndex += 1;
  if (!key) throw new Error("Voyage key rotation produced no key.");
  return key;
}

function mergeRanked(resultSets, limit) {
  const merged = new Map();
  const weights = [1.0, 0.95];
  const rrfK = 60;
  for (const [setIndex, results] of resultSets.entries()) {
    const weight = weights[setIndex] ?? 0.8;
    for (const [rank, item] of results.entries()) {
      const content = String(item.content || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (!content) continue;
      const key = sha256(content);
      const score = weight / (rrfK + rank + 1);
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { ...item, hybrid_score: score });
        continue;
      }
      existing.hybrid_score = Number(existing.hybrid_score || 0) + score;
      if (existing.memory_source !== "local_selfmem" && item.memory_source === "local_selfmem") {
        merged.set(key, { ...item, hybrid_score: existing.hybrid_score });
      }
    }
  }
  return [...merged.values()]
    .sort((a, b) => Number(b.hybrid_score || 0) - Number(a.hybrid_score || 0) || Number(a.memory_source !== "local_selfmem") - Number(b.memory_source !== "local_selfmem") || String(a.id).localeCompare(String(b.id)))
    .slice(0, limit);
}

function forget(state, id, query) {
  const items = readAll(state);
  let target = id.trim();
  if (!target && query.trim()) target = searchLocalLexical(state, query, 1)[0]?.id || "";
  if (target.startsWith("supermemory:")) return { success: false, message: "Read-through Supermemory memories are read-only. Forget only removes local RecallWeave memories." };
  if (!target) return { success: false, message: "No memory id or matching query." };
  const kept = items.filter((item) => item.id !== target);
  if (kept.length === items.length) return { success: false, message: "Memory not found." };
  writeFileSync(state.paths.memories, kept.map((item) => JSON.stringify(item)).join("\n") + "\n");
  trace(state, "forget", { id: target });
  return { success: true, id: target };
}

function readAll(state) {
  if (!existsSync(state.paths.memories)) return [];
  return readFileSync(state.paths.memories, "utf8").split(/\n+/).filter(Boolean).flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
}

function writeAll(state, items) {
  writeFileSync(state.paths.memories, items.map((item) => JSON.stringify(item)).join("\n") + (items.length ? "\n" : ""));
}

async function ensureDocumentEmbeddings(state, recentItems) {
  const allItems = readAll(state);
  const byId = new Map(allItems.map((item) => [item.id, item]));
  const missing = recentItems.filter((item) => !Array.isArray(item.embedding) || !item.embedding.length);
  state.usage.embedding_cache_hits += Math.max(0, recentItems.length - missing.length);
  state.usage.embedding_cache_misses += missing.length;
  if (!missing.length) return recentItems;
  const batch = missing.slice(0, Math.max(1, Math.min(64, Number(process.env.SELFMEM_EMBED_BACKFILL_LIMIT || 64))));
  const embeddings = await voyageEmbed(state, batch.map((item) => String(item.content || "")), "document");
  for (const [index, item] of batch.entries()) {
    const current = byId.get(item.id);
    if (!current || !Array.isArray(embeddings[index])) continue;
    current.embedding = embeddings[index];
    current.embedding_model = VOYAGE_EMBED_MODEL;
    current.embedding_dimensions = VOYAGE_DIMENSIONS;
  }
  writeAll(state, allItems);
  trace(state, "embedding_backfill", { requested: missing.length, embedded: batch.length, total_recent: recentItems.length });
  const refreshedById = new Map(allItems.map((item) => [item.id, item]));
  return recentItems.map((item) => refreshedById.get(item.id) || item);
}

function findDuplicate(state, content) {
  const fingerprint = normalizedContentHash(content);
  return readAll(state).find((item) => normalizedContentHash(item.content || "") === fingerprint);
}

function status(state) {
  return {
    success: true,
    provider: "selfmem_canary",
    host: "openclaw",
    agent_identity: state.agentIdentity,
    identity_resolved: state.identityResolved,
    read_only: state.readOnly,
    source_supermemory_container: state.sourceSupermemoryContainer || null,
    local_container: state.localContainer,
    supermemory_read_through: state.supermemoryReadThrough,
    search_policy: "union_local_and_supermemory_read_through",
    provider_mode: state.providerMode,
    voyage_enabled: state.voyageKeys.length > 0,
    recall_policy: {
      auto_recall_gate: process.env.SELFMEM_RECALL_EVERY_TURN === "1" ? "every_turn" : "skip_obvious_maintenance",
      rerank_candidate_limit: rerankCandidateLimit(),
      rerank_token_budget: rerankTokenBudget(),
      embedding_backfill_limit: Math.max(1, Math.min(64, Number(process.env.SELFMEM_EMBED_BACKFILL_LIMIT || 64))),
    },
    live_credentials: {
      semantic_provider: state.voyageKeys.length > 0 ? "voyage" : "missing",
      voyage_key_count: state.voyageKeys.length,
      supermemory_read_key_present: Boolean(state.supermemoryKey),
      supermemory_read_through_ready: Boolean(state.supermemoryReadThrough),
    },
    usage: state.usage,
    memory_count: readAll(state).length,
    store_dir: state.storeDir,
    tool_aliases: ["supermemory_store", "supermemory_search", "supermemory_forget", "supermemory_profile", "supermemory_status"],
  };
}

function trace(state, event, data) {
  appendFileSync(state.paths.trace, `${JSON.stringify({ ts: new Date().toISOString(), event, data: JSON.parse(redact(JSON.stringify(data)).text) })}\n`);
}

function rawEvent(state, event, data) {
  appendFileSync(state.paths.raw, `${JSON.stringify({ ts: new Date().toISOString(), event, data: JSON.parse(redact(JSON.stringify(data)).text) })}\n`);
}

function distill(content, metadata = {}) {
  const source = String(metadata.type || metadata.source || "");
  const candidates = String(content).split(/\n+|(?<=[.!?])\s+/).map((line) => line.replace(/\s+/g, " ").trim()).filter((line) => line.length >= 24 && !isScaffold(line));
  const ranked = candidates.map((line) => ({ line, kind: classify(line, source), score: distillScore(line) })).filter((item) => item.score > 0);
  ranked.sort((a, b) => b.score - a.score || a.line.length - b.line.length);
  const best = ranked[0];
  return best ? `${best.kind}: ${best.line.slice(0, 360)}` : "";
}

function coerceText(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(coerceText).filter(Boolean).join("\n");
  if (typeof value === "object") {
    if (typeof value.text === "string") return value.text;
    if (typeof value.content !== "undefined") return coerceText(value.content);
    if (typeof value.message !== "undefined") return coerceText(value.message);
    if (typeof value.summary !== "undefined") return coerceText(value.summary);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function shouldRecall(input, query) {
  if (process.env.SELFMEM_RECALL_EVERY_TURN === "1") return { recall: true, reason: "forced" };
  const text = coerceText(query || input).replace(/\s+/g, " ").trim();
  if (text.length < 8 || tokens(text).length < 2) return { recall: false, reason: "empty-or-trivial" };
  if (MAINTENANCE_RE.test(text) && !RECALL_INTENT_RE.test(text)) return { recall: false, reason: "maintenance" };
  return { recall: true, reason: "normal" };
}

function classify(text, source) {
  const lower = text.toLowerCase();
  if (/\b(prefer|preference|likes?|wants?|style|tone)\b/.test(lower)) return "Preference";
  if (/\b(decision|decided|default|keep|route|canonical|policy|should|must|do not)\b/.test(lower)) return "Decision";
  if (/\b(command|install|setup|configure|run|workflow|hook|script|path|env|vm|gateway|lcm|compress)\b/.test(lower)) return "Procedure";
  if (/\b(bug|error|failure|issue|blocked|quota|maxed|limit|leak|redact)\b/.test(lower)) return "Bug";
  if (/\b(fix|fixed|resolved|patched|hardened|fallback|degrade)\b/.test(lower)) return "Fix";
  return source ? "Fact" : "Conversation";
}

function distillScore(text) {
  const lower = text.toLowerCase();
  let score = 0;
  if (/\b(remember|important|durable|preference|decision|workflow|gotcha|fixed|default|lcm|compress|memory)\b/.test(lower)) score += 2;
  if (/\b(secret|api key|token|password|credential)\b/.test(lower)) score -= 2;
  return score;
}

function isScaffold(text) {
  return /^(review the conversation above|if something stands out|if nothing is worth saving|nothing to save|has the user expressed|should this be preserved|system:|developer:|tool:)/i.test(text) || /\?\s*$/.test(text);
}

function redact(input) {
  let output = String(input || "");
  let count = 0;
  output = output.replace(/<private>[\s\S]*?(?:<\/private>|$)/gi, () => {
    count += 1;
    return "[REDACTED_PRIVATE]";
  });
  for (const pattern of KEY_PATTERNS) {
    output = output.replace(pattern, () => {
      count += 1;
      return "[REDACTED_KEY]";
    });
  }
  const visible = output.replace(/\[[A-Z0-9_]+\]/g, "").trim();
  return { text: output, redacted: count > 0, redaction_count: count, fullyPrivate: visible.length === 0 };
}

function tokens(text) {
  return String(text || "").toLowerCase().replace(/containertag/g, "container tag").split(/[^a-z0-9_/-]+/).map((token) => token.replace(/^[_/-]+|[_/-]+$/g, "")).filter((token) => token.length > 1);
}

function normalizedContentHash(text) {
  return sha256(String(text || "").toLowerCase().replace(/\s+/g, " ").trim());
}

function rerankCandidateLimit() {
  const configured = Number(process.env.SELFMEM_RERANK_CANDIDATE_LIMIT || DEFAULT_RERANK_CANDIDATE_LIMIT);
  return Math.max(4, Math.min(50, Number.isFinite(configured) ? configured : DEFAULT_RERANK_CANDIDATE_LIMIT));
}

function rerankTokenBudget() {
  const configured = Number(process.env.SELFMEM_RERANK_TOKEN_BUDGET || DEFAULT_RERANK_TOKEN_BUDGET);
  if (!Number.isFinite(configured)) return DEFAULT_RERANK_TOKEN_BUDGET;
  return Math.max(0, Math.floor(configured));
}

function canRerank(state, query, documents) {
  const budget = rerankTokenBudget();
  if (budget === 0) return true;
  const estimatedTokens = estimateTokens([query, ...documents].join(" "));
  return Number(state.usage.rerank_tokens || 0) + estimatedTokens <= budget;
}

function estimateTokens(text) {
  return Math.ceil(String(text || "").split(/\s+/).filter(Boolean).length * 1.35);
}

function voyageKeysFromEnv() {
  return [...new Set([
    ...(process.env.SELFMEM_VOYAGE_API_KEYS || "").split(","),
    ...(process.env.VOYAGE_API_KEYS || "").split(","),
    process.env.SELFMEM_VOYAGE_API_KEY || "",
    process.env.VOYAGE_API_KEY || "",
  ].map((key) => key.trim()).filter(Boolean))];
}

function cosine(a, b) {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let index = 0; index < length; index += 1) {
    const av = Number(a[index] || 0);
    const bv = Number(b[index] || 0);
    dot += av * bv;
    aNorm += av * av;
    bNorm += bv * bv;
  }
  if (!aNorm || !bNorm) return 0;
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}

function clampLimit(value) {
  const numeric = Number(value || DEFAULT_LIMIT);
  return Math.max(1, Math.min(20, Number.isFinite(numeric) ? numeric : DEFAULT_LIMIT));
}

function resolveOpenClawHome(options = {}) {
  return options.home || process.env.OPENCLAW_STATE_DIR || process.env.OPENCLAW_HOME || join(homedir(), ".openclaw");
}

function loadSelfmemEnv(home) {
  const files = [
    join(home, "selfmem", "keys.env"),
    join(home, "selfmem", ".env"),
    join(home, ".env"),
  ];
  for (const file of files) {
    if (!existsSync(file)) continue;
    try {
      const text = readFileSync(file, "utf8");
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const [rawName, ...rawValue] = trimmed.replace(/^export\s+/, "").split("=");
        const name = rawName.trim();
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || process.env[name]) continue;
        process.env[name] = rawValue.join("=").trim().replace(/^['"]|['"]$/g, "");
      }
    } catch {}
  }
}

function loadProfileIdentityPin(home) {
  const paths = [
    join(home, "profile-identity.json"),
    join(home, "selfmem", "profile-identity.json"),
    join(home, "selfmem", "agent-identity.json"),
  ];
  for (const file of paths) {
    if (!existsSync(file)) continue;
    try {
      const data = JSON.parse(readFileSync(file, "utf8"));
      return data && typeof data === "object" ? data : {};
    } catch {}
  }
  return {};
}

function loadAgentSetup(home, agentIdentity) {
  const paths = [
    join(home, "selfmem", "agents", `${safeName(agentIdentity)}.json`),
    join(home, "selfmem", "agent-setup.json"),
  ];
  for (const file of paths) {
    if (!existsSync(file)) continue;
    try {
      const data = JSON.parse(readFileSync(file, "utf8"));
      if (data.agent_identity && data.agent_identity !== agentIdentity) continue;
      return data;
    } catch {}
  }
  return {};
}

function localContainerFor(seed) {
  return `selfmem_${safeName(seed || "unknown-agent")}`.slice(0, 180);
}

function safeName(value) {
  return String(value || "").replace(/[^A-Za-z0-9_.:-]+/g, "_").replace(/^_+|_+$/g, "") || "unknown-agent";
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function sourceLabel(item) {
  if (item.memory_source === "supermemory_read_through") return "supermemory-history";
  if (item.memory_source === "local_selfmem") return "local-selfmem";
  return "memory";
}

function isCompressionLike(value) {
  const serialized = JSON.stringify(value || {}).toLowerCase();
  return /\b(lcm|compress|compressed|compaction|summarize_context|context_summary)\b/.test(serialized);
}

function sanitizeError(message) {
  return redact(String(message || "")).text.slice(0, 500);
}

export function selfmemCanarySetup(api = {}) {
  const cfg = api.pluginConfig && typeof api.pluginConfig === "object" ? api.pluginConfig : {};
  const plugin = createSelfmemOpenClawCanary({
    home: cfg.home || cfg.stateDir,
    agentIdentity: cfg.agentIdentity || cfg.agent_identity,
    supermemoryContainer: cfg.sourceSupermemoryContainer || cfg.source_supermemory_container || cfg.supermemoryContainer || cfg.supermemory_container || cfg.containerTag,
    localContainer: cfg.localSelfmemContainer || cfg.local_container || cfg.localContainer,
    readOnly: cfg.readOnly || cfg.read_only,
    supermemoryKey: cfg.supermemoryReadKey || cfg.supermemory_read_key || cfg.apiKey,
    voyageKeys: Array.isArray(cfg.voyageKeys) ? cfg.voyageKeys : undefined,
  });

  registerOpenClawTools(api, plugin);
  registerOpenClawMemoryCapability(api, plugin);

  if (typeof api.on === "function") {
    api.on("session_start", (event = {}) => plugin.session_start(event));
    api.on("before_prompt_build", async (event = {}) => {
      const context = await plugin.before_prompt_build(event);
      return context ? { prependContext: context } : undefined;
    });
    api.on("agent_end", (event = {}) => plugin.agent_end(event));
    for (const eventName of COMPRESSION_EVENT_NAMES) {
      api.on(eventName, (event = {}) => plugin.compression_checkpoint({ ...event, event: eventName }));
    }
  }

  if (typeof api.registerService === "function") {
    api.registerService({
      id: "selfmem_canary",
      start: () => api.logger?.info?.("selfmem_canary: connected"),
      stop: () => api.logger?.info?.("selfmem_canary: stopped"),
    });
  }

  return plugin;
}

function registerOpenClawTools(api, plugin) {
  if (typeof api.registerTool !== "function") return;
  const definitions = [
    ["selfmem_search", "Memory Search", "Search local RecallWeave plus mapped Supermemory history.", async (params) => plugin.tools.selfmem_search(params)],
    ["selfmem_store", "Memory Store", "Store a new local RecallWeave memory.", async (params) => plugin.tools.selfmem_store(params)],
    ["selfmem_forget", "Memory Forget", "Forget a local RecallWeave memory by id or query.", async (params) => plugin.tools.selfmem_forget(params)],
    ["selfmem_profile", "Memory Profile", "Return a profile summary from RecallWeave recall.", async (params) => plugin.tools.selfmem_profile(params)],
    ["selfmem_status", "Memory Status", "Return RecallWeave status.", async (params) => plugin.tools.selfmem_status(params)],
    ["supermemory_search", "Memory Search", "Compatibility alias for selfmem_search.", async (params) => plugin.tools.supermemory_search(params)],
    ["supermemory_store", "Memory Store", "Compatibility alias for selfmem_store.", async (params) => plugin.tools.supermemory_store(params)],
    ["supermemory_forget", "Memory Forget", "Compatibility alias for selfmem_forget.", async (params) => plugin.tools.supermemory_forget(params)],
    ["supermemory_profile", "Memory Profile", "Compatibility alias for selfmem_profile.", async (params) => plugin.tools.supermemory_profile(params)],
    ["supermemory_status", "Memory Status", "Compatibility alias for selfmem_status.", async (params) => plugin.tools.supermemory_status(params)],
  ];
  for (const [name, label, description, handler] of definitions) {
    api.registerTool({
      name,
      label,
      description,
      parameters: {
        type: "object",
        additionalProperties: true,
        properties: {
          query: { type: "string" },
          content: { type: "string" },
          id: { type: "string" },
          limit: { type: "number" },
          metadata: { type: "object" },
        },
      },
      async execute(_toolCallId, params = {}) {
        const result = await handler(params);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          details: result,
        };
      },
    }, { name });
  }
}

function registerOpenClawMemoryCapability(api, plugin) {
  const runtime = {
    async getMemorySearchManager() {
      return {
        manager: {
          status() {
            const s = plugin.status();
            return {
              backend: "builtin",
              provider: "selfmem_canary",
              model: s.provider_mode,
              files: s.memory_count,
              chunks: s.memory_count,
              custom: s,
            };
          },
          async probeEmbeddingAvailability() {
            return { ok: true };
          },
          async probeVectorAvailability() {
            return true;
          },
          async sync() {},
          async close() {},
        },
      };
    },
    resolveMemoryBackendConfig() {
      return { backend: "builtin" };
    },
  };

  const promptBuilder = ({ availableTools } = {}) => {
    const hasSearch = !availableTools || availableTools.has?.("selfmem_search") || availableTools.has?.("supermemory_search");
    if (!hasSearch) return [];
    return [
      "## Memory (RecallWeave)",
      "",
      "RecallWeave is the active native memory lane. New memories write locally. Old mapped Supermemory history is read-only and may be searched together with local memories.",
      "Use selfmem_search or supermemory_search to recall prior context. Use selfmem_store or supermemory_store only for durable memories.",
    ];
  };

  const capability = {
    runtime,
    promptBuilder,
    flushPlanResolver: () => null,
  };

  if (typeof api.registerMemoryCapability === "function") {
    api.registerMemoryCapability(capability);
  } else {
    api.registerMemoryRuntime?.(runtime);
    api.registerMemoryPromptSection?.(promptBuilder);
    api.registerMemoryFlushPlan?.(() => null);
  }
}

const pluginDefinition = {
  id: "selfmem_canary",
  name: "selfmem_canary",
  description: "Local selfmem memory plugin with per-agent Supermemory read-through.",
  kind: "memory",
  configSchema: {
    type: "object",
    additionalProperties: true,
    properties: {
      agentIdentity: { type: "string" },
      sourceSupermemoryContainer: { type: "string" },
      localSelfmemContainer: { type: "string" },
      readOnly: { type: "boolean" },
      apiKey: { type: "string" },
      supermemoryReadKey: { type: "string" },
      voyageKeys: { type: "array", items: { type: "string" } },
    },
  },
  register: selfmemCanarySetup,
};

export default pluginDefinition;
