import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const format = String(args.format || "json").trim().toLowerCase();
const discoverySummary = args.discovery ? loadDiscoverySummary(args.discovery) : null;

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");

const resultPath = "/tmp/recallweave-hosted-baseline-result.json";
const recallWeaveResultPath = "/tmp/recallweave-result.json";
const recallWeaveResponsesPath = "/tmp/recallweave-search-responses.json";
const comparisonPath = "/tmp/recallweave-baseline-comparison.json";
const preflightPath = "/tmp/recallweave-hosted-baseline-preflight.json";
const discoveryPath = "/tmp/recallweave-hosted-baseline-discovery.json";
const privateContainerMapPath = "/tmp/recallweave-hosted-container-map.private.jsonl";
const privateContainerEnvPath = "/tmp/recallweave-hosted-baseline.private.env";
const templatePath = "/tmp/recallweave-hosted-baseline-template.json";
const querySetPath = "/tmp/recallweave-hosted-baseline-queryset.json";
const querySetAuthorReportPath = "/tmp/recallweave-hosted-baseline-queryset-author-report.json";
const querySetReportPath = "/tmp/recallweave-hosted-baseline-queryset-report.json";
const sourceMatchPath = "/tmp/recallweave-baseline-source-match.json";
const sourceAlignmentPath = "/tmp/recallweave-baseline-source-alignment.json";
const sourceGapPath = "/tmp/recallweave-baseline-source-gap.json";
const evidencePacketPath = "/tmp/recallweave-baseline-evidence-packet.zip";
const baselineRunReportPath = "/tmp/recallweave-baseline-run.json";

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
    privateContainerEnvPath,
    templatePath,
    querySetPath,
    querySetAuthorReportPath,
    querySetReportPath,
    sourceMatchPath,
    sourceAlignmentPath,
    sourceGapPath,
    evidencePacketPath,
    baselineRunReportPath,
  },
  liveDiscovery: discoverySummary,
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
      id: "select-private-container",
      description: "Local-only step: select one hashed candidate into a sourceable 0600 env file without printing the raw label.",
      command: [
        "npm exec --yes pnpm@10.23.0 -- baseline:select-container --",
        `--discovery ${discoveryPath}`,
        `--private-map ${privateContainerMapPath}`,
        `--env-output ${privateContainerEnvPath}`,
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
      id: "author-private-query-set",
      description: "Optional local-only step: draft a review-required private query set from the selected hosted container while printing only hashes and counts.",
      command: [
        "RECALLWEAVE_BASELINE_LIVE=1",
        "npm exec --yes pnpm@10.23.0 -- baseline:author-queryset --",
        `--live --discovery ${discoveryPath}`,
        `--private-map ${privateContainerMapPath}`,
        `--queryset-output ${querySetPath}`,
        `--output ${querySetAuthorReportPath}`,
      ].join(" "),
    },
    {
      id: "validate-query-set",
      description: "Inspect the source-locked query set as hashes and counts only. This fails under --strict if any query is unlabeled.",
      command: `npm exec --yes pnpm@10.23.0 -- baseline:queryset -- --queryset ${querySetPath} --strict --output ${querySetReportPath}`,
    },
    {
      id: "preflight-local-source-match",
      description: "Prove the reviewed query labels can be satisfied by the selected local RecallWeave source before any hosted/local run.",
      command: [
        "RECALLWEAVE_BASELINE_LIVE=1",
        "RECALLWEAVE_BASELINE_NO_RAW_TEXT=1",
        `npm exec --yes pnpm@10.23.0 -- baseline:source-match -- --live --queryset ${querySetPath}`,
        "--container-dir <local-recallweave-container-dir>",
        "--strict",
        `--output ${sourceMatchPath}`,
      ].join(" "),
    },
    {
      id: "preflight-source-alignment",
      description: "Prove the hosted label and local container map align, and that source-match content is ready for a fair benchmark.",
      command: [
        "npm exec --yes pnpm@10.23.0 -- baseline:source-align --",
        `--source-match ${sourceMatchPath}`,
        "--local-map <local-container-map.json>",
        `--private-map ${privateContainerMapPath}`,
        "--strict",
        `--output ${sourceAlignmentPath}`,
      ].join(" "),
    },
    {
      id: "plan-source-gap",
      description: "Turn source-match and source-alignment reports into a public-safe repair plan before spending hosted comparison calls.",
      command: [
        "npm exec --yes pnpm@10.23.0 -- baseline:source-gap --",
        `--source-match ${sourceMatchPath}`,
        `--source-alignment ${sourceAlignmentPath}`,
        `--output ${sourceGapPath}`,
      ].join(" "),
    },
    {
      id: "run-matched-baseline-chain",
      description: "After the private query set, source-match preflight, source-alignment gate, and source-gap plan pass, run the hosted arm, local RecallWeave arm, comparison, packet, and returned-packet intake in one metrics-only chain.",
      command: [
        `. ${privateContainerEnvPath} &&`,
        "RECALLWEAVE_BASELINE_LIVE=1",
        "RECALLWEAVE_BASELINE_NO_RAW_TEXT=1",
        "RECALLWEAVE_BASELINE_QUERYSET_REVIEWED=1",
        `RECALLWEAVE_BASELINE_QUERYSET=${querySetPath}`,
        "RECALLWEAVE_BASELINE_RUN_ID=<unique-run-id>",
        "RECALLWEAVE_BASELINE_JUDGE_MODEL=<judge-model>",
        "RECALLWEAVE_BASELINE_ANSWER_MODEL=<answer-model>",
        `npm exec --yes pnpm@10.23.0 -- baseline:run -- --live --container-env ${privateContainerEnvPath} --queryset ${querySetPath} --container-dir <local-recallweave-container-dir> --local-map <local-container-map.json> --private-map ${privateContainerMapPath} --reviewed-queryset --output ${baselineRunReportPath}`,
      ].join(" "),
    },
    {
      id: "collect-live-result",
      description: "Run read-only hosted search through the metrics-only collector. SUPERMEMORY_API_KEY must already be set in the local environment.",
      command: [
        `. ${privateContainerEnvPath} &&`,
        "RECALLWEAVE_BASELINE_LIVE=1",
        "RECALLWEAVE_BASELINE_NO_RAW_TEXT=1",
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
        `. ${privateContainerEnvPath} &&`,
        "RECALLWEAVE_BASELINE_LIVE=1",
        "RECALLWEAVE_BASELINE_NO_RAW_TEXT=1",
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
    "private query set, if auto-authored, was reviewed locally before collection",
    "baseline:run was used for one-command hosted/local/compare/packet/intake collection when private inputs were ready",
    "every query has at least one expectedResultId or expectedResultHash",
    "resultInspection.hasCostLatency is true",
    "baseline discovery output contains hashed container candidates only",
    "source-match preflight proves every reviewed query has at least one collectable expected ref in the local RecallWeave source",
    "source-alignment gate proves the hosted label and local container map align and matchedBaselineRunAllowed is true",
    "source-gap plan reports READY_FOR_MATCHED_BASELINE before hosted collection, or a blocked repair path if not ready",
    "private container map, if created, stays local and is not attached",
    "private env file, if created, stays local and is not attached",
    "private query set, if created, stays local and is not attached",
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
    querySetAuthorReportPath,
    querySetReportPath,
    sourceMatchPath,
    sourceAlignmentPath,
    sourceGapPath,
    evidencePacketPath,
    baselineRunReportPath,
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
    "private hosted baseline env file",
    "private hosted baseline query set",
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
    ...discoveryMarkdownLines(),
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
    "Optional local-only step: write a private raw-label map outside git, then select one hashed candidate into a private env file. Do not attach either file.",
    "",
    "```bash",
    "RECALLWEAVE_BASELINE_LIVE=1 \\",
    "RECALLWEAVE_BASELINE_ALLOW_PRIVATE_LABELS=1 \\",
    `npm exec --yes pnpm@10.23.0 -- baseline:discover -- --live --output ${discoveryPath} --private-map-output ${privateContainerMapPath}`,
    "```",
    "",
    "Then write the selected raw label into a sourceable private env file without printing it:",
    "",
    "```bash",
    "npm exec --yes pnpm@10.23.0 -- baseline:select-container -- \\",
    `  --discovery ${discoveryPath} \\`,
    `  --private-map ${privateContainerMapPath} \\`,
    `  --env-output ${privateContainerEnvPath}`,
    "```",
    "",
    "Optionally draft a review-required private query set from the selected hosted container. The command prints only hashes and counts. Review the private file locally before collection, and do not attach it.",
    "",
    "```bash",
    "RECALLWEAVE_BASELINE_LIVE=1 \\",
    "npm exec --yes pnpm@10.23.0 -- baseline:author-queryset -- \\",
    `  --live --discovery ${discoveryPath} \\`,
    `  --private-map ${privateContainerMapPath} \\`,
    `  --queryset-output ${querySetPath} \\`,
    `  --output ${querySetAuthorReportPath}`,
    "```",
    "",
    "Prepare or review the source-locked query set locally at this path:",
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
    "Before any hosted/local run, prove the reviewed labels are collectable from the local RecallWeave source:",
    "",
    "```bash",
    "RECALLWEAVE_BASELINE_LIVE=1 \\",
    "RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 \\",
    `npm exec --yes pnpm@10.23.0 -- baseline:source-match -- --live --queryset ${querySetPath} \\`,
    "  --container-dir <local-recallweave-container-dir> \\",
    "  --strict \\",
    `  --output ${sourceMatchPath}`,
    "```",
    "",
    "Then prove the selected hosted label and local container map line up with that source-match report:",
    "",
    "```bash",
    "npm exec --yes pnpm@10.23.0 -- baseline:source-align -- \\",
    `  --source-match ${sourceMatchPath} \\`,
    "  --local-map <local-container-map.json> \\",
    `  --private-map ${privateContainerMapPath} \\`,
    "  --strict \\",
    `  --output ${sourceAlignmentPath}`,
    "```",
    "",
    "Then write the public-safe source-gap plan. If it is not READY_FOR_MATCHED_BASELINE, stop and follow its repair path before hosted collection:",
    "",
    "```bash",
    "npm exec --yes pnpm@10.23.0 -- baseline:source-gap -- \\",
    `  --source-match ${sourceMatchPath} \\`,
    `  --source-alignment ${sourceAlignmentPath} \\`,
    `  --output ${sourceGapPath}`,
    "```",
    "",
    "Once the private env file, reviewed query set, source-match preflight, source-alignment gate, source-gap plan, and local RecallWeave container path are ready, prefer the one-command runner. It repeats the source gates, then performs hosted collection, local export, local collection, comparison, preflight, packet creation, and returned-packet intake together.",
    "",
    "```bash",
    `. ${privateContainerEnvPath}`,
    "RECALLWEAVE_BASELINE_LIVE=1 \\",
    "RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 \\",
    "RECALLWEAVE_BASELINE_QUERYSET_REVIEWED=1 \\",
    `RECALLWEAVE_BASELINE_QUERYSET=${querySetPath} \\`,
    "RECALLWEAVE_BASELINE_RUN_ID=<unique-run-id> \\",
    "RECALLWEAVE_BASELINE_JUDGE_MODEL=<judge-model> \\",
    "RECALLWEAVE_BASELINE_ANSWER_MODEL=<answer-model> \\",
    `npm exec --yes pnpm@10.23.0 -- baseline:run -- --live --container-env ${privateContainerEnvPath} --queryset ${querySetPath} --container-dir <local-recallweave-container-dir> --local-map <local-container-map.json> --private-map ${privateContainerMapPath} --reviewed-queryset --output ${baselineRunReportPath}`,
    "```",
    "",
    "The individual commands below remain available when you need to debug one stage.",
    "",
    "Then run the read-only hosted collector. Set `SUPERMEMORY_API_KEY` in the local environment first; do not paste it into the command or any attachment.",
    "",
    "```bash",
    `. ${privateContainerEnvPath}`,
    "RECALLWEAVE_BASELINE_LIVE=1 \\",
    "RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 \\",
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
    `. ${privateContainerEnvPath}`,
    "RECALLWEAVE_BASELINE_LIVE=1 \\",
    "RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 \\",
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
    `- ${querySetAuthorReportPath}`,
    `- ${querySetReportPath}`,
    `- ${sourceMatchPath}`,
    `- ${sourceAlignmentPath}`,
    `- ${sourceGapPath}`,
    `- ${evidencePacketPath}`,
    `- ${baselineRunReportPath}`,
    "",
    "## Pass Criteria",
    "",
    ...packetAcceptanceLines(),
    "",
    "Do not attach provider keys, raw hosted memories, raw local memories, raw RecallWeave response exports containing memory text, transcripts, prompts, answers, cookies, bearer tokens, private local paths, private container maps, private env files, private query sets, or unredacted diagnostic archives.",
  ].join("\n");
}

function discoveryMarkdownLines() {
  if (!discoverySummary) return [];
  return [
    "## Current Live Discovery",
    "",
    `- Report: ${discoverySummary.reportLabel}`,
    `- Hosted provider called: ${discoverySummary.callsHostedProvider ? "yes" : "no"}`,
    `- Fixture: ${discoverySummary.fixtureOnly ? "yes" : "no"}`,
    `- Documents seen: ${discoverySummary.documentsSeen}`,
    `- Hashed container candidates: ${discoverySummary.containerCandidateCount}`,
    `- Recommended hashed candidate: ${discoverySummary.recommendedCandidateId ?? "none"}`,
    "- Raw labels included: no",
    "- Raw memory included: no",
    "- Privacy leaks: 0",
    "",
    "Use the optional private-map and selector commands only on the local operator machine to translate a hashed candidate into a private env file. Do not attach that private map or env file.",
    "",
  ];
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
    "- any auto-authored private query set was locally reviewed before collection",
    "- every query has at least one expected result id or expected content hash",
    "- querySetEvidence.publicBenchmarkReady is true for both runs",
    "- source-match preflight proves every reviewed query has at least one collectable expected ref in the local RecallWeave source",
    "- source-alignment gate proves the hosted label and local container map align and matchedBaselineRunAllowed is true",
    "- source-gap plan reports READY_FOR_MATCHED_BASELINE or a blocked repair path before hosted collection",
    "- baseline discovery output contains hashed container candidates only",
    "- private container maps stay local and are not attached",
    "- private hosted baseline env files stay local and are not attached",
    "- private hosted baseline query sets stay local and are not attached",
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

function loadDiscoverySummary(inputPath) {
  const resolved = isAbsolute(inputPath) ? inputPath : resolve(root, inputPath);
  assert.ok(existsSync(resolved), `discovery report missing: ${displayPath(resolved)}`);
  const raw = readFileSync(resolved, "utf8");
  assertSafeText(raw, "discovery report");
  const json = JSON.parse(raw);
  assert.equal(json.mode, "hosted-baseline-discovery", "discovery report mode mismatch");
  assert.equal(json.publicSafe, true, "discovery report must be public-safe");
  assert.equal(json.metricsOnly, true, "discovery report must be metrics-only");
  assert.equal(json.rawLabelsIncluded, false, "discovery report must not include raw labels");
  assert.equal(json.rawMemoryIncluded, false, "discovery report must not include raw memory");
  assert.equal(json.rawTranscriptIncluded, false, "discovery report must not include raw transcripts");
  assert.equal(json.rawPromptIncluded, false, "discovery report must not include raw prompts");
  assert.equal(json.rawAnswerIncluded, false, "discovery report must not include raw answers");
  assert.equal(Number(json.privacyLeakCount ?? 0), 0, "discovery report privacy leaks must be zero");
  assert.equal(Number(json.redactionFailureCount ?? 0), 0, "discovery report redaction failures must be zero");
  assert.ok(Number(json.sourceStats?.documentsSeen ?? 0) > 0, "discovery report must include documents seen");
  assert.ok(Number(json.containerCandidateCount ?? 0) > 0, "discovery report must include hashed container candidates");
  const candidateIds = (json.containerCandidates ?? []).map((candidate) => String(candidate.candidateId ?? ""));
  for (const candidateId of candidateIds) {
    assert.match(candidateId, /^c_[a-f0-9]{16}$/, "candidate id must be hashed");
  }
  const recommendedCandidateId = json.recommendedCandidateId ?? null;
  if (recommendedCandidateId) {
    assert.match(String(recommendedCandidateId), /^c_[a-f0-9]{16}$/, "recommended candidate id must be hashed");
    assert.equal(candidateIds.includes(String(recommendedCandidateId)), true, "recommended candidate id must exist in candidate list");
  }
  return {
    reportLabel: displayPath(resolved),
    fixtureOnly: Boolean(json.fixtureOnly),
    callsHostedProvider: json.callsHostedProvider === true,
    documentsSeen: Number(json.sourceStats?.documentsSeen ?? 0),
    containerCandidateCount: Number(json.containerCandidateCount ?? 0),
    recommendedCandidateId,
    candidateIds,
    rawLabelsIncluded: false,
    rawMemoryIncluded: false,
    privacyLeakCount: 0,
    redactionFailureCount: 0,
  };
}

function displayPath(value) {
  const rel = relative(root, value).replaceAll("\\", "/");
  if (!rel.startsWith("../") && rel !== "..") return rel;
  return `external:${basename(value)}`;
}

function assertSafeText(text, label) {
  assert.doesNotMatch(text, secretPattern(), `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern(), `${label} contains a raw private path`);
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
