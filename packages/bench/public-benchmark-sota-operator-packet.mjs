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
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();
const sameDataStrategies = splitList(
  args.strategies ??
    "bm25-lite,dense-proxy,full-hybrid-rerank,query-expanded-full-hybrid-rerank,cloud-voyage4-voyage,cloud-gemini-voyage-rerank,cloud-nvidia-nemotron-1b,local-apple-qwen3-0_6b,local-apple-qwen3-0_6b-local-rerank",
);
const providerPreflightStrategies = sameDataStrategies.filter((strategy) => providerPreflightStrategy(strategy));

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(existsSync(targetPath), `benchmark target missing: ${displayPath(targetPath)}`);
assert.ok(statSync(targetPath).size > 0, `benchmark target empty: ${displayPath(targetPath)}`);

const targetRaw = readFileSync(targetPath, "utf8");
assertSafePublicText(targetRaw, "source-locked target");
const target = JSON.parse(targetRaw);
const sotaLadder = runJson(["packages/bench/public-benchmark-sota-ladder.mjs"]);
const queryExpansionPreflight = runJson(["packages/bench/public-benchmark-query-expansion-preflight.mjs"]);
const providerPreflight = runJson([
  "packages/bench/provider-benchmark-live-preflight.mjs",
  "--target",
  displayPath(targetPath),
  "--strategies",
  providerPreflightStrategies.join(","),
]);
const localRerankEvidence = loadEvidence(`${reviewDir}/local-rerank-sidecar-baseline-refresh-evidence.md`);
const currentQueryExpansionImpl = inspectQueryExpansionImplementation();

const blockers = [
  ...arrayOf(sotaLadder.blockers),
  ...arrayOf(queryExpansionPreflight.blockers).map((item) => `query-expansion:${item}`),
  ...arrayOf(providerPreflight.blockers).map((item) => `provider:${item}`),
  currentQueryExpansionImpl.usesDeterministicProxy ? "query-expansion-live-llm-wiring-not-proven" : null,
  !localRerankEvidence.exists ? "local-rerank-sidecar-evidence-missing" : null,
].filter(Boolean);

const packet = {
  schemaVersion: 1,
  ok: true,
  mode: "public-benchmark-sota-operator-packet",
  status: blockers.length === 0 ? "READY_FOR_REVIEWED_SOTA_RUN" : "BLOCKED_SOTA_OPERATOR_INPUTS",
  generatedAt: new Date().toISOString(),
  publicSafe: true,
  metricsOnly: true,
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  callsProviderApis: false,
  sendsBenchmarkTextToProvider: false,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  publicBenchmarkClaimsAllowed: false,
  target: {
    path: displayPath(targetPath),
    hash: `sha256:${sha256(targetRaw)}`,
    fixtureOnly: Boolean(target.fixtureOnly),
    benchmark: target.benchmark?.family ?? target.benchmark?.name ?? null,
    claimTier: target.claimTier ?? null,
    querySelectionPolicyHash: hashNullable(target.benchmark?.questionIdPolicy),
    answerLabelsHash: target.benchmark?.answerLabelsHash ?? null,
    scoringCodeHash: target.benchmark?.scoringCodeHash ?? null,
  },
  currentEvidence: {
    sotaLadder: {
      status: sotaLadder.status,
      publicBenchmarkClaimsAllowed: Boolean(sotaLadder.publicBenchmarkClaimsAllowed),
      blockers: arrayOf(sotaLadder.blockers),
      requiredFullMemoryArms: sotaLadder.requiredFullMemoryArms ?? [],
      reportedMemoryTargets: sotaLadder.reportedMemoryTargets ?? [],
    },
    queryExpansionPreflight: {
      status: queryExpansionPreflight.status,
      queryExpansionCanBeBenchmarked: Boolean(queryExpansionPreflight.readiness?.queryExpansionCanBeBenchmarked),
      countsAsPureLocal: Boolean(queryExpansionPreflight.readiness?.countsAsPureLocal),
      countsAsMixedLocalCloud: Boolean(queryExpansionPreflight.readiness?.countsAsMixedLocalCloud),
      blockers: arrayOf(queryExpansionPreflight.blockers),
    },
    providerPreflight: {
      status: providerPreflight.status,
      liveRunAllowed: Boolean(providerPreflight.liveRunAllowed),
      strategies: providerPreflight.strategies ?? providerPreflightStrategies,
      requiredProviders: providerPreflight.requiredProviders ?? [],
      missingCredentialProviders: providerPreflight.missingCredentialProviders ?? [],
      blockers: arrayOf(providerPreflight.blockers),
    },
    localRerankSidecar: {
      strategy: "local-apple-qwen3-0_6b-local-rerank",
      evidencePath: localRerankEvidence.path,
      evidenceExists: localRerankEvidence.exists,
      evidenceHash: localRerankEvidence.hash,
      endpointEnv: ["SELFMEM_LOCAL_RERANK_ENDPOINT", "SELFMEM_LOCAL_RERANK_BASE_URL"],
    },
    queryExpansionImplementation: currentQueryExpansionImpl,
  },
  sameDataContract: {
    targetHashMustMatch: `sha256:${sha256(targetRaw)}`,
    querySetHashMustMatch: true,
    scoringCodeHashMustMatch: true,
    bm25LexicalFloorRequired: true,
    denseVectorSemanticControlRequired: true,
    fullHybridControlRequired: true,
    localAppleEmbeddingArmRequired: true,
    localAppleRerankerSidecarArmRequired: true,
    voyageProviderArmRequired: true,
    nvidiaOrGeminiProviderArmRequired: true,
    queryExpansionArmRequired: true,
    endToEndMemoryAnswerQualityRequired: true,
    retrievalProxyOnlyIsNotEnoughForPublicClaims: true,
    componentBenchmarksOnlySelectCandidates: true,
  },
  operatorFlow: buildOperatorFlow(),
  reviewerPacket: {
    purpose: "Challenge the method, scoring contract, privacy contract, and release wording before any public or production claim.",
    acceptableReviewerRoutes: ["Gemini", "Claude", "NVIDIA/DeepSeek-style external critic", "Codex reviewer not involved in implementation"],
    reviewersMustReceive: [
      "metrics-only SOTA ladder report",
      "query-expansion preflight and run report",
      "same-data provider/local strategy reports",
      "end-to-end memory answer-quality report",
      "UI screenshots or browser evidence for the brain view",
      "docs and release-note diff",
    ],
    reviewersMustNotReceive: [
      "provider keys",
      "raw benchmark questions",
      "raw answers",
      "raw memory logs",
      "raw transcripts",
      "private local paths",
      "implementer scratchpad or hidden reasoning",
    ],
  },
  attachPolicy: {
    attachBack: [
      "sota-ladder-report.json",
      "sota-ladder-report.md",
      "query-expansion-preflight.json",
      "query-expansion-result.json",
      "provider-preflight.json",
      "same-data-provider-result.json",
      "end-to-end-memory-score.json",
      "reviewer-approval-report.json",
      "ui-evidence-index.md",
      "release-notes-diff.md",
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
      "unreviewed reviewer transcripts",
    ],
  },
  passCriteria: [
    "All arms use the exact same source-locked target, query-set hash, scoring-code hash, context budget, and limit.",
    "BM25, dense/vector-only, full-hybrid, local Apple embedding, local Apple reranker, Voyage, NVIDIA or Gemini, and query-expansion arms all have same-data rows.",
    "The query-expansion arm states whether it is pure local or mixed local-plus-cloud, and mixed arms name the cloud substep.",
    "The query-expansion arm proves live LLM expansion wiring before it is counted as an LLM query-expansion result.",
    "The final claim uses an end-to-end memory answer-quality score, not retrieval-proxy or MTEB-only evidence.",
    "Supermemory reported scores are comparison targets only unless the same harness/dataset/judge semantics are matched.",
    "privacyLeakCount and redactionFailureCount are zero for every attached report.",
    "Two independent reviewers approve the exact metrics-only packet before owner review or public release wording changes.",
    "Brain UI evidence, docs, and release notes are updated after the benchmark result is known.",
  ],
  blockers,
};

const jsonText = `${JSON.stringify(packet, null, 2)}\n`;
const markdownText = `${renderMarkdown(packet)}\n`;
assertSafePublicText(jsonText, "SOTA operator packet");
assertSafePublicText(markdownText, "SOTA operator packet markdown");

if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);

function buildOperatorFlow() {
  const target = displayPath(targetPath);
  const providerStrategies = providerPreflightStrategies.join(",");
  const fullLadderStrategies = sameDataStrategies.join(",");
  return [
    {
      id: "refresh-current-safe-gates",
      description: "Refresh the blocked/ready state without provider calls or raw benchmark text.",
      commands: [
        "RECALLWEAVE_SOTA_OUTPUT_DIR=<private-output-dir-outside-repo>",
        "npm exec --yes pnpm@10.23.0 -- benchmark:sota-ladder -- --output reviews/overnight-20260522/sota-ladder-report.json --markdown-output reviews/overnight-20260522/sota-ladder-report.md",
        "npm exec --yes pnpm@10.23.0 -- benchmark:query-expansion:preflight -- --output reviews/overnight-20260522/query-expansion-preflight-next.json --markdown-output reviews/overnight-20260522/query-expansion-preflight-next.md",
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:public-provider:preflight --",
          `--target ${target}`,
          `--strategies ${providerStrategies}`,
          "--output reviews/overnight-20260522/provider-preflight-next.json",
        ].join(" "),
      ],
    },
    {
      id: "pure-local-query-expansion-arm",
      description: "Use this only after a local OpenAI-compatible model endpoint is running. This may count as local-only when no cloud model is used.",
      commands: [
        "SELFMEM_QUERY_EXPANSION_BASE_URL=<local-openai-compatible-url>",
        "SELFMEM_QUERY_EXPANSION_MODEL=<local-query-expansion-model>",
        "RECALLWEAVE_SOTA_OUTPUT_DIR=<private-output-dir-outside-repo>",
        "npm exec --yes pnpm@10.23.0 -- benchmark:query-expansion:preflight -- --require-ready",
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:public-strategy -- --live",
          `--target ${target}`,
          "--strategies bm25-lite,dense-proxy,full-hybrid-rerank,query-expanded-full-hybrid-rerank",
          "--context-token-budget 800",
          "--limit 5",
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/query-expansion-pure-local-result.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/query-expansion-pure-local-result.md\"",
        ].join(" "),
      ],
      beforeCountingAsLlmQueryExpansion: [
        "Verify the strategy used the configured local query-expansion endpoint, not only the deterministic expansion proxy.",
        "Record query-expansion latency separately from embedding and rerank latency.",
      ],
    },
    {
      id: "mixed-cloud-query-expansion-arm",
      description: "Use this when local hardware is the limiting factor. It must be labeled mixed local-plus-cloud, not pure local.",
      commands: [
        "RECALLWEAVE_QUERY_EXPANSION_CALLS=1",
        "RECALLWEAVE_QUERY_EXPANSION_PUBLIC_DATA=1",
        "NVIDIA_API_KEYS_FILE=<private-file-outside-repo>",
        "RECALLWEAVE_SOTA_OUTPUT_DIR=<private-output-dir-outside-repo>",
        "npm exec --yes pnpm@10.23.0 -- benchmark:query-expansion:preflight -- --require-ready",
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:public-strategy -- --live",
          `--target ${target}`,
          "--strategies bm25-lite,dense-proxy,full-hybrid-rerank,query-expanded-full-hybrid-rerank",
          "--context-token-budget 800",
          "--limit 5",
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/query-expansion-mixed-cloud-result.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/query-expansion-mixed-cloud-result.md\"",
        ].join(" "),
      ],
      beforeCountingAsLlmQueryExpansion: [
        "Verify only the current user query is sent to the cloud expansion model.",
        "Record provider, model, cost, and latency as a cloud substep.",
      ],
    },
    {
      id: "local-reranker-sidecar-arm",
      description: "Run the local Apple embedding arm with a separate local reranker endpoint.",
      commands: [
        "SELFMEM_LOCAL_EMBED_BASE_URL=<local-embedding-server-url>",
        "SELFMEM_LOCAL_RERANK_BASE_URL=<local-rerank-server-url>",
        "RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1",
        "RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1",
        "RECALLWEAVE_SOTA_OUTPUT_DIR=<private-output-dir-outside-repo>",
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:public-provider:preflight -- --require-ready",
          `--target ${target}`,
          "--strategies bm25-lite,full-hybrid-rerank,local-apple-qwen3-0_6b-local-rerank",
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/local-rerank-preflight.json\"",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:public-provider -- --live",
          `--target ${target}`,
          "--strategies bm25-lite,full-hybrid-rerank,local-apple-qwen3-0_6b-local-rerank",
          "--max-memory-bytes 80000000",
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/local-rerank-result.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/local-rerank-result.md\"",
        ].join(" "),
      ],
    },
    {
      id: "provider-comparison-ladder",
      description: "Run provider challengers on the same target only after preflight is ready and public-data/provider-call consent is explicit.",
      commands: [
        "RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1",
        "RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1",
        "VOYAGE_API_KEYS_FILE=<private-file-outside-repo>",
        "GEMINI_API_KEYS_FILE=<private-file-outside-repo>",
        "NVIDIA_API_KEYS_FILE=<private-file-outside-repo>",
        "SELFMEM_LOCAL_EMBED_BASE_URL=<local-embedding-server-url>",
        "RECALLWEAVE_SOTA_OUTPUT_DIR=<private-output-dir-outside-repo>",
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:public-provider:preflight -- --require-ready",
          `--target ${target}`,
          `--strategies ${providerStrategies}`,
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/provider-preflight-ready.json\"",
        ].join(" "),
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:public-provider -- --live",
          `--target ${target}`,
          `--strategies ${providerStrategies}`,
          "--max-memory-bytes 80000000",
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/provider-same-data-result.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/provider-same-data-result.md\"",
        ].join(" "),
      ],
    },
    {
      id: "end-to-end-memory-score-and-review",
      description: "Do not ship public benchmark or production-replacement claims until answer quality, reviewers, UI, docs, and owner approval are all present.",
      commands: [
        "RECALLWEAVE_SOTA_OUTPUT_DIR=<private-output-dir-outside-repo>",
        "npm exec --yes pnpm@10.23.0 -- benchmark:sota-ladder",
        [
          "npm exec --yes pnpm@10.23.0 -- benchmark:public-strategy -- --live",
          `--target ${target}`,
          `--strategies ${fullLadderStrategies}`,
          "--context-token-budget 800",
          "--limit 5",
          "--output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-ladder-same-data-result.json\"",
          "--markdown-output \"$RECALLWEAVE_SOTA_OUTPUT_DIR/full-ladder-same-data-result.md\"",
        ].join(" "),
        "npm exec --yes pnpm@10.23.0 -- baseline:packet -- --hosted <metrics-only-hosted-result.json> --recallweave <metrics-only-recallweave-result.json> --comparison <metrics-only-comparison.json> --preflight <metrics-only-preflight.json> --strict-real --output <metrics-only-reviewer-packet.zip>",
        "npm exec --yes pnpm@10.23.0 -- baseline:reviewer-intake -- --packet <metrics-only-reviewer-packet.zip> --comparison <metrics-only-comparison.json> --strict-target --review <reviewer-a-approval.json> --review <reviewer-b-approval.json> --output reviews/overnight-20260522/reviewer-approval-report.json",
      ],
    },
  ];
}

function runJson(nodeArgs) {
  const result = spawnSync("node", nodeArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, `command failed: ${nodeArgs[0]}`);
  assertSafePublicText(result.stdout, nodeArgs[0]);
  return JSON.parse(result.stdout);
}

function providerPreflightStrategy(strategy) {
  return (
    strategy === "bm25-lite" ||
    strategy === "full-hybrid-rerank" ||
    strategy.startsWith("cloud-") ||
    strategy.startsWith("local-apple-")
  );
}

function inspectQueryExpansionImplementation() {
  const file = "packages/bench/recallweave-response-export.mjs";
  const text = readFileSync(resolve(root, file), "utf8");
  assertSafePublicText(text, file);
  return {
    strategy: "query-expanded-full-hybrid-rerank",
    inspectedFile: file,
    usesDeterministicProxy: /function expandQuery\(/.test(text),
    importsLiveRequestBuilder: /buildQueryExpansionRequest/.test(text),
    liveLlmExpansionProven: /buildQueryExpansionRequest/.test(text) && !/function expandQuery\(/.test(text),
    claimRule: "Do not count this as a live LLM query-expansion arm until the run report proves the configured expander was used.",
  };
}

function loadEvidence(file) {
  const abs = resolve(root, file);
  if (!existsSync(abs)) return { path: file, exists: false, hash: null };
  const text = readFileSync(abs, "utf8");
  assertSafePublicText(text, file);
  return { path: file, exists: true, hash: `sha256:${sha256(text)}` };
}

function renderMarkdown(value) {
  return [
    "# RecallWeave SOTA Ladder Operator Packet",
    "",
    `- Status: ${value.status}`,
    `- Public benchmark claims allowed: ${value.publicBenchmarkClaimsAllowed}`,
    `- Target: ${value.target.path}`,
    `- Target hash: ${value.target.hash}`,
    "",
    "## Current Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Current Evidence",
    `- SOTA ladder: ${value.currentEvidence.sotaLadder.status}`,
    `- Query expansion preflight: ${value.currentEvidence.queryExpansionPreflight.status}`,
    `- Provider preflight: ${value.currentEvidence.providerPreflight.status}`,
    `- Local rerank evidence: ${value.currentEvidence.localRerankSidecar.evidenceExists}`,
    `- Live LLM query expansion proven: ${value.currentEvidence.queryExpansionImplementation.liveLlmExpansionProven}`,
    "",
    "## Operator Flow",
    ...value.operatorFlow.flatMap((step) => [
      `### ${step.id}`,
      "",
      step.description,
      "",
      "```bash",
      ...step.commands,
      "```",
      "",
      ...(step.beforeCountingAsLlmQueryExpansion
        ? ["Before counting this as LLM query expansion:", "", ...step.beforeCountingAsLlmQueryExpansion.map((item) => `- ${item}`), ""]
        : []),
    ]),
    "## Pass Criteria",
    ...value.passCriteria.map((item) => `- ${item}`),
    "",
    "## Reviewer Packet",
    ...value.reviewerPacket.reviewersMustReceive.map((item) => `- Attach: ${item}`),
    ...value.reviewerPacket.reviewersMustNotReceive.map((item) => `- Do not attach: ${item}`),
  ].join("\n");
}

function writeOutput(path, text) {
  const resolved = resolve(path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, text, { encoding: "utf8", mode: 0o600 });
}

function splitList(value) {
  return String(value ?? "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function hashNullable(value) {
  return value == null ? null : `sha256:${sha256(String(value))}`;
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function resolveInputPath(value) {
  return isAbsolute(String(value ?? "")) ? String(value) : resolve(root, String(value ?? ""));
}

function displayPath(value) {
  const rel = relative(root, value).replaceAll("\\", "/");
  return rel.startsWith("..") ? "external-input" : rel;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (!item.startsWith("--")) continue;
    const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function assertSafePublicText(text, label) {
  const secretPattern =
    /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
  const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;
  assert.doesNotMatch(String(text), secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(String(text), privatePathPattern, `${label} contains a private local path`);
}
