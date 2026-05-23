import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const format = String(args.format || "json").trim().toLowerCase();
const outputPath = args.output ?? process.env.RECALLWEAVE_CANARY_NEXT_AGENT_OUTPUT_JSON ?? null;
assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;

const batch = loadBatch(args);
const selected = selectCandidate(batch, args.candidateLabel);
const host = normalizeHost(args.host || selected?.target?.host);
const failedChecks = selected?.failedChecks ?? [];
const privacyClean = selected ? isPrivacyClean(selected) : false;
const alreadyPassed = Boolean(selected?.countsAsRealRolloutEvidence);
const needsFreshWindow = selected ? Boolean(selected.fixtureOnly || selected.remediation?.needsFreshWindow || failedChecks.length > 0) : true;
const canPlanOneAgent = Boolean(selected && privacyClean && host !== "unknown" && !alreadyPassed);
const blockReasons = blockReasonsFor(selected, host, privacyClean, alreadyPassed);
const commandPlan = canPlanOneAgent ? commandsFor(host) : [];

const output = {
  ok: Boolean(selected),
  mode: "canary-next-agent-plan",
  writesRealFiles: false,
  metricsOnly: true,
  publicLaunchAllowed: false,
  fleetRolloutAllowed: false,
  oneAgentCanaryAllowed: canPlanOneAgent && !selected?.fixtureOnly,
  operatorPacketAvailable: canPlanOneAgent,
  alreadyPassedStrictReal: alreadyPassed,
  selectedCandidate: selected ? summarizeSelected(selected) : null,
  batch: {
    sha256: sha256(JSON.stringify(batch)),
    inputCount: numberValue(batch.inputCount),
    parsedInputCount: numberValue(batch.parsedInputCount),
    failedInputCount: numberValue(batch.failedInputCount),
    strictRealPassCount: numberValue(batch.strictRealPassCount),
    countsAsRealRolloutEvidence: Boolean(batch.countsAsRealRolloutEvidence),
  },
  decision: {
    host,
    status: statusFor(selected, host, privacyClean, alreadyPassed),
    blockReasons,
    needsFreshWindow,
    requiredFreshWindowMinutes: 15,
    recommendedScope: alreadyPassed
      ? "maintainer-review-only"
      : canPlanOneAgent
        ? "one-agent-fresh-canary"
        : "blocked-before-agent-update",
  },
  remediationFocus: remediationFocus(failedChecks),
  commandPlan,
  acceptanceCriteria: acceptanceCriteria(),
  attachOnly: [
    "/tmp/recallweave-canary-report.json",
    "/tmp/recallweave-canary-intake.json",
    "/tmp/recallweave-canary-diagnosis.json if strict intake fails",
    "/tmp/recallweave-canary-evidence-packet.zip",
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

output.operatorMessage = buildMarkdown(output);

const serialized = format === "markdown"
  ? `${output.operatorMessage}\n`
  : `${JSON.stringify(output, null, 2)}\n`;
assertSafeText(serialized, "next-agent plan output");
if (outputPath) writeFileSync(resolvePath(outputPath), serialized, { encoding: "utf8", mode: 0o600 });
process.stdout.write(serialized);
if (!selected || blockReasons.some((item) => item.severity === "hard-block")) process.exitCode = 1;

function loadBatch(parsed) {
  if (parsed.batch) {
    const batchPath = resolvePath(parsed.batch);
    assert.ok(existsSync(batchPath), "batch report missing");
    const raw = readFileSync(batchPath, "utf8");
    assertSafeText(raw, "batch report");
    return JSON.parse(raw);
  }

  const batchArgs = ["packages/bench/canary-diagnostic-batch-audit.mjs"];
  if (parsed.inputRoot) batchArgs.push("--input-root", parsed.inputRoot);
  if (parsed.diagnosticRoot) batchArgs.push("--diagnostic-root", parsed.diagnosticRoot);
  for (const input of asArray(parsed.input)) batchArgs.push("--input", input);
  const run = spawnSync("node", batchArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.ok(run.stdout, "batch audit produced no output");
  assertSafeText(run.stdout, "batch audit stdout");
  return JSON.parse(run.stdout);
}

function selectCandidate(batch, requestedLabel) {
  const results = Array.isArray(batch.results) ? batch.results : [];
  if (requestedLabel) return results.find((item) => item.label === requestedLabel) ?? null;
  if (batch.bestCandidate) return batch.bestCandidate;
  return results[0] ?? null;
}

function summarizeSelected(candidate) {
  return {
    label: candidate.label,
    inputKind: candidate.inputKind,
    fixtureOnly: Boolean(candidate.fixtureOnly),
    canaryPass: Boolean(candidate.canaryPass),
    countsAsRealRolloutEvidence: Boolean(candidate.countsAsRealRolloutEvidence),
    strictRealPassed: Boolean(candidate.strictRealPassed),
    failedChecks: candidate.failedChecks ?? [],
    failedCheckCount: numberValue(candidate.failedCheckCount),
    target: {
      host: candidate.target?.host ?? null,
      agentIdentityHash: candidate.target?.agentIdentityHash ?? null,
      localContainerHash: candidate.target?.localContainerHash ?? null,
      sourceContainerHash: candidate.target?.sourceContainerHash ?? null,
      providerMode: candidate.target?.providerMode ?? null,
      hostedSupermemoryMode: candidate.target?.hostedSupermemoryMode ?? null,
    },
    lifecycle: candidate.lifecycle ?? {},
    latencyMs: {
      recallP95: numberValue(candidate.latencyMs?.recallP95),
      storeP95: numberValue(candidate.latencyMs?.storeP95),
    },
    instrumentation: {
      searchLatencySampleCount: numberValue(candidate.instrumentation?.searchLatencySampleCount),
      storeLatencySampleCount: numberValue(candidate.instrumentation?.storeLatencySampleCount),
      missingStoreLatencyCount: numberValue(candidate.instrumentation?.missingStoreLatencyCount),
    },
    quality: {
      lifecycleCovered: Boolean(candidate.quality?.lifecycleCovered),
      hybridSearchCovered: Boolean(candidate.quality?.hybridSearchCovered),
      localWritesObserved: Boolean(candidate.quality?.localWritesObserved),
      hostedReadThroughObserved: Boolean(candidate.quality?.hostedReadThroughObserved),
      beforePromptHasContextRate: numberValue(candidate.quality?.beforePromptHasContextRate),
      zeroResultRate: numberValue(candidate.quality?.zeroResultRate),
      writeSuccessRate: numberValue(candidate.quality?.writeSuccessRate),
    },
    privacy: {
      privacyLeakCount: numberValue(candidate.privacy?.privacyLeakCount),
      secretPatternHits: numberValue(candidate.privacy?.secretPatternHits),
      rawMemoryIncluded: Boolean(candidate.privacy?.rawMemoryIncluded),
      rawTranscriptIncluded: Boolean(candidate.privacy?.rawTranscriptIncluded),
      rawPromptIncluded: Boolean(candidate.privacy?.rawPromptIncluded),
      rawAnswerIncluded: Boolean(candidate.privacy?.rawAnswerIncluded),
    },
  };
}

function normalizeHost(value) {
  const host = String(value ?? "").trim().toLowerCase();
  return ["hermes", "openclaw"].includes(host) ? host : "unknown";
}

function isPrivacyClean(candidate) {
  const privacy = candidate.privacy ?? {};
  return numberValue(privacy.privacyLeakCount) === 0
    && numberValue(privacy.secretPatternHits) === 0
    && privacy.rawMemoryIncluded === false
    && privacy.rawTranscriptIncluded === false
    && privacy.rawPromptIncluded === false
    && privacy.rawAnswerIncluded === false;
}

function blockReasonsFor(candidate, host, privacyClean, alreadyPassed) {
  if (!candidate) return [{ severity: "hard-block", reason: "No parsed candidate exists in the batch audit." }];
  const reasons = [];
  if (host === "unknown") reasons.push({ severity: "hard-block", reason: "Candidate host is unknown; rerun with --host hermes or --host openclaw after confirming the runtime." });
  if (!privacyClean) reasons.push({ severity: "hard-block", reason: "Candidate privacy counters are not clean. Do not send an update packet until the diagnostic is sanitized." });
  if (alreadyPassed) reasons.push({ severity: "review-only", reason: "A strict-real pass already exists. Attach the metrics-only packet for maintainer review instead of updating another agent." });
  if (candidate.fixtureOnly) reasons.push({ severity: "soft-block", reason: "Candidate is fixture-only. It can test the planner but cannot justify a live rollout." });
  return reasons;
}

function statusFor(candidate, host, privacyClean, alreadyPassed) {
  if (!candidate) return "NO_CANDIDATE";
  if (alreadyPassed) return "STRICT_REAL_READY_FOR_REVIEW";
  if (host === "unknown" || !privacyClean) return "BLOCKED";
  if (candidate.fixtureOnly) return "FIXTURE_PLAN_ONLY";
  return "READY_FOR_ONE_AGENT_FRESH_CANARY";
}

function remediationFocus(failedChecks) {
  const checks = new Set(failedChecks);
  const focus = [];
  if (checks.has("adapter-contract")) {
    focus.push({
      category: "installed-version",
      action: "Install the current adapter with `bin/selfmem_update --apply` before collecting evidence.",
    });
  }
  if (checks.has("store-latency-instrumented") || checks.has("store-p95")) {
    focus.push({
      category: "store-instrumentation",
      action: "Collect a fresh post-update window with store `elapsed_ms` samples; old bundles with zero store samples cannot pass.",
    });
  }
  if (checks.has("recall-p95")) {
    focus.push({
      category: "recall-latency",
      action: "Reduce synchronous recall/read-through work or collect a cleaner active window before promotion.",
    });
  }
  if (checks.has("lcm-hook-observed")) {
    focus.push({
      category: "lifecycle",
      action: "Trigger one compression/pre-compress cycle so lifecycle memory coverage is proven.",
    });
  }
  if (checks.has("hybrid-search-covered")) {
    focus.push({
      category: "hybrid-search",
      action: "Verify local recall and hosted read-through both contribute, or remove the hybrid claim.",
    });
  }
  if (!focus.length && failedChecks.length) {
    focus.push({ category: "strict-intake", action: "Run `canary:diagnose` and handle each failed check before promotion." });
  }
  if (!focus.length) {
    focus.push({ category: "review", action: "No failed checks found. Package metrics-only evidence for maintainer review." });
  }
  return focus;
}

function commandsFor(host) {
  const repoPlaceholder = host === "hermes" ? "<hermes-checkout>" : "<openclaw-checkout>";
  const diagnosticFlag = "--canary-diagnostic-zip <redacted-diagnostic.zip>";
  return [
    {
      id: "dry-run",
      description: "Show exactly what will change without copying files.",
      command: `bin/selfmem_update --host ${host} --repo ${repoPlaceholder}`,
    },
    {
      id: "apply-current-adapter",
      description: "Apply the current adapter and record the fresh evidence window timestamp.",
      command: [
        `FRESH_WINDOW_START=$(date -u +"%Y-%m-%dT%H:%M:%SZ")`,
        `bin/selfmem_update --host ${host} --repo ${repoPlaceholder} --apply`,
        `printf "fresh canary window starts at %s\\n" "$FRESH_WINDOW_START"`,
      ].join(" && "),
    },
    {
      id: "collect-live-window",
      description: "After at least 15 minutes of real use, collect strict-real metrics from the mapped live container.",
      command: [
        `bin/selfmem_update --host ${host} --repo ${repoPlaceholder} --run-canary --rollback-tested --strict-real --canary-since "$FRESH_WINDOW_START" --canary-output /tmp/recallweave-canary-report.json`,
        `npm exec --yes pnpm@10.23.0 -- canary:intake -- --report /tmp/recallweave-canary-report.json --strict-real --output /tmp/recallweave-canary-intake.json`,
      ].join(" && "),
    },
    {
      id: "collect-from-redacted-export",
      description: "Use only if the agent cannot collect from its live container but can provide a redacted diagnostic export.",
      command: [
        `bin/selfmem_update --host ${host} --repo ${repoPlaceholder} --run-canary --rollback-tested --strict-real --canary-since "$FRESH_WINDOW_START" ${diagnosticFlag} --canary-output /tmp/recallweave-canary-report.json`,
        `npm exec --yes pnpm@10.23.0 -- canary:intake -- --report /tmp/recallweave-canary-report.json --strict-real --output /tmp/recallweave-canary-intake.json`,
      ].join(" && "),
    },
    {
      id: "diagnose-if-failed",
      description: "If strict intake fails, generate metrics-only remediation.",
      command: "npm exec --yes pnpm@10.23.0 -- canary:diagnose -- --report /tmp/recallweave-canary-report.json --output /tmp/recallweave-canary-diagnosis.json",
    },
    {
      id: "package-passing-evidence",
      description: "Package a passing strict-real canary. This remains one-agent evidence only.",
      command: "npm exec --yes pnpm@10.23.0 -- canary:packet -- --report /tmp/recallweave-canary-report.json --intake /tmp/recallweave-canary-intake.json --strict-real --output /tmp/recallweave-canary-evidence-packet.zip",
    },
    {
      id: "package-failing-diagnostic",
      description: "Package diagnosis when strict intake fails. This does not count as rollout evidence.",
      command: "npm exec --yes pnpm@10.23.0 -- canary:packet -- --report /tmp/recallweave-canary-report.json --intake /tmp/recallweave-canary-intake.json --diagnosis /tmp/recallweave-canary-diagnosis.json --output /tmp/recallweave-canary-evidence-packet.zip",
    },
  ];
}

function acceptanceCriteria() {
  return [
    "one agent only until a maintainer reviews the evidence",
    "fresh post-update window is at least 15 minutes",
    "strict-real intake passes from non-fixture evidence",
    "adapter strict canary contract is v1",
    "search and store latency instrumentation are present",
    "store latency sample count is greater than zero",
    "recall p95 and store p95 are each at or below 2500 ms",
    "lifecycle, hybrid search, local writes, hosted read-through, and rollback are covered",
    "privacy leak count and secret-pattern hits are zero",
  ];
}

function buildMarkdown(plan) {
  const candidate = plan.selectedCandidate;
  const lines = [
    "# RecallWeave Next Agent Canary Plan",
    "",
    `Status: ${plan.decision.status}`,
    `Scope: ${plan.decision.recommendedScope}`,
    `Host: ${plan.decision.host}`,
    "",
  ];

  if (candidate) {
    lines.push(
      "## Selected Candidate",
      "",
      `- Label: \`${candidate.label}\``,
      `- Failed checks: ${candidate.failedChecks.length ? candidate.failedChecks.map((item) => `\`${item}\``).join(", ") : "none"}`,
      `- Recall p95: ${candidate.latencyMs.recallP95} ms`,
      `- Store p95: ${candidate.latencyMs.storeP95} ms`,
      `- Store latency samples: ${candidate.instrumentation.storeLatencySampleCount}`,
      `- Privacy leak count: ${candidate.privacy.privacyLeakCount}`,
      "",
    );
  }

  if (plan.decision.blockReasons.length) {
    lines.push("## Blocks", "");
    for (const reason of plan.decision.blockReasons) lines.push(`- ${reason.severity}: ${reason.reason}`);
    lines.push("");
  }

  lines.push("## Focus", "");
  for (const item of plan.remediationFocus) lines.push(`- ${item.category}: ${item.action}`);
  lines.push("");

  if (plan.commandPlan.length) {
    lines.push("## Commands", "");
    for (const item of plan.commandPlan) {
      lines.push(`### ${item.id}`, "", item.description, "", "```bash", item.command, "```", "");
    }
  }

  lines.push("## Pass Criteria", "");
  for (const item of plan.acceptanceCriteria) lines.push(`- ${item}`);
  lines.push("", "Attach only metrics-only report, intake, diagnosis if needed, and packet zip. Do not attach raw logs, memories, prompts, answers, keys, cookies, private local paths, or unredacted diagnostics.");
  return lines.join("\n");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item.startsWith("--")) {
      const key = toCamel(item.slice(2));
      const value = argv[index + 1] ?? "";
      if (key === "input") parsed.input = [...asArray(parsed.input), value];
      else parsed[key] = value;
      index += 1;
    }
  }
  return parsed;
}

function resolvePath(value) {
  return isAbsolute(value) ? value : resolve(process.cwd(), value);
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertSafeText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a raw local path`);
}
