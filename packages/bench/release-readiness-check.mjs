import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { extname, join, relative } from "node:path";
import process from "node:process";

const root = fileURLToPath(new URL("../..", import.meta.url));
const reviewDir = process.env.RECALLWEAVE_REVIEW_DIR ?? (await latestReviewDir());

const requiredFiles = [
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "bin/selfmem_update",
  "docs/PRODUCTION_READINESS.md",
  "docs/PUBLIC_RELEASE_CHECKLIST.md",
  `${reviewDir}/kickoff.md`,
  `${reviewDir}/session-compaction-evidence.md`,
  `${reviewDir}/session-compaction-benchmark-evidence.md`,
  `${reviewDir}/wiki-vault-evidence.md`,
  `${reviewDir}/wiki-vault-sync-evidence.md`,
  `${reviewDir}/update-flow-evidence.md`,
  `${reviewDir}/brain-ui-vault-preview-evidence.md`,
  `${reviewDir}/brain-ui-edit-export-evidence.md`,
  `${reviewDir}/gemini-brain-ui-edit-export-review.md`,
  `${reviewDir}/brain-ui-sync-report-evidence.md`,
  `${reviewDir}/gemini-brain-ui-sync-report-review.md`,
  `${reviewDir}/gemini-selfmem-update-command-review.md`,
  `${reviewDir}/release-readiness-evidence.md`,
  `${reviewDir}/ui-evidence/brain-ui-dom-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-fixture-edit.png`,
  `${reviewDir}/ui-evidence/brain-ui-vault-preview-dom-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-vault-preview.png`,
  `${reviewDir}/ui-evidence/brain-ui-edit-export-dom-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-edit-export.png`,
  `${reviewDir}/ui-evidence/brain-ui-sync-report-dom-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-sync-report.png`,
];

const requiredScripts = [
  "build",
  "test",
  "typecheck",
  "privacy:test",
  "smoke:openclaw",
  "smoke:hermes",
  "brain:smoke",
  "brain:smoke:built",
  "compaction:smoke",
  "compaction:smoke:built",
  "compaction:benchmark",
  "compaction:benchmark:built",
  "wiki:smoke",
  "wiki:smoke:built",
  "wiki:sync:smoke",
  "wiki:sync:smoke:built",
  "update:smoke",
  "smoke",
  "release:check",
];

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const forbiddenRuntimeFilePattern =
  /(^|\/)(memories|raw_events|lossless_context|trace)\.jsonl$|(^|\/)\.env($|\.)|(^|\/)\.npmrc$|(^|\/)(?:pnpm-debug|npm-debug|yarn-error)\.log$|(^|\/)\.DS_Store$|(^|\/)local-configs\/|(^|\/)(?:auth|credentials|cookies|browser-state)\.(?:json|yaml|yml|txt)$|\.(?:sqlite|sqlite3|db|zip|pem|p12|key)$/i;
const textExtensions = new Set([
  "",
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".py",
  ".sh",
  ".sql",
  ".ts",
  ".tsx",
  ".toml",
  ".txt",
  ".yaml",
  ".yml",
  ".example",
]);

const checks = [];

check("required files exist", () => {
  for (const file of requiredFiles) {
    const path = join(root, file);
    assert.ok(existsSync(path), `${file} missing`);
    assert.ok(statSync(path).size > 0, `${file} empty`);
  }
});

check("required scripts exist", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  for (const script of requiredScripts) {
    assert.equal(typeof pkg.scripts?.[script], "string", `missing script ${script}`);
  }
});

check("selfmem_update command is mapped", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.equal(pkg.bin?.selfmem_update, "./bin/selfmem_update");
  const command = join(root, "bin/selfmem_update");
  assert.ok(statSync(command).mode & 0o111, "bin/selfmem_update must be executable");
  assert.match(readFileSync(command, "utf8"), /^#!\/usr\/bin\/env sh/);
  run(command, ["--help"]);
  const tempRoot = mkdtempSync(join(tmpdir(), "recallweave-bin-check-"));
  try {
    const symlinkPath = join(tempRoot, "selfmem_update");
    symlinkSync(command, symlinkPath);
    run(symlinkPath, ["--help"]);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

check("dom evidence is sane", () => {
  const vaultEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "ui-evidence/brain-ui-vault-preview-dom-evidence.json"), "utf8"),
  );
  assert.equal(vaultEvidence.ok, true);
  assert.equal(vaultEvidence.evidence.hasVaultPreviewHeading, true);
  assert.match(vaultEvidence.evidence.vaultStatus, /Lint clean/);
  assert.equal(vaultEvidence.evidence.visibleTextHasPrivate, false);
  assert.equal(vaultEvidence.consoleMessages.length, 0);
  assert.ok(vaultEvidence.evidence.vaultOptionCount >= 10);

  const editEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "ui-evidence/brain-ui-edit-export-dom-evidence.json"), "utf8"),
  );
  assert.equal(editEvidence.ok, true);
  assert.equal(editEvidence.evidence.hasDraftExportHeading, true);
  assert.equal(editEvidence.evidence.writesRealFiles, false);
  assert.ok(editEvidence.evidence.editCount >= 1);
  assert.equal(editEvidence.evidence.visibleTextHasPrivate, false);
  assert.equal(editEvidence.consoleMessages.length, 0);

  const syncEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "ui-evidence/brain-ui-sync-report-dom-evidence.json"), "utf8"),
  );
  assert.equal(syncEvidence.ok, true);
  assert.equal(syncEvidence.evidence.hasSyncReportHeading, true);
  assert.match(syncEvidence.evidence.syncStatus, /Dry run/i);
  assert.ok(syncEvidence.evidence.conflictActionCount >= 1);
  assert.equal(syncEvidence.evidence.visibleTextHasPrivate, false);
  assert.equal(syncEvidence.consoleMessages.length, 0);
});

check("fresh brain UI smoke passes", () => {
  run("node", ["packages/brain-ui/smoke.mjs"]);
});

check("git diff check passes", () => {
  run("git", ["diff", "--check"]);
});

check("remote url has no token", () => {
  const remote = run("git", ["remote", "get-url", "origin"]).stdout.trim();
  assert.doesNotMatch(remote, /:\/\/[^/\s]+@/);
  assert.doesNotMatch(remote, /(ghp_|github_pat_|[?&]token=)/);
});

check("core package dry-run pack passes", () => {
  run("npm", ["pack", "--dry-run"], { cwd: join(root, "packages/core") });
});

const files = await listFiles(root);

check("forbidden runtime files are absent", () => {
  const forbidden = files
    .map((file) => relative(root, file).replaceAll("\\", "/"))
    .filter((file) => forbiddenRuntimeFilePattern.test(file))
    .filter((file) => file !== ".env.example");
  assert.deepEqual(forbidden, []);
});

check("secret scan has zero hits", () => {
  const hits = [];
  for (const file of files) {
    if (!textExtensions.has(extname(file))) continue;
    const rel = relative(root, file).replaceAll("\\", "/");
    const text = readFileSync(file, "utf8");
    if (secretPattern.test(text)) hits.push(rel);
  }
  assert.deepEqual(hits, []);
});

const ok = checks.every((item) => item.ok);
console.log(JSON.stringify({ ok, checks }, null, 2));
if (!ok) process.exit(1);

function check(name, fn) {
  try {
    fn();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, `${command} ${args.join(" ")} failed\n${result.stderr}\n${result.stdout}`);
  return result;
}

async function listFiles(directory) {
  const output = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (shouldSkip(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      output.push(...(await listFiles(path)));
      continue;
    }
    if (entry.isFile()) output.push(path);
  }
  return output;
}

function shouldSkip(name) {
  return [".git", ".goal-loop-review", "node_modules", "coverage"].includes(name);
}

async function latestReviewDir() {
  const entries = await readdir(join(root, "reviews"), { withFileTypes: true });
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => `reviews/${entry.name}`)
    .sort();
  assert.ok(dirs.length > 0, "no review evidence directories found");
  return dirs.at(-1);
}
