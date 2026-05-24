import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const reviewDir = "reviews/overnight-20260522";
const targetPath = resolveInputPath(args.target ?? `${reviewDir}/public-longmemeval-expanded-run-target.json`);
const provider = String(args.provider ?? "voyage").toLowerCase();
const strategies = splitList(args.strategies ?? defaultStrategies(provider));
const format = String(args.format ?? "json").toLowerCase();
const outputPath = args.output ? resolveInputPath(args.output) : null;

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern =
  /(\/Users\/[^/\s"]+|\/Volumes\/[^/\s"]+|\/private\/[^/\s"]+|\/var\/folders\/[^/\s"]+|\/tmp\/[^/\s"]+|\/home\/[^/\s"]+|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*|memories\.jsonl|raw_events\.jsonl|lossless_context\.jsonl)/i;

assert.ok(["voyage", "nvidia", "gemini", "local-apple", "all"].includes(provider), `unknown provider packet: ${provider}`);
assert.ok(existsSync(targetPath), `benchmark target missing: ${displayPath(targetPath)}`);
assert.ok(statSync(targetPath).size > 0, `benchmark target empty: ${displayPath(targetPath)}`);
assert.ok(strategies.includes("bm25-lite"), "provider packet must include bm25-lite control");
assert.ok(strategies.includes("full-hybrid-rerank"), "provider packet must include full-hybrid-rerank control");
assert.ok(strategies.some((strategy) => providerArmStrategy(strategy)), "provider packet must include a provider-backed arm");

const preflight = runPreflight({ targetPath, strategies });
const targetRaw = readFileSync(targetPath, "utf8");
assertSafeText(JSON.stringify(preflight), "preflight report");
assertSafeText(targetRaw, "target");

const packet = {
  schemaVersion: 1,
  ok: true,
  mode: "provider-benchmark-operator-packet",
  generatedAt: new Date().toISOString(),
  writesRealFiles: Boolean(outputPath),
  publicSafe: true,
  metricsOnly: true,
  callsProviderApis: false,
  sendsBenchmarkTextToProvider: false,
  publicLaunchAllowed: false,
  publicBenchmarkClaimsAllowed: false,
  provider,
  target: {
    path: displayPath(targetPath),
    sha256: sha256(targetRaw),
    benchmark: preflight.target?.benchmark ?? null,
    claimTier: preflight.target?.claimTier ?? null,
  },
  strategies,
  preflight: {
    status: preflight.status,
    liveRunAllowedNow: Boolean(preflight.liveRunAllowed),
    blockers: preflight.blockers ?? [],
    requiredProviders: preflight.requiredProviders ?? [],
    missingCredentialProviders: preflight.missingCredentialProviders ?? [],
    callsProviderApis: Boolean(preflight.callsProviderApis),
    sendsBenchmarkTextToProvider: Boolean(preflight.sendsBenchmarkTextToProvider),
  },
  sameDataContract: {
    bm25ControlRequired: true,
    fullHybridControlRequired: true,
    providerArmRequired: true,
    targetHashMustMatch: `sha256:${sha256(targetRaw)}`,
    soloProviderRunsAreSmokeOnly: true,
    memoryBenchAnswerQuality: false,
  },
  operatorFlow: buildOperatorFlow({ provider, targetPath, strategies }),
  attachPolicy: {
    attachBack: [
      "recallweave-provider-preflight.json",
      "recallweave-provider-result.json",
      "recallweave-provider-result.md",
    ],
    forbidden: [
      "provider keys",
      "key files",
      "raw benchmark question text",
      "raw answers",
      "raw memories",
      "raw transcripts",
      "private local paths",
      "unredacted diagnostics",
    ],
  },
  passCriteria: [
    "preflight reports READY_FOR_LIVE_PROVIDER_BENCHMARK before the live run",
    "result includes bm25-lite, full-hybrid-rerank, and the selected provider arm",
    "all arms use the same target hash, query-set hash, scoring-code hash, context budget, and limit",
    "privacyLeakCount and redactionFailureCount are zero for every arm",
    "rawQuestionsIncluded, rawAnswersIncluded, and rawMemoryIncluded remain false",
    "provider-backed arm beats bm25-lite on quality or materially improves a secondary metric without quality regression",
    "publicBenchmarkClaimsAllowed remains false until the result receives the required review/owner approval path",
  ],
  safety: {
    printsCredentials: false,
    printsPrivatePaths: false,
    privateLeakCount: 0,
    hasSecretPattern: false,
  },
};

const output = format === "markdown" ? `${toMarkdown(packet)}\n` : `${JSON.stringify(packet, null, 2)}\n`;
assertSafeText(output, "provider benchmark operator packet");
if (outputPath) writeOutput(outputPath, output);
process.stdout.write(output);

function runPreflight({ targetPath, strategies }) {
  const result = spawnSync(
    "node",
    [
      "packages/bench/provider-benchmark-live-preflight.mjs",
      "--target",
      displayPath(targetPath),
      "--strategies",
      strategies.join(","),
    ],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  assertSafeText(result.stdout, "provider preflight stdout");
  return JSON.parse(result.stdout);
}

function defaultStrategies(provider) {
  if (provider === "voyage") return "bm25-lite,full-hybrid-rerank,cloud-voyage4-voyage";
  if (provider === "nvidia") return "bm25-lite,full-hybrid-rerank,cloud-nvidia-nemotron-1b";
  if (provider === "gemini") return "bm25-lite,full-hybrid-rerank,cloud-gemini-voyage-rerank";
  if (provider === "local-apple") return "bm25-lite,full-hybrid-rerank,local-apple-qwen3-0_6b";
  return "bm25-lite,full-hybrid-rerank,cloud-voyage4-voyage,cloud-gemini-voyage-rerank,cloud-nvidia-nemotron-1b,local-apple-qwen3-0_6b";
}

function providerArmStrategy(strategy) {
  return strategy.startsWith("cloud-") || strategy.startsWith("local-apple-");
}

function buildOperatorFlow({ provider, targetPath, strategies }) {
  const providerLines = {
    voyage: ["VOYAGE_API_KEYS_FILE=<private-file-outside-repo>"],
    nvidia: ["NVIDIA_API_KEYS_FILE=<private-file-outside-repo>"],
    gemini: ["GEMINI_API_KEYS_FILE=<private-file-outside-repo>"],
    "local-apple": ["SELFMEM_LOCAL_EMBED_BASE_URL=<local-server-url>"],
    all: [
      "VOYAGE_API_KEYS_FILE=<private-file-outside-repo>",
      "GEMINI_API_KEYS_FILE=<private-file-outside-repo>",
      "NVIDIA_API_KEYS_FILE=<private-file-outside-repo>",
      "SELFMEM_LOCAL_EMBED_BASE_URL=<local-server-url>",
    ],
  }[provider];
  return [
    {
      id: "store-credentials-outside-repo",
      description: "Put any provider key in a private file outside the repository with 0600 permissions. Do not paste keys into commands or committed files.",
    },
    {
      id: "preflight-require-ready",
      command: [
        "RECALLWEAVE_PROVIDER_OUTPUT_DIR=<private-output-dir-outside-repo>",
        "RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1",
        "RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1",
        ...providerLines,
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:public-provider:preflight --",
          `--target ${displayPath(targetPath)}`,
          `--strategies ${strategies.join(",")}`,
          "--require-ready",
          "--output \"$RECALLWEAVE_PROVIDER_OUTPUT_DIR/recallweave-provider-preflight.json\"",
        ].join(" "),
      ],
    },
    {
      id: "run-same-data-provider-comparison",
      command: [
        "RECALLWEAVE_PROVIDER_OUTPUT_DIR=<private-output-dir-outside-repo>",
        "RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1",
        "RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1",
        ...providerLines,
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:public-provider -- --live",
          `--target ${displayPath(targetPath)}`,
          `--strategies ${strategies.join(",")}`,
          "--max-memory-bytes 80000000",
          "--output \"$RECALLWEAVE_PROVIDER_OUTPUT_DIR/recallweave-provider-result.json\"",
          "--markdown-output \"$RECALLWEAVE_PROVIDER_OUTPUT_DIR/recallweave-provider-result.md\"",
        ].join(" "),
      ],
    },
    {
      id: "scan-returned-artifacts",
      command:
        "rg -n \"(pa-|AIza|sm_|nvapi-|jina_|ghp_|github_pat_|sk-|Bearer |memories\\.jsonl|raw_events\\.jsonl|lossless_context\\.jsonl)\" \"$RECALLWEAVE_PROVIDER_OUTPUT_DIR/recallweave-provider-preflight.json\" \"$RECALLWEAVE_PROVIDER_OUTPUT_DIR/recallweave-provider-result.json\" \"$RECALLWEAVE_PROVIDER_OUTPUT_DIR/recallweave-provider-result.md\" || true",
    },
  ];
}

function toMarkdown(packet) {
  return [
    "# RecallWeave Provider Benchmark Operator Packet",
    "",
    `Provider lane: ${packet.provider}`,
    `Public launch allowed: ${packet.publicLaunchAllowed ? "yes" : "no"}`,
    `Public benchmark claims allowed: ${packet.publicBenchmarkClaimsAllowed ? "yes" : "no"}`,
    `Target: ${packet.target.path}`,
    `Target hash: sha256:${packet.target.sha256}`,
    "",
    "## Current Preflight",
    "",
    `- Status: ${packet.preflight.status}`,
    `- Live run allowed now: ${packet.preflight.liveRunAllowedNow}`,
    `- Calls provider APIs now: ${packet.preflight.callsProviderApis}`,
    `- Sends benchmark text now: ${packet.preflight.sendsBenchmarkTextToProvider}`,
    `- Required providers: ${packet.preflight.requiredProviders.join(", ") || "none"}`,
    `- Missing providers: ${packet.preflight.missingCredentialProviders.join(", ") || "none"}`,
    "",
    "## Same-Data Strategies",
    "",
    ...packet.strategies.map((strategy) => `- ${strategy}`),
    "",
    "## Commands",
    "",
    ...packet.operatorFlow.flatMap((step) => [
      `### ${step.id}`,
      "",
      step.description ?? "",
      step.command ? "```bash" : "",
      ...(Array.isArray(step.command) ? step.command : step.command ? [step.command] : []),
      step.command ? "```" : "",
      "",
    ]),
    "## Pass Criteria",
    "",
    ...packet.passCriteria.map((item) => `- ${item}`),
    "",
    "## Attach Back",
    "",
    ...packet.attachPolicy.attachBack.map((item) => `- ${item}`),
    "",
    "## Do Not Attach",
    "",
    ...packet.attachPolicy.forbidden.map((item) => `- ${item}`),
  ].join("\n");
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}

function assertSafeText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a private path or raw memory artifact name`);
}

function displayPath(path) {
  const rel = relative(root, path).replaceAll("\\", "/");
  return rel.startsWith("..") ? "external-input" : rel;
}

function resolveInputPath(value) {
  return isAbsolute(String(value ?? "")) ? String(value) : resolve(root, String(value ?? ""));
}

function splitList(value) {
  return String(value ?? "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item.startsWith("--")) {
      const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) {
        parsed[key] = true;
      } else {
        parsed[key] = next;
        index += 1;
      }
    }
  }
  return parsed;
}
