import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const args = parseArgs(process.argv.slice(2));
const format = String(args.format || "json").trim().toLowerCase();

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");

const resultPath = "/tmp/recallweave-hosted-baseline-result.json";
const recallWeaveResultPath = "/tmp/recallweave-result.json";
const recallWeaveResponsesPath = "/tmp/recallweave-search-responses.json";
const comparisonPath = "/tmp/recallweave-baseline-comparison.json";
const preflightPath = "/tmp/recallweave-hosted-baseline-preflight.json";
const discoveryPath = "/tmp/recallweave-hosted-baseline-discovery.json";
const privateContainerMapPath = "/tmp/recallweave-hosted-container-map.private.jsonl";
const templatePath = "/tmp/recallweave-hosted-baseline-template.json";
const querySetPath = "/tmp/recallweave-hosted-baseline-queryset.json";
const querySetReportPath = "/tmp/recallweave-hosted-baseline-queryset-report.json";
const evidencePacketPath = "/tmp/recallweave-baseline-evidence-packet.zip";

const packet = {
  ok: true,
  mode: "hosted-baseline-operator-packet",
  writesRealFiles: false,
  callsHostedProvider: false,
  publicSafe: true,
  purpose: "Collect or validate one metrics-only hosted Supermemory baseline without exposing raw memory data.",
  requiredSource: "isolated hosted test container or explicit read-only hosted source container plus a source-locked query set",
  outputs: {
    resultPath,
    recallWeaveResultPath,
    recallWeaveResponsesPath,
    comparisonPath,
    preflightPath,
    discoveryPath,
    privateContainerMapPath,
    templatePath,
    querySetPath,
    querySetReportPath,
    evidencePacketPath,
  },
  commands: [
    {
      id: "discover-hosted-containers",
      description: "List hosted Supermemory container candidates as counts and hashes only. This does not print raw labels or memory text.",
      command: [
        "RECALLWEAVE_BASELINE_LIVE=1",
        `npm exec --yes pnpm@10.23.0 -- baseline:discover -- --live --output ${discoveryPath}`,
      ].join(" "),
    },
    {
      id: "write-private-container-map",
      description: "Optional local-only step: write the raw label map outside git with 0600 permissions so the operator can set RECALLWEAVE_BASELINE_CONTAINER.",
      command: [
        "RECALLWEAVE_BASELINE_LIVE=1",
        "RECALLWEAVE_BASELINE_ALLOW_PRIVATE_LABELS=1",
        `npm exec --yes pnpm@10.23.0 -- baseline:discover -- --live --output ${discoveryPath} --private-map-output ${privateContainerMapPath}`,
      ].join(" "),
    },
    {
      id: "print-template",
      description: "Print the exact aggregate-only result schema before any hosted run.",
      command: `npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --print-template --output ${templatePath}`,
    },
    {
      id: "validate-fixture-shape",
      description: "Validate parser and gate behavior without calling a hosted provider.",
      command: "npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --fixture",
    },
    {
      id: "validate-query-set",
      description: "Inspect the source-locked query set as hashes and counts only. This fails under --strict if any query is unlabeled.",
      command: `npm exec --yes pnpm@10.23.0 -- baseline:queryset -- --queryset ${querySetPath} --strict --output ${querySetReportPath}`,
    },
    {
      id: "collect-live-result",
      description: "Run read-only hosted search through the metrics-only collector. SUPERMEMORY_API_KEY must already be set in the local environment.",
      command: [
        "RECALLWEAVE_BASELINE_LIVE=1",
        "RECALLWEAVE_BASELINE_NO_RAW_TEXT=1",
        "RECALLWEAVE_BASELINE_CONTAINER=<hosted-container-label>",
        `RECALLWEAVE_BASELINE_QUERYSET=${querySetPath}`,
        "RECALLWEAVE_BASELINE_RUN_ID=<unique-run-id>",
        "RECALLWEAVE_BASELINE_JUDGE_MODEL=<judge-model>",
        "RECALLWEAVE_BASELINE_ANSWER_MODEL=<answer-model>",
        `RECALLWEAVE_BASELINE_OUTPUT_JSON=${resultPath}`,
        `npm exec --yes pnpm@10.23.0 -- baseline:collect -- --live --output ${resultPath}`,
      ].join(" "),
    },
    {
      id: "validate-live-result",
      description: "Validate the metrics-only result after collection.",
      command: [
        "RECALLWEAVE_BASELINE_LIVE=1",
        "RECALLWEAVE_BASELINE_NO_RAW_TEXT=1",
        "RECALLWEAVE_BASELINE_CONTAINER=<hosted-container-label>",
        `RECALLWEAVE_BASELINE_QUERYSET=${querySetPath}`,
        "RECALLWEAVE_BASELINE_RUN_ID=<unique-run-id>",
        "RECALLWEAVE_BASELINE_JUDGE_MODEL=<judge-model>",
        "RECALLWEAVE_BASELINE_ANSWER_MODEL=<answer-model>",
        `RECALLWEAVE_BASELINE_OUTPUT_JSON=${resultPath}`,
        `npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --result ${resultPath} --output ${preflightPath}`,
      ].join(" "),
    },
    {
      id: "export-recallweave-responses",
      description: "Create the local RecallWeave metrics-only search response export from a local container. The export must not contain raw memory text.",
      command: [
        "RECALLWEAVE_BASELINE_LIVE=1",
        "RECALLWEAVE_BASELINE_NO_RAW_TEXT=1",
        `RECALLWEAVE_BASELINE_QUERYSET=${querySetPath}`,
        "RECALLWEAVE_BASELINE_CONTAINER_DIR=<local-recallweave-container-dir>",
        `npm exec --yes pnpm@10.23.0 -- baseline:export:recallweave -- --live --container-dir <local-recallweave-container-dir> --output ${recallWeaveResponsesPath}`,
      ].join(" "),
    },
    {
      id: "collect-recallweave-result",
      description: "Convert a metrics-only RecallWeave search response export into the matched RecallWeave result file.",
      command: [
        "RECALLWEAVE_BASELINE_LIVE=1",
        "RECALLWEAVE_BASELINE_NO_RAW_TEXT=1",
        `RECALLWEAVE_BASELINE_QUERYSET=${querySetPath}`,
        `RECALLWEAVE_BASELINE_RESPONSES_JSON=${recallWeaveResponsesPath}`,
        "RECALLWEAVE_BASELINE_RUN_ID=<same-run-id-or-matched-run-id>",
        "RECALLWEAVE_BASELINE_JUDGE_MODEL=<judge-model>",
        "RECALLWEAVE_BASELINE_ANSWER_MODEL=<answer-model>",
        `npm exec --yes pnpm@10.23.0 -- baseline:collect:recallweave -- --live --responses ${recallWeaveResponsesPath} --output ${recallWeaveResultPath}`,
      ].join(" "),
    },
    {
      id: "compare-matched-results",
      description: "Compare the aggregate hosted and RecallWeave result files. This still cannot authorize public claims without reviewer approvals.",
      command: [
        `RECALLWEAVE_REVIEWER_APPROVAL_COUNT=<0-until-reviewed>`,
        `npm exec --yes pnpm@10.23.0 -- baseline:compare -- --hosted ${resultPath} --recallweave ${recallWeaveResultPath} --output ${comparisonPath}`,
      ].join(" "),
    },
    {
      id: "package-baseline-evidence",
      description: "Package hosted result, RecallWeave result, comparison, and preflight into one metrics-only zip for reviewer intake.",
      command: [
        "npm exec --yes pnpm@10.23.0 -- baseline:packet --",
        `--hosted ${resultPath}`,
        `--recallweave ${recallWeaveResultPath}`,
        `--comparison ${comparisonPath}`,
        `--preflight ${preflightPath}`,
        "--strict-real",
        `--output ${evidencePacketPath}`,
      ].join(" "),
    },
  ],
  acceptanceCriteria: [
    "resultInspection.fixtureOnly is false",
    "resultInspection.provider is hosted-supermemory",
    "resultInspection.metricsOnly is true",
    "resultInspection.privacyLeakCount is 0",
    "resultInspection.redactionFailureCount is 0",
    "resultInspection.rawMemoryIncluded is false",
    "resultInspection.rawTranscriptIncluded is false",
    "resultInspection.rawPromptIncluded is false",
    "resultInspection.rawAnswerIncluded is false",
    "resultInspection.sameHarness is true",
    "resultInspection.sameDataset is true",
    "resultInspection.sameJudge is true",
    "resultInspection.sameAnswerModel is true",
    "resultInspection.hasQuerySetHash is true",
    "resultInspection.hasScoringCodeHash is true",
    "querySetEvidence.publicBenchmarkReady is true",
    "every query has at least one expectedResultId or expectedResultHash",
    "resultInspection.hasCostLatency is true",
    "baseline discovery output contains hashed container candidates only",
    "private container map, if created, stays local and is not attached",
    "matchedRecallWeaveRunPresent is true before comparison claims",
    "RecallWeave result provider is recallweave",
    "RecallWeave result shares dataset, query-set hash, scoring-code hash, judge model, and answer model",
    "reviewerApprovalCount is at least 2 before comparison claims",
    "recallWeaveWin is true before public comparison claims",
  ],
  attachOnly: [
    resultPath,
    recallWeaveResultPath,
    comparisonPath,
    preflightPath,
    discoveryPath,
    querySetReportPath,
    evidencePacketPath,
  ],
  forbidden: [
    "provider keys",
    "raw hosted memories",
    "raw local memories",
    "raw transcripts",
    "raw prompts",
    "raw answers",
    "cookies",
    "bearer tokens",
    "private local paths",
    "unredacted diagnostic archives",
    "raw RecallWeave response exports that contain memory text",
    "private container map",
  ],
  operatorMessage: buildMarkdown(),
};

const serialized = format === "markdown"
  ? `${packet.operatorMessage}\n`
  : `${JSON.stringify(packet, null, 2)}\n`;

assert.doesNotMatch(serialized, secretPattern(), "operator packet contains a key-shaped secret");
assert.doesNotMatch(serialized, privatePathPattern(), "operator packet contains a raw private path");
process.stdout.write(serialized);

function buildMarkdown() {
  return [
    "# RecallWeave Hosted Baseline Packet",
    "",
    "Goal: collect one read-only hosted Supermemory baseline with aggregate metrics only. Do not send raw memory logs.",
    "",
    "## Run",
    "",
    "First print the result template:",
    "",
    "```bash",
    `npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --print-template --output ${templatePath}`,
    "```",
    "",
    "Then validate the parser without a hosted call:",
    "",
    "```bash",
    "npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --fixture",
    "```",
    "",
    "Discover hosted container candidates without printing raw labels or memory text:",
    "",
    "```bash",
    "RECALLWEAVE_BASELINE_LIVE=1 \\",
    `npm exec --yes pnpm@10.23.0 -- baseline:discover -- --live --output ${discoveryPath}`,
    "```",
    "",
    "Optional local-only step: write a private raw-label map outside git, then use that map to set `RECALLWEAVE_BASELINE_CONTAINER`. Do not attach this file.",
    "",
    "```bash",
    "RECALLWEAVE_BASELINE_LIVE=1 \\",
    "RECALLWEAVE_BASELINE_ALLOW_PRIVATE_LABELS=1 \\",
    `npm exec --yes pnpm@10.23.0 -- baseline:discover -- --live --output ${discoveryPath} --private-map-output ${privateContainerMapPath}`,
    "```",
    "",
    "Prepare a source-locked query set locally at this path:",
    "",
    "```text",
    querySetPath,
    "```",
    "",
    "Validate the query set before either side collects results. The report prints hashes and counts only, and strict mode fails when any query lacks a relevance label.",
    "",
    "```bash",
    `npm exec --yes pnpm@10.23.0 -- baseline:queryset -- --queryset ${querySetPath} --strict --output ${querySetReportPath}`,
    "```",
    "",
    "Then run the read-only hosted collector. Set `SUPERMEMORY_API_KEY` in the local environment first; do not paste it into the command or any attachment.",
    "",
    "```bash",
    "RECALLWEAVE_BASELINE_LIVE=1 \\",
    "RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 \\",
    "RECALLWEAVE_BASELINE_CONTAINER=<hosted-container-label> \\",
    `RECALLWEAVE_BASELINE_QUERYSET=${querySetPath} \\`,
    "RECALLWEAVE_BASELINE_RUN_ID=<unique-run-id> \\",
    "RECALLWEAVE_BASELINE_JUDGE_MODEL=<judge-model> \\",
    "RECALLWEAVE_BASELINE_ANSWER_MODEL=<answer-model> \\",
    `RECALLWEAVE_BASELINE_OUTPUT_JSON=${resultPath} \\`,
    `npm exec --yes pnpm@10.23.0 -- baseline:collect -- --live --output ${resultPath}`,
    "```",
    "",
    "Then validate the aggregate-only result:",
    "",
    "```bash",
    "RECALLWEAVE_BASELINE_LIVE=1 \\",
    "RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 \\",
    "RECALLWEAVE_BASELINE_CONTAINER=<hosted-container-label> \\",
    `RECALLWEAVE_BASELINE_QUERYSET=${querySetPath} \\`,
    "RECALLWEAVE_BASELINE_RUN_ID=<unique-run-id> \\",
    "RECALLWEAVE_BASELINE_JUDGE_MODEL=<judge-model> \\",
    "RECALLWEAVE_BASELINE_ANSWER_MODEL=<answer-model> \\",
    `RECALLWEAVE_BASELINE_OUTPUT_JSON=${resultPath} \\`,
    `npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --result ${resultPath} --output ${preflightPath}`,
    "```",
    "",
    "Export RecallWeave search responses locally as hashed memory identifiers, content hashes, scores, timings, token estimates, and privacy counters. Do not include raw memory text. Save that response export here:",
    "",
    "```text",
    recallWeaveResponsesPath,
    "```",
    "",
    "Use the provided exporter when the agent has a local RecallWeave container directory:",
    "",
    "Important: write this file with `--output`. Do not shell-redirect the package-manager command into the JSON file, because wrapper banners can corrupt the evidence file.",
    "",
    "```bash",
    "RECALLWEAVE_BASELINE_LIVE=1 \\",
    "RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 \\",
    `RECALLWEAVE_BASELINE_QUERYSET=${querySetPath} \\`,
    "RECALLWEAVE_BASELINE_CONTAINER_DIR=<local-recallweave-container-dir> \\",
    `npm exec --yes pnpm@10.23.0 -- baseline:export:recallweave -- --live --container-dir <local-recallweave-container-dir> --output ${recallWeaveResponsesPath}`,
    "```",
    "",
    "Then convert it into the matched RecallWeave aggregate result:",
    "",
    "```bash",
    "RECALLWEAVE_BASELINE_LIVE=1 \\",
    "RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 \\",
    `RECALLWEAVE_BASELINE_QUERYSET=${querySetPath} \\`,
    `RECALLWEAVE_BASELINE_RESPONSES_JSON=${recallWeaveResponsesPath} \\`,
    "RECALLWEAVE_BASELINE_RUN_ID=<same-run-id-or-matched-run-id> \\",
    "RECALLWEAVE_BASELINE_JUDGE_MODEL=<judge-model> \\",
    "RECALLWEAVE_BASELINE_ANSWER_MODEL=<answer-model> \\",
    `npm exec --yes pnpm@10.23.0 -- baseline:collect:recallweave -- --live --responses ${recallWeaveResponsesPath} --output ${recallWeaveResultPath}`,
    "```",
    "",
    "Then compare the matched aggregate files:",
    "",
    "```bash",
    "RECALLWEAVE_REVIEWER_APPROVAL_COUNT=<0-until-reviewed> \\",
    `npm exec --yes pnpm@10.23.0 -- baseline:compare -- --hosted ${resultPath} --recallweave ${recallWeaveResultPath} --output ${comparisonPath}`,
    "```",
    "",
    "Then package the aggregate evidence into one reviewer zip:",
    "",
    "```bash",
    "npm exec --yes pnpm@10.23.0 -- baseline:packet -- \\",
    `  --hosted ${resultPath} \\`,
    `  --recallweave ${recallWeaveResultPath} \\`,
    `  --comparison ${comparisonPath} \\`,
    `  --preflight ${preflightPath} \\`,
    "  --strict-real \\",
    `  --output ${evidencePacketPath}`,
    "```",
    "",
    "## Attach Only",
    "",
    `- ${resultPath}`,
    `- ${recallWeaveResultPath}`,
    `- ${comparisonPath}`,
    `- ${preflightPath}`,
    `- ${discoveryPath}`,
    `- ${querySetReportPath}`,
    `- ${evidencePacketPath}`,
    "",
    "## Pass Criteria",
    "",
    ...packetAcceptanceLines(),
    "",
    "Do not attach provider keys, raw hosted memories, raw local memories, raw RecallWeave response exports containing memory text, transcripts, prompts, answers, cookies, bearer tokens, private local paths, private container maps, or unredacted diagnostic archives.",
  ].join("\n");
}

function packetAcceptanceLines() {
  return [
    "- not a fixture",
    "- hosted Supermemory provider label",
    "- metrics-only output",
    "- zero privacy leaks and zero redaction failures",
    "- no raw memory, transcript, prompt, or answer text",
    "- same harness, dataset, judge, and answer model as the RecallWeave run",
    "- query-set and scoring-code hashes present",
    "- query-set report is metrics-only and publicBenchmarkReady is true",
    "- every query has at least one expected result id or expected content hash",
    "- querySetEvidence.publicBenchmarkReady is true for both runs",
    "- baseline discovery output contains hashed container candidates only",
    "- private container maps stay local and are not attached",
    "- matched RecallWeave result shares query-set and scoring-code hashes",
    "- cost and latency fields present",
    "- matched RecallWeave run, two reviewer approvals, and RecallWeave win before public comparison claims",
  ];
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item.startsWith("--")) {
      parsed[toCamel(item.slice(2))] = argv[index + 1] ?? "";
      index += 1;
    }
  }
  return parsed;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function secretPattern() {
  return /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
}

function privatePathPattern() {
  return /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;
}

export function packetHashForTest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
