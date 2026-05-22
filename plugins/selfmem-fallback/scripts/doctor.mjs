#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const env = process.env;

function fingerprint(value) {
  if (!value) return "missing";
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function has(path) {
  return existsSync(join(root, path));
}

const checks = {
  cwd: root,
  supermemoryKey: env.SUPERMEMORY_API_KEY ? `set:${fingerprint(env.SUPERMEMORY_API_KEY)}` : "missing",
  voyageKey: env.VOYAGE_API_KEY || env.VOYAGE_API_KEYS ? "set" : "missing",
  googleKey: env.GOOGLE_API_KEY ? "set" : "missing",
  corePackage: has("packages/core/src/index.ts"),
  hermesCanary: has("packages/adapters/hermes/selfmem_canary/__init__.py"),
  benchmarkSummary: has("docs/BENCHMARK_SUMMARY.md"),
  pluginManifest: has("plugins/selfmem-fallback/.codex-plugin/plugin.json"),
};

console.log(JSON.stringify(checks, null, 2));
