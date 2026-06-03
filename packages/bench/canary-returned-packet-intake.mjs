import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const packetInput = args.packet || process.env.RECALLWEAVE_RETURNED_CANARY_PACKET_ZIP || "";
const requireProductionCanary = Boolean(args.requireProductionCanary);
const reviewStrictReal = Boolean(args.strictReal || requireProductionCanary || packetInput);
const outputPath = args.output ? resolvePath(args.output) : null;
const expectedCommit = normalizedCommit(args.expectedCommit || process.env.RECALLWEAVE_CANARY_EXPECTED_COMMIT || "");

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;

if (packetInput) {
  const resolvedPacket = resolvePath(packetInput);
  assert.ok(existsSync(resolvedPacket), "returned canary packet is missing");
}

const reviewArgs = [];
if (packetInput) reviewArgs.push("--packet", resolvePath(packetInput));
if (reviewStrictReal) reviewArgs.push("--strict-real");
if (expectedCommit) reviewArgs.push("--expected-commit", expectedCommit);

const reviewRun = spawnSync("node", ["packages/bench/canary-evidence-packet-review.mjs", ...reviewArgs], {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

let review = null;
let parseError = null;
try {
  assertSafeText(reviewRun.stdout, "packet review stdout");
  if (reviewRun.stdout.trim()) review = JSON.parse(reviewRun.stdout);
} catch (error) {
  parseError = error instanceof Error ? error.message : String(error);
}

const countsAsProductionCanaryEvidence = Boolean(review?.countsAsProductionCanaryEvidence);
const status = countsAsProductionCanaryEvidence
  ? "READY_FOR_MAINTAINER_PROMOTION"
  : review
    ? "NOT_PRODUCTION_EVIDENCE"
    : "UNREADABLE_PACKET";

const output = {
  ok: status !== "UNREADABLE_PACKET" && (!requireProductionCanary || countsAsProductionCanaryEvidence),
  mode: "canary-returned-packet-intake",
  writesRealFiles: Boolean(outputPath),
  metricsOnly: true,
  reviewStrictReal,
  requireProductionCanary,
  status,
  countsAsProductionCanaryEvidence,
  sourceControl: review?.sourceControl ?? {
    reportCommit: null,
    expectedCommit: expectedCommit || null,
    commitMatchesExpected: expectedCommit ? false : null,
  },
  publicLaunchAllowed: false,
  fleetRolloutAllowed: false,
  packet: {
    pathLabel: packetInput ? basename(packetInput) : review?.packet?.pathLabel ?? "generated-fixture-canary-evidence-packet.zip",
    sha256: packetInput ? sha256(readFileSync(resolvePath(packetInput))) : review?.packet?.sha256 ?? null,
    entries: review?.packet?.entries ?? [],
  },
  review: review
    ? {
        ok: Boolean(review.ok),
        strictReal: Boolean(review.strictReal),
        strictRealPassed: Boolean(review.strictRealPassed),
        fixtureOnly: Boolean(review.fixtureOnly),
        canaryPass: Boolean(review.canaryPass),
        countsAsRealRolloutEvidence: Boolean(review.countsAsRealRolloutEvidence),
        packagePassesStrictReal: Boolean(review.packagePassesStrictReal),
        failedChecks: review.failedChecks ?? [],
        strictFailureReason: review.strictFailureReason ?? null,
        sourceControl: review.sourceControl ?? null,
      }
    : {
        ok: false,
        strictReal: reviewStrictReal,
        strictRealPassed: false,
        fixtureOnly: null,
        canaryPass: false,
        countsAsRealRolloutEvidence: false,
        packagePassesStrictReal: false,
        failedChecks: ["unreadable-packet"],
        strictFailureReason: parseError ?? "packet review did not produce parseable JSON",
      },
  nextActions: countsAsProductionCanaryEvidence
    ? [
        "Attach this metrics-only intake output and the packet to maintainer review.",
        "Keep public launch and fleet rollout blocked until the maintainer explicitly promotes the one-agent canary.",
      ]
    : [
        "Do not count this packet as production canary evidence.",
        "If this was a fixture packet, rerun with --packet pointing to the returned agent zip.",
        "If this was a real packet, inspect review.failedChecks and ask the agent for a fresh strict-real canary window.",
      ],
};

const serialized = `${JSON.stringify(output, null, 2)}\n`;
assertSafeText(serialized, "returned packet intake output");
if (outputPath) writeFileSync(outputPath, serialized, { encoding: "utf8", mode: 0o600 });
process.stdout.write(serialized);

if (!output.ok || reviewRun.status !== 0 && requireProductionCanary) {
  process.exitCode = 1;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item === "--strict-real") parsed.strictReal = true;
    else if (item === "--require-production-canary") parsed.requireProductionCanary = true;
    else if (item.startsWith("--")) {
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
  return isAbsolute(value) ? value : resolve(process.cwd(), value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedCommit(value) {
  const commit = String(value ?? "").trim();
  if (!commit) return "";
  assert.match(commit, /^[a-f0-9]{7,40}$/i, "expected commit must be a git SHA prefix or full SHA");
  return commit;
}

function assertSafeText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a raw local path`);
}
