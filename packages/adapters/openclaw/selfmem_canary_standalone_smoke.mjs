#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pluginDefinition, { createSelfmemOpenClawCanary } from "./selfmem_canary/index.mjs";

const home = mkdtempSync(join(tmpdir(), "selfmem-openclaw-smoke-"));
const providerCalls = { embeddings: 0, rerank: 0, supermemory: 0 };
globalThis.fetch = async (url, options = {}) => {
  const href = String(url);
  const body = JSON.parse(String(options.body || "{}"));
  if (href.includes("/embeddings")) {
    providerCalls.embeddings += 1;
    const input = Array.isArray(body.input) ? body.input : [];
    return new Response(JSON.stringify({
      data: input.map((text, index) => ({
        index,
        embedding: embeddingFor(String(text)),
      })),
      usage: { total_tokens: input.join(" ").split(/\s+/).filter(Boolean).length },
    }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (href.includes("/rerank")) {
    providerCalls.rerank += 1;
    const documents = Array.isArray(body.documents) ? body.documents : [];
    return new Response(JSON.stringify({
      data: documents.map((document, index) => ({
        index,
        relevance_score: String(document).toLowerCase().includes("openclaw") ? 0.98 : 0.4,
      })).sort((a, b) => b.relevance_score - a.relevance_score),
      usage: { total_tokens: documents.join(" ").split(/\s+/).filter(Boolean).length },
    }), { status: 200, headers: { "content-type": "application/json" } });
  }
  providerCalls.supermemory += 1;
  return new Response(JSON.stringify({
    results: [{
      id: "remote-smoke",
      memory: "Remote Supermemory history remains searchable while OpenClaw writes new memories locally.",
      similarity: 0.91,
    }],
  }), { status: 200, headers: { "content-type": "application/json" } });
};
const plugin = createSelfmemOpenClawCanary({
  home,
  agentIdentity: "openclaw-standalone-agent",
  supermemoryContainer: "openclaw_standalone_source",
  supermemoryKey: "test-read-through-key",
  voyageKeys: ["test-voyage-key"],
});

const session = plugin.session_start({ id: "openclaw-smoke" });
const store = plugin.tools.supermemory_store({
  content: "OpenClaw selfmem canary should capture agent_end and retrieve before prompt build.",
});
const search = await plugin.tools.supermemory_search({
  query: "OpenClaw canary retrieve before prompt",
  limit: 5,
});
const pre = await plugin.before_prompt_build({ query: "What should OpenClaw selfmem canary do?" });
const skippedPre = await plugin.before_prompt_build({ query: "heartbeat diagnostic status check ping" });
const statusLikeRealPre = await plugin.before_prompt_build({ query: "What is the status decision for OpenClaw memory retrieval?" });
plugin.agent_end({ summary: "Decision: OpenClaw agent_end writes distilled local RecallWeave memory for this agent only." });
plugin.compression_checkpoint({
  event: "lcm_pre_compress",
  summary: "LCM compression checkpoint should preserve durable local memory before compaction.",
});
const status = plugin.tools.supermemory_status();

const envHome = mkdtempSync(join(tmpdir(), "selfmem-openclaw-state-dir-"));
writeFileSync(join(envHome, "profile-identity.json"), JSON.stringify({
  agent_identity: "state-dir-agent",
  source_supermemory_container: "state_dir_source",
  local_container: "selfmem_state_dir_source",
}, null, 2));
const oldStateDir = process.env.OPENCLAW_STATE_DIR;
process.env.OPENCLAW_STATE_DIR = envHome;
const stateDirPlugin = createSelfmemOpenClawCanary({
  supermemoryKey: "test-read-through-key",
  voyageKeys: ["test-voyage-key"],
});
const stateDirStatus = stateDirPlugin.tools.selfmem_status();
if (oldStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
else process.env.OPENCLAW_STATE_DIR = oldStateDir;

const readOnlyHome = mkdtempSync(join(tmpdir(), "selfmem-openclaw-readonly-"));
const readOnlyPlugin = createSelfmemOpenClawCanary({ home: readOnlyHome });
const readOnlyStore = readOnlyPlugin.tools.selfmem_store({
  content: "This should not write because identity is unresolved.",
});
const readOnlyStatus = readOnlyPlugin.tools.selfmem_status();

const registered = { tools: [], events: [], services: [], memoryCapability: false };
pluginDefinition.register({
  pluginConfig: {
    home,
    agentIdentity: "openclaw-standalone-agent",
    sourceSupermemoryContainer: "openclaw_standalone_source",
    supermemoryReadKey: "test-read-through-key",
    voyageKeys: ["test-voyage-key"],
  },
  logger: { info() {}, warn() {}, error() {}, debug() {} },
  registerTool(tool, options) { registered.tools.push(options?.name || tool.name); },
  on(event, handler) { registered.events.push(event); registered[`handler_${event}`] = handler; },
  registerService(service) { registered.services.push(service.id); },
  registerMemoryCapability() { registered.memoryCapability = true; },
});

const traceText = readFileSync(join(home, "selfmem", "containers", "selfmem_openclaw_standalone_source", "trace.jsonl"), "utf8");
const rawText = readFileSync(join(home, "selfmem", "containers", "selfmem_openclaw_standalone_source", "raw_events.jsonl"), "utf8");
const traceEvents = traceText.split(/\n+/).filter(Boolean).map((line) => JSON.parse(line));
const searchTrace = traceEvents.find((item) => item.event === "search" && item.data?.supermemory_attempted === true);
const storeTraces = traceEvents.filter((item) => item.event === "store");
const audit = JSON.parse(execFileSync("python3", [
  new URL("./selfmem_audit.py", import.meta.url).pathname,
  "--home",
  home,
  "--json",
], { encoding: "utf8" }));

const output = {
  ok: true,
  sessionLocalContainer: session.local_container,
  sourceSupermemoryContainer: status.source_supermemory_container,
  localContainer: status.local_container,
  boundedReadThroughPolicyCovered: status.search_policy === "local_first_then_bounded_supermemory_read_through"
    && status.recall_policy?.remote_read_through === "explicit_history_intent_or_thin_local_results",
  searchLatencyInstrumentationCovered: Number(searchTrace?.data?.elapsed_ms || 0) > 0
    && Number(searchTrace?.data?.local_elapsed_ms || 0) > 0
    && Number(searchTrace?.data?.remote_elapsed_ms || 0) > 0,
  storeLatencyInstrumentationCovered: storeTraces.length > 0
    && storeTraces.every((item) => Number(item.data?.elapsed_ms || 0) > 0),
  storeLatencySampleCount: storeTraces.filter((item) => Number(item.data?.elapsed_ms || 0) > 0).length,
  aliasStoreSuccess: Boolean(store.success),
  aliasSearchResultCount: search.results.length,
  hybridSearchCovered: search.results.some((item) => item.memory_source === "supermemory_read_through"),
  voyageEnabled: Boolean(status.voyage_enabled),
  voyageCallsCovered: Number(status.usage?.embedding_calls || 0) > 0 && Number(status.usage?.rerank_calls || 0) > 0,
  embeddingCacheCovered: providerCalls.embeddings <= 5 && Number(status.usage?.embedding_cache_hits || 0) > 0,
  maintenanceRecallGateCovered: skippedPre === "" && traceText.includes("before_prompt_build_skipped"),
  statusLikeRecallCovered: statusLikeRealPre.includes("<selfmem-context>"),
  openclawStateDirCovered: stateDirStatus.local_container === "selfmem_state_dir_source" && existsSync(join(envHome, "selfmem", "containers", "selfmem_state_dir_source", "container-map.json")),
  identityPinCovered: stateDirStatus.agent_identity === "state-dir-agent" && stateDirStatus.identity_resolved === true && stateDirStatus.read_only === false,
  readOnlyCovered: readOnlyStatus.read_only === true && readOnlyStore.success === false,
  pluginEntryCovered: pluginDefinition.id === "selfmem_canary" && registered.tools.includes("supermemory_search") && registered.events.includes("before_prompt_build") && registered.memoryCapability,
  compressionCheckpointCovered: traceText.includes("compression_checkpoint") && rawText.includes("compression_checkpoint_raw"),
  auditCovered: audit.summary?.containerCount >= 1 && audit.summary?.privacyLeakCount === 0,
  beforePromptHasContext: pre.includes("<selfmem-context>"),
  lifecycleCovered: traceText.includes("session_start") && traceText.includes("before_prompt_build") && traceText.includes("agent_end"),
  rawAuditCovered: rawText.includes("agent_end_raw"),
  privacyLeakCount: countLeaks(`${traceText}\n${rawText}\n${pre}`),
};

console.log(JSON.stringify(output, null, 2));

if (!output.boundedReadThroughPolicyCovered || !output.searchLatencyInstrumentationCovered || !output.storeLatencyInstrumentationCovered || !output.aliasStoreSuccess || output.aliasSearchResultCount < 1 || !output.hybridSearchCovered || !output.voyageEnabled || !output.voyageCallsCovered || !output.embeddingCacheCovered || !output.maintenanceRecallGateCovered || !output.statusLikeRecallCovered || !output.openclawStateDirCovered || !output.identityPinCovered || !output.readOnlyCovered || !output.pluginEntryCovered || !output.compressionCheckpointCovered || !output.auditCovered || !output.beforePromptHasContext || !output.lifecycleCovered || !output.rawAuditCovered || output.privacyLeakCount !== 0) {
  process.exit(1);
}

function embeddingFor(text) {
  const lower = text.toLowerCase();
  return [
    lower.includes("openclaw") ? 1 : 0.1,
    lower.includes("memory") ? 1 : 0.1,
    lower.includes("remote") ? 1 : 0.1,
  ];
}

function countLeaks(text) {
  return [
    /<\/?private>/,
    /pa-[A-Za-z0-9_-]{20,}/,
    /nvapi-[A-Za-z0-9_-]{20,}/,
    /jina_[A-Za-z0-9_-]{20,}/,
    /sk-[A-Za-z0-9_-]{20,}/,
    /sm_[A-Za-z0-9_-]{20,}/,
    /AIza[0-9A-Za-z_-]{20,}/,
  ].filter((pattern) => pattern.test(text)).length;
}
