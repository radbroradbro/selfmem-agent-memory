#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..", "..");
const forwarded = process.argv.slice(2);
const args = [
  "exec",
  "--yes",
  "pnpm@10.23.0",
  "--",
  "bridge",
  "--",
  "distill",
  ...forwarded,
];

const result = spawnSync("npm", args, {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);

