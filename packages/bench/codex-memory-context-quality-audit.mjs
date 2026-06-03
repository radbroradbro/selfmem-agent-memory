import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const live = Boolean(args.live);
const strict = Boolean(args.strict);
const outputPath = args.output ? resolve(String(args.output)) : null;
const bridgePath = resolve(String(args.bridge ?? `${homedir()}/.codex/selfmem-bridge/bridge.js`));

const scenarios = [
  {
    id: "canvas-source-of-truth",
    prompt: "Canvas course materials task: organize uploaded readings and syllabus. What is the source of truth and what should not be substituted?",
    expected: [
      /professor-uploaded Canvas files/i,
      /controlling source of truth/i,
      /do not substitute/i,
    ],
    forbidden: [
      ["recallweave-canary", /\bRecallWeave .*canary\b/i],
      ["provider-key-fragment", /\b(api key|keys work with|raw key|credential)\b/i],
      ["private-path", /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//i],
    ],
    maxContextItems: 2,
  },
  {
    id: "recallweave-live-context-quality",
    prompt: "RecallWeave selfmem live prompt-context quality memory system noisy agent drift release blocker retrieval policy.",
    expected: [
      /live prompt-context quality/i,
      /canaries is not enough|write\/read canaries/i,
      /release blocker/i,
    ],
    forbidden: [
      ["canvas-source-rule", /\bCanvas\/course-material|professor-uploaded Canvas files|reconstructed book extracts\b/i],
      ["canary-memory", /\bcobalt\b|\bMeridian\b|\bcodex-runtime-|codex-live-/i],
      ["provider-key-fragment", /\b(api key|keys work with|raw key|credential)\b/i],
      ["private-path", /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//i],
    ],
    maxContextItems: 3,
  },
  {
    id: "actor-default",
    prompt: "For RecallWeave answer-quality benchmark actor and judge work, should Codex CLI OAuth or DeepSeek direct be the default actor path?",
    expected: [
      /Codex CLI/i,
      /local OAuth/i,
      /DeepSeek .*fallback|fallback .*DeepSeek/i,
    ],
    forbidden: [
      ["canvas-source-rule", /\bCanvas\/course-material|professor-uploaded Canvas files|reconstructed book extracts\b/i],
      ["canary-memory", /\bcobalt\b|\bMeridian\b|\bcodex-runtime-|codex-live-/i],
      ["provider-key-fragment", /\b(api key|keys work with|raw key|credential)\b/i],
      ["private-path", /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//i],
    ],
    maxContextItems: 2,
  },
  {
    id: "unrelated-default-noise",
    prompt: "Draft a short neutral email confirming a meeting time. Do not use project memory.",
    expected: [],
    forbidden: [
      ["canvas-source-rule", /\bCanvas\/course-material|professor-uploaded Canvas files|reconstructed book extracts\b/i],
      ["recallweave-benchmark-rule", /\bRecallWeave|selfmem|benchmark|canary|BM25|provider arm|release blocker\b/i],
      ["provider-key-fragment", /\b(api key|keys work with|raw key|credential)\b/i],
      ["private-path", /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//i],
    ],
    maxContextItems: 0,
  },
];

const report = live ? runLiveAudit() : runFixtureAudit();
const serialized = `${JSON.stringify(report, null, 2)}\n`;
assertSafePublicText(serialized, "Codex memory context quality audit");
if (strict) {
  assert.equal(report.ok, true, serialized);
  assert.equal(report.metricsOnly, true, serialized);
  assert.equal(report.rawContextIncluded, false, serialized);
  assert.equal(report.privatePathIncluded, false, serialized);
  assert.equal(report.secretPatternHits, 0, serialized);
  assert.deepEqual(report.failedScenarios, [], serialized);
}
if (outputPath) writeOutput(outputPath, serialized);
process.stdout.write(serialized);

function runLiveAudit() {
  assert.ok(existsSync(bridgePath), "Codex selfmem bridge not found. Run without --live for fixture mode.");
  assert.ok(statSync(bridgePath).size > 0, "Codex selfmem bridge is empty.");
  const bridgeHash = `sha256:${sha256(readFileSync(bridgePath))}`;
  const scenarioReports = scenarios.map((scenario) => evaluateScenario(scenario, recallLiveContext(scenario.prompt)));
  return buildReport({
    fixtureOnly: false,
    writesRealFiles: false,
    bridgeHash,
    scenarioReports,
  });
}

function runFixtureAudit() {
  const contexts = {
    "canvas-source-of-truth": [
      "[SELFMEM BRIDGE CONTEXT]",
      "- Preference: For Canvas/course-material organization tasks, professor-uploaded Canvas files are the controlling source of truth. Download and organize the actual uploaded PDFs/files first; do not substitute reconstructed book extracts, HTML snapshots, URL files, syllabus-only page ranges, or older local PDFs unless explicitly labeled as fallback or supplemental. Keep provenance labels clear.",
    ].join("\n"),
    "recallweave-live-context-quality": [
      "[SELFMEM BRIDGE CONTEXT]",
      "- Decision: RecallWeave selfmem must treat live prompt-context quality as the main product gate. Passing write/read canaries is not enough; the injected context must improve Codex/Claude/OpenClaw agent behavior on real tasks. If memory recall is noisy, missing explicit write tooling, or causing agent drift, that is a release blocker.",
    ].join("\n"),
    "actor-default": [
      "[SELFMEM BRIDGE CONTEXT]",
      "- Decision: For answer-quality or benchmark actor/judge work, Codex CLI with local OAuth is the preferred default actor when usable. DeepSeek v4 Pro or Flash direct API and OpenRouter/NVIDIA models are fallback or auxiliary lanes when the Codex CLI route does not fit the autoresearch harness or API-shaped loop.",
    ].join("\n"),
    "unrelated-default-noise": "",
  };
  const scenarioReports = scenarios.map((scenario) => evaluateScenario(scenario, contexts[scenario.id] ?? ""));
  return buildReport({
    fixtureOnly: true,
    writesRealFiles: false,
    bridgeHash: "sha256:fixture",
    scenarioReports,
  });
}

function buildReport({ fixtureOnly, writesRealFiles, bridgeHash, scenarioReports }) {
  const failedScenarios = scenarioReports.filter((scenario) => !scenario.ok).map((scenario) => scenario.id);
  return {
    schemaVersion: 1,
    mode: "codex-memory-context-quality-audit",
    status: failedScenarios.length ? "BLOCKED_CONTEXT_QUALITY" : "READY_CONTEXT_QUALITY",
    ok: failedScenarios.length === 0,
    generatedAt: new Date().toISOString(),
    fixtureOnly,
    writesRealFiles,
    metricsOnly: true,
    rawContextIncluded: false,
    privatePathIncluded: false,
    secretPatternHits: 0,
    callsProviderApis: false,
    callsHostedSupermemory: false,
    countsAsBenchmarkEvidence: false,
    countsAsSupermemoryReplacementEvidence: false,
    contextQualityGate: true,
    bridge: {
      actor: "codex-selfmem-bridge",
      sourceHash: bridgeHash,
    },
    scenarios: scenarioReports,
    failedScenarios,
    blockers: failedScenarios.map((id) => `context-quality-failed:${id}`),
  };
}

function evaluateScenario(scenario, context) {
  const expectedMatches = scenario.expected.map((pattern) => pattern.test(context));
  const forbiddenHits = scenario.forbidden
    .filter(([, pattern]) => pattern.test(context))
    .map(([name]) => name);
  const itemCount = (context.match(/\n- /g) ?? []).length;
  const ok = expectedMatches.every(Boolean)
    && forbiddenHits.length === 0
    && itemCount <= Number(scenario.maxContextItems ?? 5);
  return {
    id: scenario.id,
    ok,
    contextHash: `sha256:${sha256(context)}`,
    contextLength: context.length,
    itemCount,
    expectedMatched: Object.fromEntries(scenario.expected.map((pattern, index) => [safePatternName(pattern), expectedMatches[index]])),
    forbiddenHits,
    maxContextItems: Number(scenario.maxContextItems ?? 5),
  };
}

function recallLiveContext(prompt) {
  const result = spawnSync("node", [bridgePath, "recall"], {
    input: `${JSON.stringify({ prompt })}\n`,
    encoding: "utf8",
    env: { ...process.env, SELFMEM_BRIDGE_FORCE_RECALL: "1", SELFMEM_BRIDGE_AUDIT_RECALL: "1" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, "Codex selfmem bridge recall failed");
  const parsed = JSON.parse(result.stdout);
  return String(parsed?.hookSpecificOutput?.additionalContext ?? "");
}

function safePatternName(pattern) {
  return String(pattern)
    .replace(/^\/|\/[a-z]*$/gi, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item.startsWith("--")) {
      const key = toCamel(item.slice(2));
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

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(text, secretPattern(), `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\/, `${label} contains a private path`);
}

function secretPattern() {
  return /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
}
