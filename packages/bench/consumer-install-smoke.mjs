import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const checkout = mkdtempSync(join(tmpdir(), "recallweave-consumer-checkout-"));
const npmCache = mkdtempSync(join(tmpdir(), "recallweave-consumer-npm-cache-"));
const forbiddenRuntimeFilePattern =
  /(^|\/)(memories|raw_events|lossless_context|trace)\.jsonl$|(^|\/)\.env($|\.)|(^|\/)\.npmrc$|(^|\/)(?:pnpm-debug|npm-debug|yarn-error)\.log$|(^|\/)\.DS_Store$|(^|\/)local-configs\/|(^|\/)(?:auth|credentials|cookies|browser-state)\.(?:json|yaml|yml|txt)$|\.(?:sqlite|sqlite3|db|zip|pem|p12|key)$/i;
const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;

const extraCurrentFiles = [
  "packages/bench/consumer-install-smoke.mjs",
  "packages/bench/canary-report-from-trace.mjs",
  "packages/bench/canary-evidence-intake.mjs",
  "packages/bench/canary-remediation.mjs",
  "packages/bench/canary-drill.mjs",
  "packages/bench/canary-operator-packet.mjs",
  "packages/bench/canary-evidence-packet.mjs",
  "packages/bench/canary-evidence-packet-review.mjs",
  "packages/bench/canary-returned-packet-intake.mjs",
  "packages/bench/canary-returned-inbox.mjs",
  "packages/bench/canary-diagnostic-batch-audit.mjs",
  "packages/bench/canary-next-agent-plan.mjs",
  "packages/bench/canary-next-agent-packet.mjs",
  "packages/bench/baseline-scoring-contract.mjs",
  "packages/bench/baseline-queryset-inspect.mjs",
  "packages/bench/baseline-source-match-preflight.mjs",
  "packages/bench/baseline-source-alignment.mjs",
  "packages/bench/baseline-source-gap-plan.mjs",
  "packages/bench/hosted-baseline-discovery.mjs",
  "packages/bench/hosted-baseline-container-select.mjs",
  "packages/bench/hosted-baseline-queryset-author.mjs",
  "packages/bench/baseline-comparison.mjs",
  "packages/bench/hosted-baseline-collector.mjs",
  "packages/bench/recallweave-response-export.mjs",
  "packages/bench/recallweave-baseline-collector.mjs",
  "packages/bench/hosted-baseline-operator-packet.mjs",
  "packages/bench/hosted-baseline-next-run.mjs",
  "packages/bench/hosted-baseline-run.mjs",
  "packages/bench/baseline-evidence-packet.mjs",
  "packages/bench/baseline-evidence-packet-review.mjs",
  "packages/bench/baseline-returned-packet-intake.mjs",
  "packages/bench/fixtures/recallweave-baseline-result.fixture.json",
  "packages/bench/fixtures/recallweave-baseline-search-responses.fixture.json",
  "packages/bench/fixtures/recallweave-local-container.fixture/local-memories.fixture.jsonl",
  "packages/bench/fixtures/hosted-baseline-queryset.fixture.json",
  "packages/bench/fixtures/hosted-baseline-search-responses.fixture.json",
  "packages/bench/github-live-sync-check.mjs",
  "packages/bench/fixtures/canary-runtime-container-map.fixture.json",
  "packages/bench/fixtures/canary-runtime-trace.fixture.jsonl",
  "packages/bench/fixtures/canary-runtime-raw.fixture.jsonl",
  "packages/bench/fixtures/canary-runtime-memories.fixture.jsonl",
  "packages/bench/fixtures/canary-runtime-report.fixture.json",
  "packages/bench/fixtures/canary-runtime-report-failing.fixture.json",
  "packages/bench/fixtures/canary-diagnostic-export.fixture/selfmem_canary_metadata/trace_metadata_only.jsonl",
  "packages/bench/fixtures/canary-diagnostic-export.fixture/selfmem_canary/containers/selfmem_fixture_agent/container-map.json",
  "packages/bench/fixtures/canary-diagnostic-export.fixture/selfmem_canary/reliability_reports/latest.json",
];
const checks = [];

try {
  copyPublicCheckout();
  const packageJson = JSON.parse(readFileSync(join(checkout, "package.json"), "utf8"));
  assert.equal(packageJson.bin?.selfmem_update, "./bin/selfmem_update");
  assert.equal(typeof packageJson.scripts?.["consumer:smoke"], "string");
  assert.equal(typeof packageJson.scripts?.["update:smoke"], "string");
  assert.equal(typeof packageJson.scripts?.["canary:drill"], "string");
  assert.equal(typeof packageJson.scripts?.["canary:operator-packet"], "string");
  assert.equal(typeof packageJson.scripts?.["canary:packet"], "string");
  assert.equal(typeof packageJson.scripts?.["canary:packet:review"], "string");
  assert.equal(typeof packageJson.scripts?.["canary:returned-packet"], "string");
  assert.equal(typeof packageJson.scripts?.["canary:returned-inbox"], "string");
  assert.equal(typeof packageJson.scripts?.["canary:batch-audit"], "string");
  assert.equal(typeof packageJson.scripts?.["canary:next-agent"], "string");
  assert.equal(typeof packageJson.scripts?.["canary:next-agent-packet"], "string");
  assert.equal(typeof packageJson.scripts?.["baseline:queryset"], "string");
  assert.equal(typeof packageJson.scripts?.["baseline:source-match"], "string");
  assert.equal(typeof packageJson.scripts?.["baseline:source-align"], "string");
  assert.equal(typeof packageJson.scripts?.["baseline:source-gap"], "string");
  assert.equal(typeof packageJson.scripts?.["baseline:discover"], "string");
  assert.equal(typeof packageJson.scripts?.["baseline:select-container"], "string");
  assert.equal(typeof packageJson.scripts?.["baseline:author-queryset"], "string");
  assert.equal(typeof packageJson.scripts?.["baseline:collect"], "string");
  assert.equal(typeof packageJson.scripts?.["baseline:export:recallweave"], "string");
  assert.equal(typeof packageJson.scripts?.["baseline:collect:recallweave"], "string");
  assert.equal(typeof packageJson.scripts?.["baseline:compare"], "string");
  assert.equal(typeof packageJson.scripts?.["baseline:operator-packet"], "string");
  assert.equal(typeof packageJson.scripts?.["baseline:next-run"], "string");
  assert.equal(typeof packageJson.scripts?.["baseline:run"], "string");
  assert.equal(typeof packageJson.scripts?.["baseline:packet"], "string");
  assert.equal(typeof packageJson.scripts?.["baseline:packet:review"], "string");
  assert.equal(typeof packageJson.scripts?.["baseline:returned-packet"], "string");
  assert.equal(typeof packageJson.scripts?.["release:github-sync"], "string");
  assert.ok(existsSync(join(checkout, "README.md")), "README.md missing from consumer checkout");
  assert.ok(existsSync(join(checkout, "docs/USER_MANUAL.md")), "user manual missing from consumer checkout");
  assert.ok(existsSync(join(checkout, "docs/BRAIN_UI.md")), "Brain UI docs missing from consumer checkout");
  assert.ok(existsSync(join(checkout, "docs/MODEL_MATRIX.md")), "model matrix docs missing from consumer checkout");
  assert.ok(existsSync(join(checkout, "packages/core/dist/index.js")), "built core dist missing from consumer checkout");
  assert.ok(existsSync(join(checkout, "packages/brain-ui/fixtures/model-matrix.json")), "model matrix fixture missing");
  assert.ok(statSync(join(checkout, "bin/selfmem_update")).mode & 0o111, "selfmem_update must be executable");

  checks.push(run("bin/selfmem_update", ["--help"], "selfmem_update --help"));
  checks.push(run("python3", ["packages/bench/update-flow-smoke.py"], "update smoke"));
  checks.push(run("node", ["packages/brain-ui/smoke.mjs"], "Brain UI smoke"));
  checks.push(run("node", ["packages/brain-ui/interaction-smoke.mjs"], "Brain UI interaction smoke"));
  checks.push(run("node", ["packages/bench/local-container-audit-smoke.mjs"], "local-container audit smoke"));
  checks.push(run("node", ["packages/bench/session-compaction-local-audit.mjs", "--strict"], "local-session compaction audit"));
  checks.push(run("node", ["packages/bench/session-compaction-local-batch-audit.mjs", "--strict"], "local-session batch compaction audit"));
  checks.push(run("node", ["packages/bench/canary-report-from-trace.mjs", "--fixture"], "canary report generator"));
  checks.push(run("node", ["packages/bench/canary-report-from-trace.mjs", "--diagnostic-dir", "packages/bench/fixtures/canary-diagnostic-export.fixture"], "canary diagnostic report generator"));
  checks.push(run("node", ["packages/bench/canary-evidence-intake.mjs"], "canary evidence intake"));
  checks.push(run("node", ["packages/bench/canary-remediation.mjs"], "canary remediation plan"));
  checks.push(run("node", ["packages/bench/canary-drill.mjs"], "canary strict-real drill"));
  checks.push(run("node", ["packages/bench/canary-operator-packet.mjs", "--host", "hermes"], "canary operator packet"));
  checks.push(run("node", ["packages/bench/canary-evidence-packet.mjs"], "canary evidence packet"));
  checks.push(run("node", ["packages/bench/canary-evidence-packet-review.mjs"], "canary evidence packet review"));
  checks.push(run("node", ["packages/bench/canary-returned-packet-intake.mjs"], "returned canary packet intake"));
  checks.push(run("node", ["packages/bench/canary-returned-inbox.mjs"], "returned canary inbox scanner"));
  checks.push(run("node", ["packages/bench/canary-diagnostic-batch-audit.mjs"], "canary diagnostic batch audit"));
  checks.push(run("node", ["packages/bench/canary-next-agent-plan.mjs"], "canary next agent plan"));
  checks.push(run("node", ["packages/bench/canary-next-agent-packet.mjs"], "canary next agent handoff packet"));
  checks.push(run("node", ["packages/bench/baseline-queryset-inspect.mjs"], "baseline query-set inspect"));
  checks.push(run("node", ["packages/bench/baseline-source-match-preflight.mjs", "--fixture"], "baseline source-match preflight"));
  checks.push(run("node", ["packages/bench/baseline-source-alignment.mjs"], "baseline source-alignment gate"));
  checks.push(run("node", ["packages/bench/baseline-source-gap-plan.mjs"], "baseline source-gap plan"));
  checks.push(run("node", ["packages/bench/hosted-baseline-discovery.mjs"], "hosted baseline discovery"));
  checks.push(run("node", ["packages/bench/hosted-baseline-container-select.mjs"], "hosted baseline container selector"));
  checks.push(run("node", ["packages/bench/hosted-baseline-queryset-author.mjs"], "hosted baseline query-set author"));
  checks.push(run("node", ["packages/bench/hosted-baseline-collector.mjs", "--fixture"], "hosted baseline collector"));
  checks.push(run("node", ["packages/bench/recallweave-response-export.mjs", "--fixture"], "RecallWeave response export"));
  checks.push(run("node", ["packages/bench/recallweave-baseline-collector.mjs", "--fixture"], "RecallWeave baseline collector"));
  checks.push(run("node", ["packages/bench/baseline-comparison.mjs", "--fixture"], "baseline comparison"));
  checks.push(run("node", ["packages/bench/hosted-baseline-operator-packet.mjs"], "hosted baseline operator packet"));
  checks.push(run("node", ["packages/bench/hosted-baseline-next-run.mjs"], "hosted baseline next-run planner"));
  checks.push(run("node", ["packages/bench/hosted-baseline-run.mjs", "--fixture"], "hosted baseline run orchestrator"));
  checks.push(run("node", ["packages/bench/baseline-evidence-packet.mjs"], "hosted baseline evidence packet"));
  checks.push(run("node", ["packages/bench/baseline-evidence-packet-review.mjs"], "hosted baseline evidence packet review"));
  checks.push(run("node", ["packages/bench/baseline-returned-packet-intake.mjs"], "returned hosted baseline packet intake"));

  const pack = run("npm", ["pack", "--dry-run", "--json", "--cache", npmCache], "npm package dry run");
  const packJson = JSON.parse(pack.stdout);
  const files = new Set(packJson[0]?.files?.map((file) => file.path) ?? []);
  for (const file of [
    "package.json",
    "bin/selfmem_update",
    "README.md",
    "docs/USER_MANUAL.md",
    "docs/BRAIN_UI.md",
    "docs/MODEL_MATRIX.md",
    "packages/core/dist/index.js",
    "packages/brain-ui/src/index.html",
    "packages/brain-ui/fixtures/model-matrix.json",
    "packages/bench/session-compaction-local-batch-audit.mjs",
    "packages/bench/fixtures/session-compaction-local-batch.fixture/codex-rollout.fixture.jsonl",
    "packages/bench/fixtures/session-compaction-local-batch.fixture/claude-transcript.fixture.json",
    "packages/bench/fixtures/session-compaction-local-batch.fixture/hermes-trace.fixture.jsonl",
    "packages/bench/canary-report-from-trace.mjs",
    "packages/bench/canary-evidence-intake.mjs",
    "packages/bench/canary-remediation.mjs",
    "packages/bench/canary-drill.mjs",
    "packages/bench/canary-operator-packet.mjs",
    "packages/bench/canary-evidence-packet.mjs",
    "packages/bench/canary-evidence-packet-review.mjs",
    "packages/bench/canary-returned-packet-intake.mjs",
    "packages/bench/canary-returned-inbox.mjs",
    "packages/bench/canary-diagnostic-batch-audit.mjs",
    "packages/bench/canary-next-agent-plan.mjs",
    "packages/bench/canary-next-agent-packet.mjs",
    "packages/bench/baseline-scoring-contract.mjs",
    "packages/bench/baseline-queryset-inspect.mjs",
    "packages/bench/baseline-source-match-preflight.mjs",
    "packages/bench/baseline-source-alignment.mjs",
    "packages/bench/baseline-source-gap-plan.mjs",
    "packages/bench/hosted-baseline-discovery.mjs",
    "packages/bench/hosted-baseline-container-select.mjs",
    "packages/bench/hosted-baseline-queryset-author.mjs",
    "packages/bench/baseline-comparison.mjs",
    "packages/bench/hosted-baseline-collector.mjs",
    "packages/bench/recallweave-response-export.mjs",
    "packages/bench/recallweave-baseline-collector.mjs",
    "packages/bench/hosted-baseline-operator-packet.mjs",
    "packages/bench/hosted-baseline-next-run.mjs",
    "packages/bench/hosted-baseline-run.mjs",
    "packages/bench/baseline-evidence-packet.mjs",
    "packages/bench/baseline-evidence-packet-review.mjs",
    "packages/bench/baseline-returned-packet-intake.mjs",
    "packages/bench/fixtures/recallweave-baseline-result.fixture.json",
    "packages/bench/fixtures/recallweave-baseline-search-responses.fixture.json",
    "packages/bench/fixtures/recallweave-local-container.fixture/local-memories.fixture.jsonl",
    "packages/bench/fixtures/hosted-baseline-queryset.fixture.json",
    "packages/bench/fixtures/hosted-baseline-search-responses.fixture.json",
    "packages/bench/github-live-sync-check.mjs",
    "packages/bench/fixtures/canary-runtime-container-map.fixture.json",
    "packages/bench/fixtures/canary-runtime-trace.fixture.jsonl",
    "packages/bench/fixtures/canary-runtime-raw.fixture.jsonl",
    "packages/bench/fixtures/canary-runtime-memories.fixture.jsonl",
    "packages/bench/fixtures/canary-runtime-report.fixture.json",
    "packages/bench/fixtures/canary-runtime-report-failing.fixture.json",
    "packages/bench/fixtures/canary-diagnostic-export.fixture/selfmem_canary_metadata/trace_metadata_only.jsonl",
    "packages/bench/fixtures/canary-diagnostic-export.fixture/selfmem_canary/containers/selfmem_fixture_agent/container-map.json",
    "packages/bench/fixtures/canary-diagnostic-export.fixture/selfmem_canary/reliability_reports/latest.json",
    "plugins/selfmem-fallback/scripts/selfmem_update.py",
  ]) {
    assert.ok(files.has(file), `npm dry-run package missing ${file}`);
  }

  const checkoutFiles = await listFiles(checkout);
  const forbidden = checkoutFiles
    .map((file) => relative(checkout, file).replaceAll("\\", "/"))
    .filter((file) => forbiddenRuntimeFilePattern.test(file))
    .filter((file) => file !== ".env.example");
  assert.deepEqual(forbidden, []);

  const secretHits = [];
  for (const file of checkoutFiles) {
    const rel = relative(checkout, file).replaceAll("\\", "/");
    if (!isTextLike(rel)) continue;
    const text = readFileSync(file, "utf8");
    if (secretPattern.test(text)) secretHits.push(rel);
  }
  assert.deepEqual(secretHits, []);

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "clean-consumer-smoke",
        writesRealFiles: false,
        checkoutFiles: checkoutFiles.length,
        commands: checks.map((check) => check.name),
        npmPackFiles: files.size,
        requiredPackFilesPresent: true,
        forbiddenRuntimeFiles: forbidden.length,
        secretHits: secretHits.length,
      },
      null,
      2,
    ),
  );
} finally {
  rmSync(checkout, { recursive: true, force: true });
  rmSync(npmCache, { recursive: true, force: true });
}

function copyPublicCheckout() {
  const tracked = run("git", ["ls-files", "-z"], "tracked file inventory", { cwd: root }).stdout
    .split("\0")
    .filter(Boolean);
  const files = new Set([...tracked, ...extraCurrentFiles.filter((file) => existsSync(join(root, file)))]);
  for (const rel of files) {
    const source = join(root, rel);
    if (!existsSync(source) || !statSync(source).isFile()) continue;
    const target = join(checkout, rel);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
    chmodSync(target, statSync(source).mode);
  }
}

function run(command, args, name, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? checkout,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, npm_config_cache: npmCache },
  });
  assert.equal(result.status, 0, `${name} failed\n${result.stderr}\n${result.stdout}`);
  return { name, stdout: result.stdout, stderr: result.stderr };
}

async function listFiles(directory) {
  const output = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (["node_modules", ".git", "coverage"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      output.push(...(await listFiles(path)));
      continue;
    }
    if (entry.isFile()) output.push(path);
  }
  return output;
}

function isTextLike(path) {
  return /\.(?:cjs|css|html|js|json|jsonl|md|mjs|py|sh|sql|ts|tsx|toml|txt|yaml|yml|example)$/.test(path) || !path.includes(".");
}
