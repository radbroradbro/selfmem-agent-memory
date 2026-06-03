import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const packetInput = args.packet || process.env.RECALLWEAVE_RETURNED_BASELINE_PACKET_ZIP || "";
const requireProductionBaseline = Boolean(args.requireProductionBaseline);
const requirePublicBenchmark = Boolean(args.requirePublicBenchmark);
const reviewStrictReal = Boolean(args.strictReal || requireProductionBaseline || requirePublicBenchmark || packetInput);
const outputPath = args.output ? resolvePath(args.output) : null;

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;

if (packetInput) {
  const resolvedPacket = resolvePath(packetInput);
  assert.ok(existsSync(resolvedPacket), "returned baseline packet is missing");
}

const reviewArgs = [];
if (packetInput) reviewArgs.push("--packet", resolvePath(packetInput));
if (reviewStrictReal) reviewArgs.push("--strict-real");

const reviewRun = spawnSync("node", ["packages/bench/baseline-evidence-packet-review.mjs", ...reviewArgs], {
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

const countsAsProductionBaselineEvidence = Boolean(review?.countsAsProductionBaselineEvidence);
const countsAsPublicBenchmarkEvidence = Boolean(review?.countsAsPublicBenchmarkEvidence);
const status = countsAsPublicBenchmarkEvidence
  ? "READY_FOR_PUBLIC_BENCHMARK_REVIEW"
  : countsAsProductionBaselineEvidence
    ? "READY_FOR_BASELINE_REVIEW"
    : review
      ? "NOT_BASELINE_EVIDENCE"
      : "UNREADABLE_PACKET";

const output = {
  ok:
    status !== "UNREADABLE_PACKET" &&
    (!requireProductionBaseline || countsAsProductionBaselineEvidence) &&
    (!requirePublicBenchmark || countsAsPublicBenchmarkEvidence),
  mode: "baseline-returned-packet-intake",
  writesRealFiles: Boolean(outputPath),
  metricsOnly: true,
  reviewStrictReal,
  requireProductionBaseline,
  requirePublicBenchmark,
  status,
  countsAsProductionBaselineEvidence,
  countsAsPublicBenchmarkEvidence,
  publicLaunchAllowed: false,
  packet: {
    pathLabel: packetInput ? basename(packetInput) : review?.packet?.pathLabel ?? "generated-fixture-baseline-evidence-packet.zip",
    sha256: packetInput ? sha256(readFileSync(resolvePath(packetInput))) : review?.packet?.sha256 ?? null,
    entries: review?.packet?.entries ?? [],
  },
  review: review
    ? {
        ok: Boolean(review.ok),
        strictReal: Boolean(review.strictReal),
        strictRealPassed: Boolean(review.strictRealPassed),
        fixtureOnly: Boolean(review.fixtureOnly),
        countsAsHostedBaselineEvidence: Boolean(review.countsAsHostedBaselineEvidence),
        countsAsComparisonEvidence: Boolean(review.countsAsComparisonEvidence),
        packagePassesStrictReal: Boolean(review.packagePassesStrictReal),
        recallWeaveWin: Boolean(review.recallWeaveWin),
        reviewerApprovalCount: Number(review.reviewerApprovalCount ?? 0),
        publicBenchmarkClaimsAllowed: Boolean(review.publicBenchmarkClaimsAllowed),
        failedChecks: review.failedChecks ?? [],
        strictFailureReason: review.strictFailureReason ?? null,
      }
    : {
        ok: false,
        strictReal: reviewStrictReal,
        strictRealPassed: false,
        fixtureOnly: null,
        countsAsHostedBaselineEvidence: false,
        countsAsComparisonEvidence: false,
        packagePassesStrictReal: false,
        recallWeaveWin: false,
        reviewerApprovalCount: 0,
        publicBenchmarkClaimsAllowed: false,
        failedChecks: ["unreadable-packet"],
        strictFailureReason: parseError ?? "packet review did not produce parseable JSON",
      },
  nextActions: countsAsPublicBenchmarkEvidence
    ? [
        "Attach this metrics-only intake output and the packet for owner launch review.",
        "Public launch remains blocked until the owner explicitly approves visibility, merge, and live update language.",
      ]
    : countsAsProductionBaselineEvidence
      ? [
          "Attach this metrics-only intake output and the packet for reviewer approval.",
          "Do not publish comparison claims until reviewerApprovalCount is at least 2 and publicBenchmarkClaimsAllowed is true.",
        ]
      : [
          "Do not count this packet as hosted baseline evidence.",
          "If this was a fixture packet, rerun with --packet pointing to the returned baseline evidence zip.",
          "If this was a real packet, inspect review.failedChecks and ask for a fresh metrics-only hosted baseline packet.",
        ],
};

const serialized = `${JSON.stringify(output, null, 2)}\n`;
assertSafeText(serialized, "returned packet intake output");
if (outputPath) writeFileSync(outputPath, serialized, { encoding: "utf8", mode: 0o600 });
process.stdout.write(serialized);

if (!output.ok || (reviewRun.status !== 0 && (requireProductionBaseline || requirePublicBenchmark))) {
  process.exitCode = 1;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item === "--strict-real") parsed.strictReal = true;
    else if (item === "--require-production-baseline") parsed.requireProductionBaseline = true;
    else if (item === "--require-public-benchmark") parsed.requirePublicBenchmark = true;
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

function assertSafeText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a raw local path`);
}
