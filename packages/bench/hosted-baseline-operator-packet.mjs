import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const args = parseArgs(process.argv.slice(2));
const format = String(args.format || "json").trim().toLowerCase();

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");

const resultPath = "/tmp/recallweave-hosted-baseline-result.json";
const preflightPath = "/tmp/recallweave-hosted-baseline-preflight.json";
const templatePath = "/tmp/recallweave-hosted-baseline-template.json";

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
    preflightPath,
    templatePath,
  },
  commands: [
    {
      id: "print-template",
      description: "Print the exact aggregate-only result schema before any hosted run.",
      command: `npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --print-template > ${templatePath}`,
    },
    {
      id: "validate-fixture-shape",
      description: "Validate parser and gate behavior without calling a hosted provider.",
      command: "npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --fixture",
    },
    {
      id: "validate-live-result",
      description: "After an external hosted read-only collection writes aggregate metrics, validate the result.",
      command: [
        "RECALLWEAVE_BASELINE_LIVE=1",
        "RECALLWEAVE_BASELINE_NO_RAW_TEXT=1",
        "RECALLWEAVE_BASELINE_CONTAINER=<hosted-container-label>",
        "RECALLWEAVE_BASELINE_QUERYSET=<source-locked-queryset-id-or-path>",
        "RECALLWEAVE_BASELINE_RUN_ID=<unique-run-id>",
        "RECALLWEAVE_BASELINE_JUDGE_MODEL=<judge-model>",
        "RECALLWEAVE_BASELINE_ANSWER_MODEL=<answer-model>",
        `RECALLWEAVE_BASELINE_OUTPUT_JSON=${resultPath}`,
        `npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --result ${resultPath} > ${preflightPath}`,
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
    "resultInspection.hasCostLatency is true",
    "matchedRecallWeaveRunPresent is true before comparison claims",
    "reviewerApprovalCount is at least 2 before comparison claims",
    "recallWeaveWin is true before public comparison claims",
  ],
  attachOnly: [
    resultPath,
    preflightPath,
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
    `npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --print-template > ${templatePath}`,
    "```",
    "",
    "Then validate the parser without a hosted call:",
    "",
    "```bash",
    "npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --fixture",
    "```",
    "",
    "After an external read-only hosted collection writes aggregate metrics, validate the result:",
    "",
    "```bash",
    "RECALLWEAVE_BASELINE_LIVE=1 \\",
    "RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 \\",
    "RECALLWEAVE_BASELINE_CONTAINER=<hosted-container-label> \\",
    "RECALLWEAVE_BASELINE_QUERYSET=<source-locked-queryset-id-or-path> \\",
    "RECALLWEAVE_BASELINE_RUN_ID=<unique-run-id> \\",
    "RECALLWEAVE_BASELINE_JUDGE_MODEL=<judge-model> \\",
    "RECALLWEAVE_BASELINE_ANSWER_MODEL=<answer-model> \\",
    `RECALLWEAVE_BASELINE_OUTPUT_JSON=${resultPath} \\`,
    `npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --result ${resultPath} > ${preflightPath}`,
    "```",
    "",
    "## Attach Only",
    "",
    `- ${resultPath}`,
    `- ${preflightPath}`,
    "",
    "## Pass Criteria",
    "",
    ...packetAcceptanceLines(),
    "",
    "Do not attach provider keys, raw hosted memories, raw local memories, transcripts, prompts, answers, cookies, bearer tokens, private local paths, or unredacted diagnostic archives.",
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
