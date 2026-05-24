import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const tempRoot = mkdtempSync(join(tmpdir(), "recallweave-returned-canary-inbox-"));
const outputPath = args.output ? resolvePath(args.output) : null;
const requireProductionCanary = Boolean(args.requireProductionCanary);
const maxBytes = Number(args.maxBytes ?? 25 * 1024 * 1024);
const exposeLabels = Boolean(args.exposeLabels);
const expectedCommit = normalizedCommit(args.expectedCommit || process.env.RECALLWEAVE_CANARY_EXPECTED_COMMIT || "");

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;
const likelyReturnedNamePattern = /(?:canary|recallweave|selfmem|memory|openclaw|hermes)/i;
const handoffEntries = new Set([
  "next-agent-plan.json",
  "next-agent-plan.md",
  "strict-real-operator-packet.md",
  "strict-real-canary-drill.md",
]);
const evidenceEntries = new Set(["README.md", "manifest.json", "canary-report.json", "canary-intake.json", "canary-diagnosis.json"]);

try {
  const candidates = collectCandidates();
  const results = candidates.map((candidate) => inspectCandidate(candidate));
  const productionEvidencePackets = results.filter((candidate) => candidate.countsAsProductionCanaryEvidence);
  const returnedEvidencePackets = results.filter((candidate) => candidate.kind === "returned-evidence");
  const handoffPackets = results.filter((candidate) => candidate.kind === "handoff-packet");
  const diagnosticBundles = results.filter((candidate) => candidate.kind === "diagnostic-bundle");
  const unreadablePackets = results.filter((candidate) => candidate.kind === "unreadable-zip");
  const fatalExplicitFailures = results.filter((candidate) => candidate.explicit && !candidate.ok);
  const ok = fatalExplicitFailures.length === 0 && (!requireProductionCanary || productionEvidencePackets.length > 0);
  const status = productionEvidencePackets.length > 0
    ? "PRODUCTION_CANARY_EVIDENCE_FOUND"
    : returnedEvidencePackets.length > 0
      ? "RETURNED_EVIDENCE_FOUND_NOT_PRODUCTION"
      : handoffPackets.length > 0
        ? "HANDOFF_PACKETS_ONLY"
        : candidates.length > 0
          ? "NO_RETURNED_CANARY_EVIDENCE"
          : "NO_CANDIDATES";

  const output = {
    ok,
    mode: "canary-returned-inbox",
    writesRealFiles: Boolean(outputPath),
    metricsOnly: true,
    requireProductionCanary,
    maxBytes,
    status,
    publicLaunchAllowed: false,
    fleetRolloutAllowed: false,
    sourceControl: {
      expectedCommit: expectedCommit || null,
    },
    input: {
      generatedFixture: candidates.some((candidate) => candidate.generatedFixture),
      inputRootLabel: args.inputRoot || args.folder ? basename(resolvePath(args.inputRoot || args.folder)) : null,
      explicitPacketCount: (args.packet ?? []).length,
      candidateCount: candidates.length,
      broadFolderLabelsRedacted: !exposeLabels,
    },
    counts: {
      scannedZipCount: candidates.length,
      returnedEvidencePackets: returnedEvidencePackets.length,
      productionEvidencePackets: productionEvidencePackets.length,
      handoffPackets: handoffPackets.length,
      diagnosticBundles: diagnosticBundles.length,
      unreadablePackets: unreadablePackets.length,
      unknownPackets: results.filter((candidate) => candidate.kind === "unknown-zip").length,
      fatalExplicitFailures: fatalExplicitFailures.length,
    },
    candidates: results.map(publicCandidate),
    productionEvidencePackets: productionEvidencePackets.map((candidate) => ({
      pathLabel: candidate.pathLabel,
      sha256: candidate.sha256,
      status: candidate.status,
      review: candidate.review,
    })),
    nextActions: productionEvidencePackets.length > 0
      ? [
          "Attach this metrics-only inbox output and the matching packet to maintainer review.",
          "Keep public launch and fleet rollout blocked until the maintainer explicitly promotes the one-agent canary.",
        ]
      : [
          "Do not count this inbox as production canary evidence.",
          "If the folder contains only handoff packets, send the handoff packet to the target agent and wait for a returned evidence packet.",
          "If a returned evidence packet is present, run canary:returned-packet on that packet and inspect failedChecks.",
        ],
  };

  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  assertSafeText(serialized, "returned canary inbox output");
  if (outputPath) writeFileSync(outputPath, serialized, { encoding: "utf8", mode: 0o600 });
  process.stdout.write(serialized);
  if (!ok) process.exitCode = 1;
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

function collectCandidates() {
  const explicitPackets = [...(args.packet ?? [])];
  const envPacket = process.env.RECALLWEAVE_RETURNED_CANARY_PACKET_ZIP;
  if (envPacket) explicitPackets.push(envPacket);

  if (explicitPackets.length > 0) {
    return explicitPackets.map((packet) => candidateFromPath(resolvePath(packet), { explicit: true }));
  }

  const inputRoot = args.inputRoot || args.folder || process.env.RECALLWEAVE_RETURNED_CANARY_INBOX || "";
  if (inputRoot) {
    const resolvedRoot = resolvePath(inputRoot);
    assert.ok(existsSync(resolvedRoot), "returned canary inbox folder is missing");
    return readdirSync(resolvedRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .filter((entry) => entry.name.toLowerCase().endsWith(".zip"))
      .filter((entry) => args.includeAllZips || likelyReturnedNamePattern.test(entry.name))
      .map((entry) => candidateFromPath(join(resolvedRoot, entry.name), { explicit: false }))
      .filter((candidate) => candidate.size <= maxBytes);
  }

  const packetPath = join(tempRoot, "fixture-canary-evidence-packet.zip");
  const result = spawnSync("node", ["packages/bench/canary-evidence-packet.mjs", "--output", packetPath], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, `fixture packet build failed: ${result.stderr}`);
  assertSafeText(result.stdout, "fixture packet build output");
  return [candidateFromPath(packetPath, { explicit: false, generatedFixture: true })];
}

function candidateFromPath(path, options) {
  assert.ok(existsSync(path), `returned canary packet is missing: ${basename(path)}`);
  const file = readFileSync(path);
  const digest = sha256(file);
  const shouldExposeLabel = exposeLabels || Boolean(options.explicit) || Boolean(options.generatedFixture);
  return {
    path,
    pathLabel: shouldExposeLabel ? basename(path) : `zip-${digest.slice(0, 12)}`,
    explicit: Boolean(options.explicit),
    generatedFixture: Boolean(options.generatedFixture),
    size: statSync(path).size,
    sha256: digest,
  };
}

function inspectCandidate(candidate) {
  let entries = [];
  try {
    entries = listZip(candidate.path);
  } catch (error) {
    return {
      ...candidate,
      ok: !candidate.explicit,
      kind: "unreadable-zip",
      status: "UNREADABLE_ZIP",
      countsAsProductionCanaryEvidence: false,
      entryCount: 0,
      safeEntries: [],
      review: {
        ok: false,
        failedChecks: ["unreadable-zip"],
        strictFailureReason: sanitizeForOutput(error instanceof Error ? error.message : String(error)),
      },
    };
  }

  const safeEntries = entries.filter((entry) => evidenceEntries.has(entry) || handoffEntries.has(entry)).sort();
  if (entries.includes("canary-report.json") && entries.includes("manifest.json")) {
    return inspectReturnedEvidenceCandidate(candidate, entries, safeEntries);
  }

  if (entries.some((entry) => handoffEntries.has(entry))) {
    return {
      ...candidate,
      ok: true,
      kind: "handoff-packet",
      status: "HANDOFF_PACKET_NOT_RETURNED_EVIDENCE",
      countsAsProductionCanaryEvidence: false,
      entryCount: entries.length,
      safeEntries,
      review: {
        ok: false,
        failedChecks: ["not-returned-evidence-packet"],
        strictFailureReason: "handoff packets must be executed by an agent before they can count as returned canary evidence",
      },
    };
  }

  if (entries.some((entry) => /(?:trace_metadata_only|reliability_reports|selfmem_canary|container-map\.json)/.test(entry))) {
    return {
      ...candidate,
      ok: true,
      kind: "diagnostic-bundle",
      status: "DIAGNOSTIC_BUNDLE_USE_CANARY_BATCH_AUDIT",
      countsAsProductionCanaryEvidence: false,
      entryCount: entries.length,
      safeEntries,
      review: {
        ok: false,
        failedChecks: ["not-returned-evidence-packet"],
        strictFailureReason: "diagnostic bundles should go through canary:batch-audit before returned-packet intake",
      },
    };
  }

  return {
    ...candidate,
    ok: true,
    kind: "unknown-zip",
    status: "UNKNOWN_ZIP_NOT_CANARY_EVIDENCE",
    countsAsProductionCanaryEvidence: false,
    entryCount: entries.length,
    safeEntries,
    review: {
      ok: false,
      failedChecks: ["not-canary-evidence-packet"],
      strictFailureReason: "zip does not contain the returned canary evidence packet contract",
    },
  };
}

function inspectReturnedEvidenceCandidate(candidate, entries, safeEntries) {
  const reviewArgs = ["packages/bench/canary-returned-packet-intake.mjs", "--packet", candidate.path];
  if (requireProductionCanary) reviewArgs.push("--require-production-canary");
  if (expectedCommit) reviewArgs.push("--expected-commit", expectedCommit);
  const run = spawnSync("node", reviewArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  let intake = null;
  let parseError = null;
  try {
    assertSafeText(run.stdout, `${candidate.pathLabel} intake stdout`);
    if (run.stdout.trim()) intake = JSON.parse(run.stdout);
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }

  const countsAsProductionCanaryEvidence = Boolean(intake?.countsAsProductionCanaryEvidence);
  return {
    ...candidate,
    ok: Boolean(intake) && (run.status === 0 || !requireProductionCanary),
    kind: "returned-evidence",
    status: intake?.status ?? "UNREADABLE_RETURNED_EVIDENCE",
    countsAsProductionCanaryEvidence,
    entryCount: entries.length,
    safeEntries,
    review: intake?.review
      ? {
          ok: Boolean(intake.review.ok),
          strictReal: Boolean(intake.review.strictReal),
          strictRealPassed: Boolean(intake.review.strictRealPassed),
          fixtureOnly: intake.review.fixtureOnly,
          canaryPass: Boolean(intake.review.canaryPass),
          countsAsRealRolloutEvidence: Boolean(intake.review.countsAsRealRolloutEvidence),
          packagePassesStrictReal: Boolean(intake.review.packagePassesStrictReal),
          failedChecks: intake.review.failedChecks ?? [],
          strictFailureReason: intake.review.strictFailureReason ?? null,
          sourceControl: intake.review.sourceControl ?? intake.sourceControl ?? null,
        }
      : {
          ok: false,
          strictReal: requireProductionCanary,
          strictRealPassed: false,
          fixtureOnly: null,
          canaryPass: false,
          countsAsRealRolloutEvidence: false,
          packagePassesStrictReal: false,
          failedChecks: ["unreadable-returned-evidence"],
          strictFailureReason: sanitizeForOutput(parseError ?? "returned packet intake did not produce parseable JSON"),
        },
  };
}

function publicCandidate(candidate) {
  return {
    pathLabel: candidate.pathLabel,
    explicit: candidate.explicit,
    generatedFixture: candidate.generatedFixture,
    sha256: candidate.sha256,
    size: candidate.size,
    kind: candidate.kind,
    status: candidate.status,
    ok: candidate.ok,
    countsAsProductionCanaryEvidence: candidate.countsAsProductionCanaryEvidence,
    entryCount: candidate.entryCount,
    safeEntries: candidate.safeEntries,
    review: candidate.review,
  };
}

function listZip(zipPath) {
  const listed = spawnSync("unzip", ["-Z1", zipPath], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(listed.status, 0, `zip listing failed: ${listed.stderr}`);
  assertSafeText(listed.stdout, "zip entries");
  return listed.stdout.split(/\r?\n/).filter(Boolean).sort();
}

function parseArgs(argv) {
  const parsed = { packet: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item === "--require-production-canary") parsed.requireProductionCanary = true;
    else if (item === "--include-all-zips") parsed.includeAllZips = true;
    else if (item === "--expose-labels") parsed.exposeLabels = true;
    else if (item === "--packet") {
      parsed.packet.push(argv[index + 1] ?? "");
      index += 1;
    } else if (item.startsWith("--")) {
      parsed[toCamel(item.slice(2))] = argv[index + 1] ?? "";
      index += 1;
    }
  }
  parsed.packet = parsed.packet.filter(Boolean);
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

function sanitizeForOutput(text) {
  return String(text)
    .replace(/(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/)[^\s"']+/g, "<local-path>")
    .replace(/[A-Za-z]:\\Users\\[^\s"']+/g, "<local-path>");
}
