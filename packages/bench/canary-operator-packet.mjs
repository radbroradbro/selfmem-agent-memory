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
const evidencePacket = "/tmp/recallweave-canary-evidence-packet.zip";
const drillGuide = "/tmp/recallweave-canary-drill.md";
const freshWindowStart = "<fresh-window-start-iso>";

const packet = {
  ok: true,
  mode: "strict-real-canary-operator-packet",
  writesRealFiles: false,
  publicSafe: true,
  host,
  runtime: runtimeLabel,
  purpose: "Collect one fresh patched real-agent canary without exposing raw memory data.",
  requiredSource: "live mapped container or explicit redacted diagnostic directory/zip",
  freshWindow: {
    minimumMinutes: 15,
    startPlaceholder: freshWindowStart,
    reason: "Only post-update events count. Older trace history can contain pre-patch missing latency samples or stale errors.",
  },
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
      id: "apply-live-container",
      description: "Apply the adapter and record the fresh canary window start timestamp.",
      command: `FRESH_WINDOW_START=$(date -u +"%Y-%m-%dT%H:%M:%SZ") && bin/selfmem_update --host ${host} --repo ${repoPlaceholder} --apply && printf "fresh canary window starts at %s\\n" "$FRESH_WINDOW_START"`,
    },
    {
      id: "generate-drill",
      description: "Generate the deterministic public-safe drill prompts that exercise local write, recall, hosted read-through, lifecycle, LCM/compression, and rollback coverage.",
      command: `npm exec --yes pnpm@10.23.0 -- canary:drill -- --host ${host} --format markdown --output ${drillGuide}`,
    },
    {
      id: "collect-live-container-after-window",
      description: "After at least 15 minutes of real traffic on the patched agent, collect strict-real evidence from the fresh window.",
      command: [
        `bin/selfmem_update --host ${host} --repo ${repoPlaceholder} --run-canary --rollback-tested --strict-real --canary-since ${freshWindowStart} --canary-output ${canaryReport}`,
        `npm exec --yes pnpm@10.23.0 -- canary:intake -- --report ${canaryReport} --strict-real --output ${intakeReport}`,
      ].join(" && "),
    },
    {
      id: "apply-and-collect-live-container",
      description: "Shortcut only when the agent has already run for at least 15 minutes after the patch. Use a real timestamp, not the placeholder.",
      command: [
        `bin/selfmem_update --host ${host} --repo ${repoPlaceholder} --apply --run-canary --rollback-tested --strict-real --canary-since ${freshWindowStart} --canary-output ${canaryReport}`,
        `npm exec --yes pnpm@10.23.0 -- canary:intake -- --report ${canaryReport} --strict-real --output ${intakeReport}`,
      ].join(" && "),
    },
    {
      id: "collect-from-redacted-diagnostic-dir",
      description: "Use this instead when the agent exports a redacted diagnostic directory that includes old trace history.",
      command: [
        `bin/selfmem_update --host ${host} --repo ${repoPlaceholder} --run-canary --rollback-tested --strict-real --canary-since ${freshWindowStart} --canary-diagnostic-dir <redacted-diagnostic-dir> --canary-output ${canaryReport}`,
        `npm exec --yes pnpm@10.23.0 -- canary:intake -- --report ${canaryReport} --strict-real --output ${intakeReport}`,
      ].join(" && "),
    },
    {
      id: "collect-from-redacted-diagnostic-zip",
      description: "Use this instead when the agent exports a redacted diagnostic zip that includes old trace history.",
      command: [
        `bin/selfmem_update --host ${host} --repo ${repoPlaceholder} --run-canary --rollback-tested --strict-real --canary-since ${freshWindowStart} --canary-diagnostic-zip <redacted-diagnostic.zip> --canary-output ${canaryReport}`,
        `npm exec --yes pnpm@10.23.0 -- canary:intake -- --report ${canaryReport} --strict-real --output ${intakeReport}`,
      ].join(" && "),
    },
    {
      id: "diagnose-on-failure",
      description: "Run only if strict intake fails. Attach this metrics-only output, not raw logs.",
      command: `npm exec --yes pnpm@10.23.0 -- canary:diagnose -- --report ${canaryReport} --output ${diagnosisReport}`,
    },
    {
      id: "package-passing-evidence",
      description: "Create one sanitized evidence zip from a passing strict-real canary. This never includes raw logs or memories.",
      command: `npm exec --yes pnpm@10.23.0 -- canary:packet -- --report ${canaryReport} --intake ${intakeReport} --strict-real --output ${evidencePacket}`,
    },
    {
      id: "package-diagnostic-evidence",
      description: "Create one sanitized diagnostic zip when strict intake fails. This does not count as rollout evidence.",
      command: `npm exec --yes pnpm@10.23.0 -- canary:packet -- --report ${canaryReport} --intake ${intakeReport} --diagnosis ${diagnosisReport} --output ${evidencePacket}`,
    },
  ],
  acceptanceCriteria: [
    "canaryPass is true",
    "fixtureOnly is false",
    "countsAsRealRolloutEvidence is true",
    "evidenceSource.windowFilter.since is the timestamp recorded when the patched adapter was applied",
    "adapter.strictCanaryContract is v1",
    "adapter.searchLatencyInstrumentation and adapter.storeLatencyInstrumentation are true",
    "window.durationMinutes is at least 15",
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
    evidencePacket,
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
    "Then apply the adapter and write down the fresh-window timestamp:",
    "",
    "```bash",
    `FRESH_WINDOW_START=$(date -u +"%Y-%m-%dT%H:%M:%SZ")`,
    `bin/selfmem_update --host ${host} --repo ${repoPlaceholder} --apply`,
    `printf "fresh canary window starts at %s\\n" "$FRESH_WINDOW_START"`,
    "```",
    "",
    "Run the patched agent normally for at least 15 minutes. The canary needs real prompt-build, search, store, and rollback evidence from after that timestamp.",
    "",
    "For a deterministic exercise plan, generate and follow the drill:",
    "",
    "```bash",
    `npm exec --yes pnpm@10.23.0 -- canary:drill -- --host ${host} --format markdown --output ${drillGuide}`,
    "```",
    "",
    "Then collect from the fresh live window:",
    "",
    "```bash",
    `bin/selfmem_update --host ${host} --repo ${repoPlaceholder} --run-canary --rollback-tested --strict-real --canary-since "$FRESH_WINDOW_START" --canary-output ${canaryReport}`,
    `npm exec --yes pnpm@10.23.0 -- canary:intake -- --report ${canaryReport} --strict-real --output ${intakeReport}`,
    "```",
    "",
    "If you only have a redacted diagnostic export, use one of these instead:",
    "",
    "```bash",
    `bin/selfmem_update --host ${host} --repo ${repoPlaceholder} --run-canary --rollback-tested --strict-real --canary-since "$FRESH_WINDOW_START" --canary-diagnostic-dir <redacted-diagnostic-dir> --canary-output ${canaryReport}`,
    `bin/selfmem_update --host ${host} --repo ${repoPlaceholder} --run-canary --rollback-tested --strict-real --canary-since "$FRESH_WINDOW_START" --canary-diagnostic-zip <redacted-diagnostic.zip> --canary-output ${canaryReport}`,
    "```",
    "",
    "If strict intake fails, diagnose the metrics only:",
    "",
    "```bash",
    `npm exec --yes pnpm@10.23.0 -- canary:diagnose -- --report ${canaryReport} --output ${diagnosisReport}`,
    "```",
    "",
    "Package a passing strict-real canary into one sanitized zip:",
    "",
    "```bash",
    `npm exec --yes pnpm@10.23.0 -- canary:packet -- --report ${canaryReport} --intake ${intakeReport} --strict-real --output ${evidencePacket}`,
    "```",
    "",
    "If strict intake failed, package the diagnostic metrics instead:",
    "",
    "```bash",
    `npm exec --yes pnpm@10.23.0 -- canary:packet -- --report ${canaryReport} --intake ${intakeReport} --diagnosis ${diagnosisReport} --output ${evidencePacket}`,
    "```",
    "",
    "## Attach Only",
    "",
    `- ${canaryReport}`,
    `- ${intakeReport}`,
    `- ${diagnosisReport} if strict intake failed`,
    `- ${evidencePacket}`,
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
    "- `evidenceSource.windowFilter.since` matches the post-update timestamp",
    "- `adapter.strictCanaryContract: v1` and search/store latency instrumentation markers are present",
    "- fresh window duration is at least 15 minutes",
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
