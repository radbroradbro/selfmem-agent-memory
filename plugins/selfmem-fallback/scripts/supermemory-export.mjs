#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const args = parseArgs(process.argv.slice(2));
const apiKey = process.env.SUPERMEMORY_API_KEY;

if (!apiKey) {
  console.error("SUPERMEMORY_API_KEY is required.");
  process.exit(2);
}

const outDir = args.out || "./supermemory-export-redacted";
const limit = Number(args.limit || 50);
const maxPages = Number(args.maxPages || 0);
const includeContent = args.includeContent === "true";
const containerTags = args.containerTags ? String(args.containerTags).split(",").map((tag) => tag.trim()).filter(Boolean) : undefined;

await mkdir(outDir, { recursive: true });
await mkdir(join(outDir, "documents"), { recursive: true });
await mkdir(join(outDir, "sources"), { recursive: true });

const report = {
  createdAt: new Date().toISOString(),
  mode: includeContent ? "metadata+redacted-content" : "metadata-only",
  limit,
  maxPages: maxPages || "all",
  containerTags: containerTags || "all",
  apiKeyFingerprint: fingerprint(apiKey),
  pages: 0,
  documents: 0,
  redactions: 0,
  errors: [],
};

let manifest = "";
let page = 1;
let totalPages = 1;

while (page <= totalPages) {
  if (maxPages && page > maxPages) break;
  const body = {
    limit,
    page,
    includeContent,
    order: "desc",
    sort: "updatedAt",
  };
  if (containerTags?.length) body.containerTags = containerTags;

  const result = await postJson("https://api.supermemory.ai/v3/documents/list", body);
  if (!result.ok) {
    report.errors.push({ page, status: result.status, error: result.body?.error, details: result.body?.details });
    break;
  }

  const memories = result.body.memories || [];
  totalPages = Number(result.body.pagination?.totalPages || page);
  report.pages += 1;

  for (const memory of memories) {
    const redacted = redactObject(memory);
    report.redactions += redacted.redactionCount;
    report.documents += 1;

    const id = safeName(memory.id || `doc-${report.documents}`);
    await writeFile(join(outDir, "documents", `${id}.json`), JSON.stringify(redacted.value, null, 2));
    if (typeof redacted.value.content === "string" && redacted.value.content.trim()) {
      await writeFile(join(outDir, "sources", `${id}.md`), redacted.value.content);
    }
    manifest += JSON.stringify({
      id: memory.id,
      customId: memory.customId,
      title: memory.title,
      type: memory.type,
      status: memory.status,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
      containerTags: memory.containerTags,
      contentExported: typeof redacted.value.content === "string",
    }) + "\n";
  }

  page += 1;
}

await writeFile(join(outDir, "manifest.jsonl"), manifest);
await writeFile(join(outDir, "EXPORT_REPORT.json"), JSON.stringify(report, null, 2));
await writeFile(join(outDir, "README.md"), renderReadme(report));

console.log(JSON.stringify({
  outDir,
  documents: report.documents,
  pages: report.pages,
  redactions: report.redactions,
  errors: report.errors.length,
}, null, 2));

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text.slice(0, 500) };
  }
  return { ok: response.ok, status: response.status, body: parsed };
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function fingerprint(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function safeName(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 160);
}

function redactObject(value) {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) {
    let redactionCount = 0;
    const array = value.map((item) => {
      const redacted = redactObject(item);
      redactionCount += redacted.redactionCount;
      return redacted.value;
    });
    return { value: array, redactionCount };
  }
  if (value && typeof value === "object") {
    let redactionCount = 0;
    const object = {};
    for (const [key, item] of Object.entries(value)) {
      const redacted = redactObject(item);
      redactionCount += redacted.redactionCount;
      object[key] = redacted.value;
    }
    return { value: object, redactionCount };
  }
  return { value, redactionCount: 0 };
}

function redactString(value) {
  const patterns = [
    [/<private>[\s\S]*?(?:<\/private>|$)/gi, "[REDACTED_PRIVATE]"],
    [/pa-[A-Za-z0-9_-]{40,}/g, "[REDACTED_VOYAGE_KEY]"],
    [/AIza[0-9A-Za-z_-]{30,}/g, "[REDACTED_GOOGLE_AI_KEY]"],
    [/jina_[0-9A-Za-z_-]{20,}/g, "[REDACTED_JINA_KEY]"],
    [/sk-ant-[A-Za-z0-9_-]{40,}/g, "[REDACTED_ANTHROPIC_KEY]"],
    [/sk-or-v1-[A-Za-z0-9_-]{40,}/g, "[REDACTED_OPENROUTER_KEY]"],
    [/sk-[A-Za-z0-9_-]{32,}/g, "[REDACTED_OPENAI_LIKE_KEY]"],
    [/sm_[A-Za-z0-9_-]{40,}/g, "[REDACTED_SUPERMEMORY_KEY]"],
    [/nvapi-[A-Za-z0-9_-]{32,}/g, "[REDACTED_NVIDIA_KEY]"],
    [/AKIA[0-9A-Z]{16}/g, "[REDACTED_AWS_KEY]"],
    [/gh[pousr]_[A-Za-z0-9_]{20,}/g, "[REDACTED_GITHUB_TOKEN]"],
    [/\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/g, "[REDACTED_TELEGRAM_BOT_TOKEN]"],
    [/xox[baprs]-[A-Za-z0-9-]{10,}/g, "[REDACTED_SLACK_TOKEN]"],
  ];
  let output = value;
  let redactionCount = 0;
  for (const [pattern, replacement] of patterns) {
    output = output.replace(pattern, () => {
      redactionCount += 1;
      return replacement;
    });
  }
  return { value: output, redactionCount };
}

function renderReadme(summary) {
  return `# Supermemory Redacted Export

Created: ${summary.createdAt}

Documents exported: ${summary.documents}

Pages read: ${summary.pages}

Redactions: ${summary.redactions}

Errors: ${summary.errors.length}

This archive was produced by selfmem fallback tooling. Content export is off by default. When content is included, it is redacted for private spans and common key shapes, but it may still contain sensitive prose. Keep this archive out of git.

Files:
- \`manifest.jsonl\`: one metadata row per document.
- \`documents/\`: redacted JSON document records.
- \`sources/\`: redacted Markdown/plaintext content when returned by Supermemory.
- \`EXPORT_REPORT.json\`: machine-readable export summary.
`;
}
