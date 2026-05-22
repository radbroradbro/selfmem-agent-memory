import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const args = parseArgs(process.argv.slice(2));
const host = String(args.host || "hermes").trim().toLowerCase();
const format = String(args.format || "json").trim().toLowerCase();

assert.ok(["hermes", "openclaw"].includes(host), "--host must be hermes or openclaw");
assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");

const runtimeLabel = host === "hermes" ? "Hermes" : "OpenClaw";
const repoPlaceholder = host === "hermes" ? "<hermes-checkout>" : "<openclaw-checkout>";
const canaryReport = "/tmp/recallweave-canary-report.json";
const intakeReport = "/tmp/recallweave-canary-intake.json";
const diagnosisReport = "/tmp/recallweave-canary-diagnosis.json";

const packet = {
  ok: true,
  mode: "strict-real-canary-operator-packet",
  writesRealFiles: false,
  publicSafe: true,
  host,
  runtime: runtimeLabel,
  purpose: "Collect one fresh patched real-agent canary without exposing raw memory data.",
  requiredSource: "live mapped container or explicit redacted diagnostic directory/zip",
  canaryOutput: canaryReport,
  intakeOutput: intakeReport,
  diagnosisOutput: diagnosisReport,
  commands: [
    {
      id: "dry-run-update",
      description: "Show the update plan without copying files.",
      command: `bin/selfmem_update --host ${host} --repo ${repoPlaceholder}`,
    },
    {
      id: "apply-and-collect-live-container",
      description: "Apply the adapter and collect a strict-real report from the newest mapped live container.",
      command: [
        `bin/selfmem_update --host ${host} --repo ${repoPlaceholder} --apply --run-canary --rollback-tested --strict-real --canary-output ${canaryReport}`,
        `npm exec --yes pnpm@10.23.0 -- canary:intake -- --report ${canaryReport} --strict-real > ${intakeReport}`,
      ].join(" && "),
    },
    {
      id: "collect-from-redacted-diagnostic-dir",
      description: "Use this instead when the agent exports a redacted diagnostic directory.",
      command: [
        `bin/selfmem_update --host ${host} --repo ${repoPlaceholder} --run-canary --rollback-tested --strict-real --canary-diagnostic-dir <redacted-diagnostic-dir> --canary-output ${canaryReport}`,
        `npm exec --yes pnpm@10.23.0 -- canary:intake -- --report ${canaryReport} --strict-real > ${intakeReport}`,
      ].join(" && "),
    },
    {
      id: "collect-from-redacted-diagnostic-zip",
      description: "Use this instead when the agent exports a redacted diagnostic zip.",
      command: [
        `bin/selfmem_update --host ${host} --repo ${repoPlaceholder} --run-canary --rollback-tested --strict-real --canary-diagnostic-zip <redacted-diagnostic.zip> --canary-output ${canaryReport}`,
        `npm exec --yes pnpm@10.23.0 -- canary:intake -- --report ${canaryReport} --strict-real > ${intakeReport}`,
      ].join(" && "),
    },
    {
      id: "diagnose-on-failure",
      description: "Run only if strict intake fails. Attach this metrics-only output, not raw logs.",
      command: `npm exec --yes pnpm@10.23.0 -- canary:diagnose -- --report ${canaryReport} > ${diagnosisReport}`,
    },
  ],
  acceptanceCriteria: [
    "canaryPass is true",
    "fixtureOnly is false",
    "countsAsRealRolloutEvidence is true",
    "privacy.privacyLeakCount is 0",
    "privacy.secretPatternHits is 0",
    "instrumentation.storeLatencySampleCount is greater than 0",
    "instrumentation.missingStoreLatencyCount is 0",
    "latencyMs.recallP95 is greater than 0 and at most 2500",
    "latencyMs.storeP95 is greater than 0 and at most 2500",
    "quality.lifecycleCovered is true",
    "quality.hybridSearchCovered is true",
    "quality.localWritesObserved is true",
    "quality.hostedReadThroughObserved is true",
    "rollback.available is true and rollback.tested is true",
  ],
  attachOnly: [
    canaryReport,
    intakeReport,
    diagnosisReport,
  ],
  forbidden: [
    "raw memories",
    "raw transcripts",
    "raw prompts",
    "raw answers",
    "provider keys",
    "cookies",
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
    `# RecallWeave Strict-Real Canary Packet (${runtimeLabel})`,
    "",
    "Goal: collect one fresh patched real-agent canary. Do not send raw memory logs.",
    "",
    "## Run",
    "",
    "First dry-run the update:",
    "",
    "```bash",
    `bin/selfmem_update --host ${host} --repo ${repoPlaceholder}`,
    "```",
    "",
    "Then apply and collect from the live mapped container:",
    "",
    "```bash",
    `bin/selfmem_update --host ${host} --repo ${repoPlaceholder} --apply --run-canary --rollback-tested --strict-real --canary-output ${canaryReport}`,
    `npm exec --yes pnpm@10.23.0 -- canary:intake -- --report ${canaryReport} --strict-real > ${intakeReport}`,
    "```",
    "",
    "If you only have a redacted diagnostic export, use one of these instead:",
    "",
    "```bash",
    `bin/selfmem_update --host ${host} --repo ${repoPlaceholder} --run-canary --rollback-tested --strict-real --canary-diagnostic-dir <redacted-diagnostic-dir> --canary-output ${canaryReport}`,
    `bin/selfmem_update --host ${host} --repo ${repoPlaceholder} --run-canary --rollback-tested --strict-real --canary-diagnostic-zip <redacted-diagnostic.zip> --canary-output ${canaryReport}`,
    "```",
    "",
    "If strict intake fails, diagnose the metrics only:",
    "",
    "```bash",
    `npm exec --yes pnpm@10.23.0 -- canary:diagnose -- --report ${canaryReport} > ${diagnosisReport}`,
    "```",
    "",
    "## Attach Only",
    "",
    `- ${canaryReport}`,
    `- ${intakeReport}`,
    `- ${diagnosisReport} if strict intake failed`,
    "",
    "## Pass Criteria",
    "",
    ...packetAcceptanceLines(),
    "",
    "Do not attach raw memories, transcripts, prompts, answers, provider keys, cookies, private local paths, or unredacted diagnostic archives.",
  ].join("\n");
}

function packetAcceptanceLines() {
  return [
    "- `canaryPass: true`",
    "- `fixtureOnly: false`",
    "- `countsAsRealRolloutEvidence: true`",
    "- zero privacy leaks and zero secret-pattern hits",
    "- store latency samples present, with no missing store latency",
    "- recall p95 and store p95 at or below 2500 ms",
    "- lifecycle, hybrid search, local writes, hosted read-through, and rollback drill all covered",
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
