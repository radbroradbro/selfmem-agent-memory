import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const host = String(args.host || "hermes").trim().toLowerCase();
const format = String(args.format || "json").trim().toLowerCase();
const outputPath = args.output ?? process.env.RECALLWEAVE_CANARY_DRILL_OUTPUT ?? null;

assert.ok(["hermes", "openclaw"].includes(host), "--host must be hermes or openclaw");
assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");

const runtime = host === "hermes" ? "Hermes" : "OpenClaw";
const repoPlaceholder = host === "hermes" ? "<hermes-checkout>" : "<openclaw-checkout>";
const freshWindowStart = "$FRESH_WINDOW_START";
const canaryReport = "/tmp/recallweave-canary-report.json";
const intakeReport = "/tmp/recallweave-canary-intake.json";
const diagnosisReport = "/tmp/recallweave-canary-diagnosis.json";
const evidencePacket = "/tmp/recallweave-canary-evidence-packet.zip";

const drill = {
  ok: true,
  mode: "strict-real-canary-drill",
  schemaVersion: 1,
  writesRealFiles: false,
  metricsOnly: true,
  publicSafe: true,
  publicLaunchAllowed: false,
  fleetRolloutAllowed: false,
  host,
  runtime,
  purpose: "Force a real patched agent window to exercise local write, recall, hosted read-through, lifecycle, LCM/compression, rollback, and metrics-only packaging.",
  minimumFreshWindowMinutes: 15,
  freshWindowStart,
  drillContract: {
    oneAgentOnly: true,
    requiresPatchedAdapter: true,
    requiresNativeMemorySlot: true,
    requiresLocalWrite: true,
    requiresHostedReadThrough: true,
    requiresLifecycleCoverage: true,
    requiresLcmOrCompressionCoverage: true,
    requiresRollbackDrill: true,
    requiresMetricsOnlyReturn: true,
  },
  setupCommands: [
    {
      id: "dry-run-update",
      command: `bin/selfmem_update --host ${host} --repo ${repoPlaceholder}`,
    },
    {
      id: "apply-and-mark-window",
      command: `FRESH_WINDOW_START=$(date -u +"%Y-%m-%dT%H:%M:%SZ") && bin/selfmem_update --host ${host} --repo ${repoPlaceholder} --apply && printf "fresh canary window starts at %s\\n" "$FRESH_WINDOW_START"`,
    },
  ],
  operatorSteps: [
    {
      id: "verify-native-memory",
      channel: "operator",
      expectedTrace: ["session_start"],
      instruction: "Confirm the runtime is using RecallWeave/selfmem as the native memory provider for this one agent and that hosted Supermemory is read-through only.",
    },
    {
      id: "store-public-canary-fact",
      channel: "agent-prompt",
      expectedTrace: ["before_prompt_build", "search", "store", "agent_end"],
      prompt: "RecallWeave canary drill. Store this public test memory only: the canary color is cobalt, the workflow name is Meridian, and the evidence window is a RecallWeave strict-real canary. Do not store private or personal data.",
    },
    {
      id: "recall-local-canary-fact",
      channel: "agent-prompt",
      expectedTrace: ["before_prompt_build", "search"],
      prompt: "Use native memory recall. What is the RecallWeave canary color and workflow name from the public test memory? Answer briefly and do not include raw logs.",
    },
    {
      id: "exercise-hosted-read-through",
      channel: "agent-prompt",
      expectedTrace: ["search"],
      prompt: "Run an explicit memory search for prior hosted Supermemory context about RecallWeave, selfmem, Supermemory migration, or memory-system rollout status. Report only whether hosted read-through returned results and the result count. Do not quote private memory text.",
    },
    {
      id: "exercise-lifecycle-compression",
      channel: "agent-prompt",
      expectedTrace: ["pre_compress", "compression_checkpoint", "lcm_after_compression_prompt_build", "before_prompt_build"],
      prompt: "Trigger or simulate the normal lifecycle compression/pre-compress path for this runtime if available, then confirm that RecallWeave context still appears after the next prompt build. If the runtime has no manual compression command, run enough normal turn activity to create a compression/lifecycle checkpoint and say so.",
    },
    {
      id: "store-distilled-summary",
      channel: "agent-prompt",
      expectedTrace: ["store", "agent_end"],
      prompt: "Store a short public canary summary: RecallWeave strict-real drill exercised local write, local recall, hosted read-through check, lifecycle coverage, and rollback packaging. Do not store raw prompt text or private data.",
    },
    {
      id: "rollback-drill",
      channel: "terminal",
      expectedTrace: ["rollback"],
      command: `bin/selfmem_update --host ${host} --repo ${repoPlaceholder} --rollback --dry-run`,
    },
    {
      id: "collect-strict-real-evidence",
      channel: "terminal",
      expectedTrace: ["report", "intake", "packet"],
      command: `bin/selfmem_update --host ${host} --repo ${repoPlaceholder} --run-canary --rollback-tested --strict-real --canary-since "${freshWindowStart}" --canary-output ${canaryReport} --canary-intake-output ${intakeReport} --canary-diagnosis-output ${diagnosisReport} --canary-packet-output ${evidencePacket}`,
    },
  ],
  acceptanceCriteria: [
    "fresh window is at least 15 minutes after adapter apply",
    "native memory provider is RecallWeave/selfmem for this one agent",
    "local write creates at least one store event with elapsed_ms",
    "before_prompt_build or prefetch injects non-empty context",
    "local recall returns the public canary fact",
    "hosted read-through is attempted and traced; if it returns zero results, the packet stays diagnostic",
    "LCM/pre-compress or lifecycle checkpoint is observed",
    "rollback dry-run is available and rollback-tested is true",
    "strict-real intake passes before any production-canary claim",
    "returned evidence is metrics-only and contains no raw memories, prompts, transcripts, answers, keys, cookies, or private paths",
  ],
  expectedStrictIntakeFields: {
    "counts.sessionStart": "> 0",
    "counts.beforePromptBuild": "> 0",
    "counts.preCompress": "> 0",
    "counts.agentEnd": "> 0",
    "counts.search": "> 0",
    "counts.store": "> 0",
    "instrumentation.searchLatencySampleCount": "> 0",
    "instrumentation.storeLatencySampleCount": "> 0",
    "quality.beforePromptHasContextRate": ">= 0.5",
    "quality.zeroResultRate": "<= 0.25",
    "quality.writeSuccessRate": ">= 0.95",
    "quality.lifecycleCovered": true,
    "quality.hybridSearchCovered": true,
    "quality.localWritesObserved": true,
    "quality.hostedReadThroughObserved": true,
    "rollback.tested": true,
  },
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
};

drill.operatorMessage = buildMarkdown(drill);

const serialized = format === "markdown"
  ? `${drill.operatorMessage}\n`
  : `${JSON.stringify(drill, null, 2)}\n`;
assertSafe(serialized);
if (outputPath) writeFileSync(resolvePath(outputPath), serialized, { encoding: "utf8", mode: 0o600 });
process.stdout.write(serialized);

function buildMarkdown(plan) {
  const lines = [
    `# RecallWeave Strict-Real Canary Drill (${plan.runtime})`,
    "",
    "Use this only on one patched agent. It is designed to create real lifecycle evidence without storing private data.",
    "",
    "## Setup",
    "",
  ];

  for (const item of plan.setupCommands) {
    lines.push(`### ${item.id}`, "", "```bash", item.command, "```", "");
  }

  lines.push("## Fresh-Window Drill", "");
  for (const item of plan.operatorSteps) {
    lines.push(`### ${item.id}`, "");
    if (item.instruction) lines.push(item.instruction, "");
    if (item.prompt) lines.push("Send this prompt to the agent:", "", "```text", item.prompt, "```", "");
    if (item.command) lines.push("Run:", "", "```bash", item.command, "```", "");
    lines.push(`Expected trace: ${item.expectedTrace.map((value) => `\`${value}\``).join(", ")}`, "");
  }

  lines.push("## Pass Criteria", "");
  for (const item of plan.acceptanceCriteria) lines.push(`- ${item}`);
  lines.push("", "## Attach Only", "");
  for (const item of plan.attachOnly) lines.push(`- ${item}`);
  lines.push("", "Do not attach raw memories, transcripts, prompts, answers, provider keys, cookies, private local paths, or unredacted diagnostics.");
  return lines.join("\n");
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

function resolvePath(value) {
  const text = String(value || "").trim();
  assert.ok(text, "path is required");
  assert.doesNotMatch(text, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\/);
  return resolve(text);
}

function assertSafe(text) {
  assert.doesNotMatch(text, secretPattern(), "canary drill contains a key-shaped secret");
  assert.doesNotMatch(text, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\/, "canary drill contains a raw private path");
}

function secretPattern() {
  return /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
}
