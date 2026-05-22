import { createServer as createHttpServer } from "node:http";
import { createHash } from "node:crypto";
import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditLocalContainer,
  browseLocalContainer,
  compileNucleusWikiVault,
  lintCompiledWikiVault,
  redactPrivate,
  syncCompiledWikiVault,
} from "../core/dist/index.js";

const root = fileURLToPath(new URL(".", import.meta.url));

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
]);

export function createBrainUiServer(options = {}) {
  const enableLocalAudit = options.enableLocalAudit ?? process.env.RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_AUDIT === "1";
  const enableLocalBrowse = options.enableLocalBrowse ?? process.env.RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_BROWSE === "1";
  const enableLocalApply = options.enableLocalApply ?? process.env.RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_APPLY === "1";
  const enablePolicyApply = options.enablePolicyApply ?? process.env.RECALLWEAVE_BRAIN_UI_ENABLE_POLICY_APPLY === "1";
  const enableReviewApply = options.enableReviewApply ?? process.env.RECALLWEAVE_BRAIN_UI_ENABLE_REVIEW_APPLY === "1";
  const enableLocalEdit = options.enableLocalEdit ?? process.env.RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_EDIT === "1";

  return createHttpServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const path = routePath(url.pathname);

      if (path === "__healthz") {
        send(response, 200, "application/json; charset=utf-8", JSON.stringify({ ok: true }));
        return;
      }

      if (path === "__favicon") {
        send(response, 204, "image/x-icon", "");
        return;
      }

      if (path === "__wiki_vault_fixture") {
        const fixture = JSON.parse(await readFile(join(root, "fixtures/nucleus.fixture.json"), "utf8"));
        const vault = compileNucleusWikiVault(fixture);
        send(response, 200, "application/json; charset=utf-8", JSON.stringify({ ok: true, vault, lint: lintCompiledWikiVault(vault) }));
        return;
      }

      if (path === "__wiki_sync_report_fixture") {
        const fixture = JSON.parse(await readFile(join(root, "fixtures/nucleus.fixture.json"), "utf8"));
        const vault = compileNucleusWikiVault(fixture);
        const report = await createFixtureSyncReport(vault);
        send(response, 200, "application/json; charset=utf-8", JSON.stringify({ ok: true, report }));
        return;
      }

      if (path === "__local_container_audit_fixture") {
        const report = await createFixtureLocalContainerAudit();
        send(response, 200, "application/json; charset=utf-8", JSON.stringify({ ok: true, report }));
        return;
      }

      if (path === "__local_container_browse_fixture") {
        const report = await createFixtureLocalContainerBrowse();
        send(response, 200, "application/json; charset=utf-8", JSON.stringify({ ok: true, report }));
        return;
      }

      if (path === "__local_container_audit") {
        if (!enableLocalAudit) {
          send(
            response,
            403,
            "application/json; charset=utf-8",
            JSON.stringify({
              ok: false,
              code: "local_audit_disabled",
              message: "Set RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_AUDIT=1 to inspect a selected local container.",
            }),
          );
          return;
        }
        if (request.method !== "POST") {
          send(response, 405, "application/json; charset=utf-8", JSON.stringify({ ok: false, code: "method_not_allowed" }));
          return;
        }
        const result = await auditSelectedLocalContainer(request);
        send(response, 200, "application/json; charset=utf-8", JSON.stringify(result));
        return;
      }

      if (path === "__local_container_browse") {
        if (!enableLocalBrowse) {
          send(
            response,
            403,
            "application/json; charset=utf-8",
            JSON.stringify({
              ok: false,
              code: "local_browse_disabled",
              message: "Set RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_BROWSE=1 to browse a selected local container.",
            }),
          );
          return;
        }
        if (request.method !== "POST") {
          send(response, 405, "application/json; charset=utf-8", JSON.stringify({ ok: false, code: "method_not_allowed" }));
          return;
        }
        const result = await browseSelectedLocalContainer(request);
        send(response, 200, "application/json; charset=utf-8", JSON.stringify(result));
        return;
      }

      if (path === "__wiki_sync_dry_run") {
        if (!enableLocalAudit) {
          send(
            response,
            403,
            "application/json; charset=utf-8",
            JSON.stringify({
              ok: false,
              code: "local_sync_disabled",
              message: "Set RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_AUDIT=1 to preview selected local vault sync.",
            }),
          );
          return;
        }
        if (request.method !== "POST") {
          send(response, 405, "application/json; charset=utf-8", JSON.stringify({ ok: false, code: "method_not_allowed" }));
          return;
        }
        const result = await dryRunSelectedWikiSync(request);
        send(response, 200, "application/json; charset=utf-8", JSON.stringify(result));
        return;
      }

      if (path === "__wiki_sync_apply") {
        if (!enableLocalApply) {
          send(
            response,
            403,
            "application/json; charset=utf-8",
            JSON.stringify({
              ok: false,
              code: "local_sync_apply_disabled",
              message: "Set RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_APPLY=1 to apply selected local vault sync.",
            }),
          );
          return;
        }
        if (request.method !== "POST") {
          send(response, 405, "application/json; charset=utf-8", JSON.stringify({ ok: false, code: "method_not_allowed" }));
          return;
        }
        const result = await applySelectedWikiSync(request);
        send(response, 200, "application/json; charset=utf-8", JSON.stringify(result));
        return;
      }

      if (path === "__lifecycle_policy_apply") {
        if (!enablePolicyApply) {
          send(
            response,
            403,
            "application/json; charset=utf-8",
            JSON.stringify({
              ok: false,
              code: "lifecycle_policy_apply_disabled",
              message: "Set RECALLWEAVE_BRAIN_UI_ENABLE_POLICY_APPLY=1 to apply selected local lifecycle policy.",
            }),
          );
          return;
        }
        if (request.method !== "POST") {
          send(response, 405, "application/json; charset=utf-8", JSON.stringify({ ok: false, code: "method_not_allowed" }));
          return;
        }
        const result = await applySelectedLifecyclePolicy(request);
        send(response, 200, "application/json; charset=utf-8", JSON.stringify(result));
        return;
      }

      if (path === "__review_queue_apply") {
        if (!enableReviewApply) {
          send(
            response,
            403,
            "application/json; charset=utf-8",
            JSON.stringify({
              ok: false,
              code: "review_queue_apply_disabled",
              message: "Set RECALLWEAVE_BRAIN_UI_ENABLE_REVIEW_APPLY=1 to apply selected local review decisions.",
            }),
          );
          return;
        }
        if (request.method !== "POST") {
          send(response, 405, "application/json; charset=utf-8", JSON.stringify({ ok: false, code: "method_not_allowed" }));
          return;
        }
        const result = await applySelectedReviewQueue(request);
        send(response, 200, "application/json; charset=utf-8", JSON.stringify(result));
        return;
      }

      if (path === "__local_container_edit") {
        if (!enableLocalEdit) {
          send(
            response,
            403,
            "application/json; charset=utf-8",
            JSON.stringify({
              ok: false,
              code: "local_edit_disabled",
              message: "Set RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_EDIT=1 to apply a selected local memory edit overlay.",
            }),
          );
          return;
        }
        if (request.method !== "POST") {
          send(response, 405, "application/json; charset=utf-8", JSON.stringify({ ok: false, code: "method_not_allowed" }));
          return;
        }
        const result = await applySelectedLocalMemoryEdit(request);
        send(response, 200, "application/json; charset=utf-8", JSON.stringify(result));
        return;
      }

      const filePath = resolve(root, path);
      if (!filePath.startsWith(root)) throw new Error("invalid path");
      const body = await readFile(filePath);
      send(response, 200, contentTypes.get(extname(filePath)) ?? "application/octet-stream", body);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      send(response, 404, "application/json; charset=utf-8", JSON.stringify({ ok: false, error: message }));
    }
  });
}

function routePath(pathname) {
  if (pathname === "/" || pathname === "/index.html") return "src/index.html";
  if (pathname === "/app.js") return "src/app.js";
  if (pathname === "/model.js") return "src/model.js";
  if (pathname === "/styles.css") return "src/styles.css";
  if (pathname === "/fixtures/nucleus.fixture.json") return "fixtures/nucleus.fixture.json";
  if (pathname === "/fixtures/wiki-vault.json") return "__wiki_vault_fixture";
  if (pathname === "/fixtures/wiki-sync-report.json") return "__wiki_sync_report_fixture";
  if (pathname === "/fixtures/local-container-audit.json") return "__local_container_audit_fixture";
  if (pathname === "/fixtures/local-container-browse.json") return "__local_container_browse_fixture";
  if (pathname === "/local-container/audit") return "__local_container_audit";
  if (pathname === "/local-container/browse") return "__local_container_browse";
  if (pathname === "/wiki/sync/dry-run") return "__wiki_sync_dry_run";
  if (pathname === "/wiki/sync/apply") return "__wiki_sync_apply";
  if (pathname === "/lifecycle-policy/apply") return "__lifecycle_policy_apply";
  if (pathname === "/review-queue/apply") return "__review_queue_apply";
  if (pathname === "/local-container/edit") return "__local_container_edit";
  if (pathname === "/favicon.ico") return "__favicon";
  if (pathname === "/healthz") return "__healthz";

  const cleaned = normalize(pathname.replace(/^\/+/, ""));
  if (cleaned.startsWith("..")) throw new Error("invalid path");
  if (!cleaned.startsWith("src/") && !cleaned.startsWith("fixtures/")) throw new Error("not found");
  return cleaned;
}

async function createFixtureSyncReport(vault) {
  const tempRoot = await mkdtemp(join(tmpdir(), "recallweave-brain-sync-fixture-"));
  try {
    const reviewedFile = vault.files.find((file) => file.kind === "wiki_page" && file.path.endsWith(".md"));
    if (reviewedFile) {
      const target = resolveUnderRoot(tempRoot, reviewedFile.path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, "---\ntitle: \"Fixture reviewed page\"\nreviewed: true\n---\n\nReviewed fixture content remains unchanged.\n", "utf8");
    }
    const report = await syncCompiledWikiVault(vault, { rootDir: tempRoot, dryRun: true });
    return {
      ...report,
      rootDir: "fixture-temp-vault",
      summary: summarizeSyncActions(report.actions),
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function createFixtureLocalContainerAudit() {
  const tempRoot = await mkdtemp(join(tmpdir(), "recallweave-brain-local-audit-fixture-"));
  try {
    const keyLike = `pa-${"A".repeat(44)}`;
    await writeFile(join(tempRoot, "memories.jsonl"), "{\"kind\":\"decision\",\"text\":\"Use local writes.\"}\n", "utf8");
    await writeFile(
      join(tempRoot, "raw_events.jsonl"),
      `{"event":"store","text":"public <private>hidden</private> ${keyLike}"}\n`,
      "utf8",
    );
    await writeFile(join(tempRoot, "trace.jsonl"), "{\"event\":\"search\",\"count\":1}\n", "utf8");
    return await auditLocalContainer({
      rootDir: tempRoot,
      containerLabel: "fixture-local-container",
      maxFileBytes: 256_000,
    });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function createFixtureLocalContainerBrowse() {
  const tempRoot = await mkdtemp(join(tmpdir(), "recallweave-brain-local-browse-fixture-"));
  try {
    await writeFile(
      join(tempRoot, "memories.jsonl"),
      [
        JSON.stringify({ id: "mem_fixture_1", kind: "decision", text: "Use local-only writes with hosted read-through disabled by default." }),
        JSON.stringify({ id: "mem_fixture_2", kind: "preference", text: "Prefer concise lifecycle recall for maintenance turns." }),
        JSON.stringify({ id: "mem_fixture_3", kind: "secret", text: "<private>hidden fixture</private>" }),
      ].join("\n"),
      "utf8",
    );
    await writeFile(join(tempRoot, "trace.jsonl"), "{\"event\":\"search\",\"query\":\"memory health\",\"count\":2}\n", "utf8");
    return await browseLocalContainer({
      rootDir: tempRoot,
      containerLabel: "fixture-local-container",
      maxFileBytes: 256_000,
      maxItems: 8,
    });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function auditSelectedLocalContainer(request) {
  const body = await readJsonBody(request, 20_000);
  const rootDir = typeof body.rootDir === "string" ? body.rootDir.trim() : "";
  const containerLabel = typeof body.containerLabel === "string" ? body.containerLabel.trim() : undefined;
  const maxFileBytes = Number.isFinite(body.maxFileBytes) ? Number(body.maxFileBytes) : 256_000;

  if (body.confirmReadOnly !== true) {
    return {
      ok: false,
      code: "read_only_confirmation_required",
      message: "Confirm read-only audit before inspecting a selected local container.",
    };
  }

  if (!rootDir) {
    return { ok: false, code: "root_dir_required", message: "Choose a local container directory first." };
  }

  const report = await auditLocalContainer({
    rootDir,
    containerLabel,
    maxFileBytes: Math.min(Math.max(maxFileBytes, 1_024), 1_000_000),
  });

  return {
    ok: true,
    mode: "selected-local-container-audit",
    writesRealFiles: false,
    selection: {
      rootPathRedacted: true,
      rootDisplay: redactPathForDisplay(rootDir),
      containerLabel: report.containerLabel,
    },
    auditTrail: {
      event: "local_container_audit_preview",
      status: report.health.status,
      existingFiles: report.totals.existingFiles,
      redactionCount: report.totals.redactionCount,
      writesRealFiles: false,
    },
    report,
  };
}

async function browseSelectedLocalContainer(request) {
  const body = await readJsonBody(request, 20_000);
  const rootDir = typeof body.rootDir === "string" ? body.rootDir.trim() : "";
  const containerLabel = typeof body.containerLabel === "string" ? body.containerLabel.trim() : undefined;
  const maxFileBytes = Number.isFinite(body.maxFileBytes) ? Number(body.maxFileBytes) : 256_000;
  const maxItems = Number.isFinite(body.maxItems) ? Number(body.maxItems) : 12;

  if (body.confirmReadOnly !== true) {
    return {
      ok: false,
      code: "read_only_confirmation_required",
      message: "Confirm read-only browse before inspecting selected local memory entries.",
    };
  }

  if (!rootDir) {
    return { ok: false, code: "root_dir_required", message: "Choose a local container directory first." };
  }

  const report = await browseLocalContainer({
    rootDir,
    containerLabel,
    maxFileBytes: Math.min(Math.max(maxFileBytes, 1_024), 1_000_000),
    maxItems: Math.min(Math.max(maxItems, 1), 25),
  });

  return {
    ok: true,
    mode: "selected-local-container-browse",
    writesRealFiles: false,
    selection: {
      rootPathRedacted: true,
      rootDisplay: redactPathForDisplay(rootDir),
      containerLabel: report.containerLabel,
    },
    auditTrail: {
      event: "local_container_browse_preview",
      itemsReturned: report.totals.itemsReturned,
      redactionCount: report.totals.redactionCount,
      writesRealFiles: false,
    },
    report,
  };
}

async function dryRunSelectedWikiSync(request) {
  const body = await readJsonBody(request, 20_000);
  const rootDir = typeof body.rootDir === "string" ? body.rootDir.trim() : "";

  if (body.confirmReadOnly !== true) {
    return {
      ok: false,
      code: "read_only_confirmation_required",
      message: "Confirm read-only dry run before inspecting a selected local vault.",
    };
  }

  if (!rootDir) {
    return { ok: false, code: "root_dir_required", message: "Choose a local vault directory first." };
  }

  const fixture = JSON.parse(await readFile(join(root, "fixtures/nucleus.fixture.json"), "utf8"));
  const vault = compileNucleusWikiVault(fixture);
  const report = await syncCompiledWikiVault(vault, { rootDir, dryRun: true });
  const summary = summarizeSyncActions(report.actions);

  return {
    ok: true,
    mode: "selected-wiki-sync-dry-run",
    writesRealFiles: false,
    selection: {
      rootPathRedacted: true,
      rootDisplay: redactPathForDisplay(rootDir),
    },
    auditTrail: {
      event: "wiki_vault_sync_dry_run",
      writesRealFiles: false,
      actionCount: report.actions.length,
      summary,
    },
    report: {
      ok: report.ok,
      dryRun: true,
      rootDir: redactPathForDisplay(rootDir),
      summary,
      actions: report.actions,
    },
  };
}

async function applySelectedWikiSync(request) {
  const body = await readJsonBody(request, 20_000);
  const rootDir = typeof body.rootDir === "string" ? body.rootDir.trim() : "";
  const confirmationPhrase = typeof body.confirmationPhrase === "string" ? body.confirmationPhrase.trim() : "";

  if (body.confirmWrite !== true || confirmationPhrase !== "APPLY LOCAL WIKI SYNC") {
    return {
      ok: false,
      code: "write_confirmation_required",
      message: "Confirm write apply and type APPLY LOCAL WIKI SYNC before writing selected local vault files.",
    };
  }

  if (!rootDir) {
    return { ok: false, code: "root_dir_required", message: "Choose a local vault directory first." };
  }

  const fixture = JSON.parse(await readFile(join(root, "fixtures/nucleus.fixture.json"), "utf8"));
  const vault = compileNucleusWikiVault(fixture);
  const lint = lintCompiledWikiVault(vault);
  if (lint.length > 0) {
    return {
      ok: false,
      code: "vault_lint_failed",
      message: "Selected local vault sync apply requires a lint-clean compiled wiki vault.",
      lint: lint.map((issue) => ({ code: issue.code, path: issue.path })),
    };
  }
  const report = await syncCompiledWikiVault(vault, {
    rootDir,
    dryRun: false,
    auditLogPath: ".recallweave/wiki-sync-audit.jsonl",
  });
  const summary = summarizeSyncActions(report.actions);

  return {
    ok: true,
    mode: "selected-wiki-sync-apply",
    writesRealFiles: true,
    selection: {
      rootPathRedacted: true,
      rootDisplay: redactPathForDisplay(rootDir),
    },
    auditTrail: {
      event: "wiki_vault_sync_apply",
      writesRealFiles: true,
      actionCount: report.actions.length,
      summary,
      auditLog: report.auditLog,
    },
    report: {
      ok: report.ok,
      dryRun: false,
      rootDir: redactPathForDisplay(rootDir),
      summary,
      actions: report.actions,
      auditLog: report.auditLog,
    },
  };
}

async function applySelectedLifecyclePolicy(request) {
  const body = await readJsonBody(request, 80_000);
  const rootDir = typeof body.rootDir === "string" ? body.rootDir.trim() : "";
  const confirmationPhrase = typeof body.confirmationPhrase === "string" ? body.confirmationPhrase.trim() : "";

  if (body.confirmWrite !== true || confirmationPhrase !== "APPLY LOCAL LIFECYCLE POLICY") {
    return {
      ok: false,
      code: "write_confirmation_required",
      message: "Confirm policy write and type APPLY LOCAL LIFECYCLE POLICY before writing selected local lifecycle policy.",
    };
  }

  if (!rootDir) {
    return { ok: false, code: "root_dir_required", message: "Choose a local container directory first." };
  }

  const rawPolicyText = JSON.stringify(body.policy ?? {});
  const redaction = redactPrivate(rawPolicyText);
  if (redaction.redacted) {
    return {
      ok: false,
      code: "policy_contains_private_or_key_shaped_text",
      message: "Policy apply refused private or key-shaped policy text.",
      redactionCount: redaction.redactionCount,
    };
  }

  const appliedAt = new Date().toISOString();
  const policy = normalizeLifecyclePolicy(body.policy, appliedAt);
  const policyJson = `${JSON.stringify(policy, null, 2)}\n`;
  const contentHash = createHash("sha256").update(policyJson).digest("hex");
  const policyPath = resolveUnderSelectedRoot(rootDir, ".recallweave/lifecycle-policy.json");
  const auditPath = resolveUnderSelectedRoot(rootDir, ".recallweave/lifecycle-policy-audit.jsonl");
  await mkdir(dirname(policyPath), { recursive: true });
  await writeFile(policyPath, policyJson, "utf8");
  await appendFile(
    auditPath,
    `${JSON.stringify({
      schemaVersion: 1,
      event: "lifecycle_policy_apply",
      createdAt: appliedAt,
      writesRealFiles: true,
      policyPath: ".recallweave/lifecycle-policy.json",
      contentHash,
      changedFields: policy.changedFields.map((change) => change.field),
    })}\n`,
    "utf8",
  );

  return {
    ok: true,
    mode: "selected-lifecycle-policy-apply",
    writesRealFiles: true,
    selection: {
      rootPathRedacted: true,
      rootDisplay: redactPathForDisplay(rootDir),
    },
    auditTrail: {
      event: "lifecycle_policy_apply",
      writesRealFiles: true,
      auditLog: {
        path: ".recallweave/lifecycle-policy-audit.jsonl",
        entriesWritten: 1,
      },
      contentHash,
    },
    report: {
      ok: true,
      dryRun: false,
      rootDir: redactPathForDisplay(rootDir),
      policyPath: ".recallweave/lifecycle-policy.json",
      auditLog: {
        path: ".recallweave/lifecycle-policy-audit.jsonl",
        entriesWritten: 1,
      },
      summary: {
        changedFields: policy.changedFields.length,
        forceEveryTurn: policy.recall.forceEveryTurn,
        storePreCompressCheckpoints: policy.writes.storePreCompressCheckpoints,
        maxAutoWritesPerSession: policy.writes.maxAutoWritesPerSession,
        lowConfidenceAction: policy.writes.lowConfidenceAction,
      },
    },
  };
}

async function applySelectedReviewQueue(request) {
  const body = await readJsonBody(request, 80_000);
  const rootDir = typeof body.rootDir === "string" ? body.rootDir.trim() : "";
  const confirmationPhrase = typeof body.confirmationPhrase === "string" ? body.confirmationPhrase.trim() : "";

  if (body.confirmWrite !== true || confirmationPhrase !== "APPLY LOCAL REVIEW QUEUE") {
    return {
      ok: false,
      code: "write_confirmation_required",
      message: "Confirm review write and type APPLY LOCAL REVIEW QUEUE before writing selected local review decisions.",
    };
  }

  if (!rootDir) {
    return { ok: false, code: "root_dir_required", message: "Choose a local container directory first." };
  }

  const rawQueueText = JSON.stringify(body.reviewQueue ?? {});
  const redaction = redactPrivate(rawQueueText);
  if (redaction.redacted) {
    return {
      ok: false,
      code: "review_queue_contains_private_or_key_shaped_text",
      message: "Review apply refused private or key-shaped review text.",
      redactionCount: redaction.redactionCount,
    };
  }

  const appliedAt = new Date().toISOString();
  const decisions = normalizeReviewDecisions(body.reviewQueue, appliedAt);
  if (decisions.length === 0) {
    return {
      ok: false,
      code: "review_decisions_required",
      message: "Review apply requires at least one review decision.",
    };
  }

  const decisionPayload = decisions.map((decision) => JSON.stringify(decision)).join("\n") + "\n";
  const contentHash = createHash("sha256").update(decisionPayload).digest("hex");
  const decisionsPath = resolveUnderSelectedRoot(rootDir, ".recallweave/review-decisions.jsonl");
  const auditPath = resolveUnderSelectedRoot(rootDir, ".recallweave/review-queue-audit.jsonl");
  const summary = summarizeReviewDecisions(decisions);
  await mkdir(dirname(decisionsPath), { recursive: true });
  await appendFile(decisionsPath, decisionPayload, "utf8");
  await appendFile(
    auditPath,
    `${JSON.stringify({
      schemaVersion: 1,
      event: "review_queue_apply",
      createdAt: appliedAt,
      writesRealFiles: true,
      decisionsPath: ".recallweave/review-decisions.jsonl",
      contentHash,
      summary,
    })}\n`,
    "utf8",
  );

  return {
    ok: true,
    mode: "selected-review-queue-apply",
    writesRealFiles: true,
    selection: {
      rootPathRedacted: true,
      rootDisplay: redactPathForDisplay(rootDir),
    },
    auditTrail: {
      event: "review_queue_apply",
      writesRealFiles: true,
      auditLog: {
        path: ".recallweave/review-queue-audit.jsonl",
        entriesWritten: 1,
      },
      contentHash,
    },
    report: {
      ok: true,
      dryRun: false,
      rootDir: redactPathForDisplay(rootDir),
      decisionsPath: ".recallweave/review-decisions.jsonl",
      auditLog: {
        path: ".recallweave/review-queue-audit.jsonl",
        entriesWritten: 1,
      },
      summary,
    },
  };
}

async function applySelectedLocalMemoryEdit(request) {
  const body = await readJsonBody(request, 80_000);
  const rootDir = typeof body.rootDir === "string" ? body.rootDir.trim() : "";
  const confirmationPhrase = typeof body.confirmationPhrase === "string" ? body.confirmationPhrase.trim() : "";

  if (body.confirmWrite !== true || confirmationPhrase !== "APPLY LOCAL MEMORY EDIT") {
    return {
      ok: false,
      code: "write_confirmation_required",
      message: "Confirm local edit write and type APPLY LOCAL MEMORY EDIT before writing a selected local memory edit overlay.",
    };
  }

  if (!rootDir) {
    return { ok: false, code: "root_dir_required", message: "Choose a local container directory first." };
  }

  const rawEditText = JSON.stringify(body.edit ?? {});
  const redaction = redactPrivate(rawEditText);
  if (redaction.redacted) {
    return {
      ok: false,
      code: "local_edit_contains_private_or_key_shaped_text",
      message: "Local edit refused private or key-shaped edit text.",
      redactionCount: redaction.redactionCount,
    };
  }

  const appliedAt = new Date().toISOString();
  const edit = normalizeLocalMemoryEdit(body.edit, appliedAt);
  if (!edit) {
    return {
      ok: false,
      code: "local_edit_required",
      message: "Local edit requires a supported action, source reference, and replacement text unless the action is suppress.",
    };
  }

  const editPayload = `${JSON.stringify(edit)}\n`;
  const contentHash = createHash("sha256").update(editPayload).digest("hex");
  const editsPath = resolveUnderSelectedRoot(rootDir, ".recallweave/local-memory-edits.jsonl");
  const auditPath = resolveUnderSelectedRoot(rootDir, ".recallweave/local-memory-edit-audit.jsonl");
  await mkdir(dirname(editsPath), { recursive: true });
  await appendFile(editsPath, editPayload, "utf8");
  await appendFile(
    auditPath,
    `${JSON.stringify({
      schemaVersion: 1,
      event: "local_memory_edit_overlay",
      createdAt: appliedAt,
      writesRealFiles: true,
      editsPath: ".recallweave/local-memory-edits.jsonl",
      contentHash,
      sourceFile: edit.sourceFile,
      line: edit.line,
      sourceId: edit.sourceId,
      action: edit.action,
      reason: edit.reason,
      replacementBytes: edit.replacementText ? Buffer.byteLength(edit.replacementText, "utf8") : 0,
      originalContentIncluded: false,
      replacementContentIncludedInAudit: false,
    })}\n`,
    "utf8",
  );

  return {
    ok: true,
    mode: "selected-local-memory-edit",
    writesRealFiles: true,
    selection: {
      rootPathRedacted: true,
      rootDisplay: redactPathForDisplay(rootDir),
    },
    auditTrail: {
      event: "local_memory_edit_overlay",
      writesRealFiles: true,
      auditLog: {
        path: ".recallweave/local-memory-edit-audit.jsonl",
        entriesWritten: 1,
      },
      contentHash,
    },
    report: {
      ok: true,
      dryRun: false,
      rootDir: redactPathForDisplay(rootDir),
      editsPath: ".recallweave/local-memory-edits.jsonl",
      auditLog: {
        path: ".recallweave/local-memory-edit-audit.jsonl",
        entriesWritten: 1,
      },
      summary: {
        sourceFile: edit.sourceFile,
        line: edit.line,
        sourceId: edit.sourceId,
        action: edit.action,
        reason: edit.reason,
        replacementBytes: edit.replacementText ? Buffer.byteLength(edit.replacementText, "utf8") : 0,
        replacementContentIncludedInEditLog: Boolean(edit.replacementText),
        originalContentIncluded: false,
      },
    },
  };
}

async function readJsonBody(request, maxBytes) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body, "utf8") > maxBytes) throw new Error("request body too large");
  }
  if (!body.trim()) return {};
  return JSON.parse(body);
}

function redactPathForDisplay(_rootDir) {
  return ".../selected-local-container";
}

function resolveUnderRoot(rootDir, relativePath) {
  const target = resolve(rootDir, relativePath);
  const rel = relative(rootDir, target);
  if (rel === "" || rel.startsWith("..") || rel.startsWith("/")) {
    throw new Error("fixture path escaped temp root");
  }
  return target;
}

function resolveUnderSelectedRoot(rootDir, relativePath) {
  const target = resolve(rootDir, relativePath);
  const rel = relative(rootDir, target);
  if (rel === "" || rel.startsWith("..") || rel.startsWith("/")) {
    throw new Error("selected path escaped root");
  }
  return target;
}

function normalizeLifecyclePolicy(input, appliedAt) {
  const policy = input && typeof input === "object" ? input : {};
  const recall = policy.recall && typeof policy.recall === "object" ? policy.recall : {};
  const writes = policy.writes && typeof policy.writes === "object" ? policy.writes : {};
  const lifecycle = policy.lifecycle && typeof policy.lifecycle === "object" ? policy.lifecycle : {};
  return {
    schemaVersion: 1,
    mode: "local-lifecycle-policy",
    writesRealFiles: true,
    appliedAt,
    recall: {
      forceEveryTurn: booleanSetting(recall.forceEveryTurn, false),
      defaultMode: safeChoice(recall.defaultMode, ["skip_obvious_maintenance", "balanced", "force_every_turn"]),
      rerankCandidateLimit: clampInteger(recall.rerankCandidateLimit, 1, 200, 36),
      rerankTokenBudget: clampInteger(recall.rerankTokenBudget, 256, 64_000, 6400),
      skipWhenPromptMatches: safeStringList(recall.skipWhenPromptMatches),
      forceWhenPromptMatches: safeStringList(recall.forceWhenPromptMatches),
    },
    writes: {
      storeExplicitToolWrites: booleanSetting(writes.storeExplicitToolWrites, true),
      storeAgentEndSummaries: booleanSetting(writes.storeAgentEndSummaries, true),
      storePreCompressCheckpoints: booleanSetting(writes.storePreCompressCheckpoints, false),
      rejectFullyPrivate: booleanSetting(writes.rejectFullyPrivate, true),
      rejectKeyShapedContent: booleanSetting(writes.rejectKeyShapedContent, true),
      suppressDuplicates: booleanSetting(writes.suppressDuplicates, true),
      maxAutoWritesPerSession: clampInteger(writes.maxAutoWritesPerSession, 0, 200, 20),
      lowConfidenceAction: safeChoice(writes.lowConfidenceAction, [
        "review_queue",
        "suppress",
        "write_with_low_confidence_flag",
      ]),
    },
    lifecycle: {
      hermes: safeStatusMap(lifecycle.hermes),
      openclaw: safeStatusMap(lifecycle.openclaw),
    },
    changedFields: safeChangedFields(policy.changedFields),
  };
}

function normalizeReviewDecisions(input, appliedAt) {
  const items = Array.isArray(input?.items) ? input.items : [];
  return items
    .map((item) => {
      const id = safePolicyToken(item?.id ?? "");
      const action = safeChoice(item?.action, ["approve", "suppress", "merge", "needs_more_evidence"]);
      if (!id) return null;
      return {
        schemaVersion: 1,
        event: "memory_review_decision",
        createdAt: appliedAt,
        candidateId: id,
        action,
        kind: safePolicyToken(item?.kind ?? "memory"),
        reason: safePolicyToken(item?.reason ?? "review_required"),
        sourceNodeId: safePolicyToken(item?.sourceNodeId ?? ""),
        confidence: clampNumber(item?.confidence, 0, 1, 0),
        contentIncluded: false,
      };
    })
    .filter(Boolean)
    .slice(0, 200);
}

function normalizeLocalMemoryEdit(input, appliedAt) {
  const edit = input && typeof input === "object" ? input : {};
  const sourceFile = safeChoice(edit.sourceFile, ["memories.jsonl"]);
  const line = clampInteger(edit.line, 1, 1_000_000, 1);
  const sourceId = safePolicyToken(edit.sourceId ?? "");
  const action = safeChoice(edit.action, ["append_correction", "replace", "suppress", "needs_review"]);
  const reason = safeChoice(edit.reason, ["manual_correction", "duplicate", "stale", "noise", "privacy", "other"], "manual_correction");
  const replacementText = safeMemoryEditText(edit.replacementText ?? "");

  if ((action === "append_correction" || action === "replace" || action === "needs_review") && !replacementText) {
    return null;
  }

  return {
    schemaVersion: 1,
    event: "local_memory_edit_overlay",
    createdAt: appliedAt,
    writesRealFiles: true,
    sourceFile,
    line,
    sourceId,
    action,
    reason,
    replacementText: action === "suppress" ? "" : replacementText,
    originalContentIncluded: false,
  };
}

function summarizeReviewDecisions(decisions) {
  const summary = {
    decisions: decisions.length,
    approve: 0,
    suppress: 0,
    merge: 0,
    needsMoreEvidence: 0,
  };
  for (const decision of decisions) {
    if (decision.action === "approve") summary.approve += 1;
    if (decision.action === "suppress") summary.suppress += 1;
    if (decision.action === "merge") summary.merge += 1;
    if (decision.action === "needs_more_evidence") summary.needsMoreEvidence += 1;
  }
  return summary;
}

function safeChangedFields(value) {
  const allowed = new Set([
    "recall.forceEveryTurn",
    "recall.rerankCandidateLimit",
    "recall.rerankTokenBudget",
    "writes.storePreCompressCheckpoints",
    "writes.maxAutoWritesPerSession",
    "writes.lowConfidenceAction",
  ]);
  return Array.isArray(value)
    ? value
        .map((item) => {
          const field = safePolicyToken(item?.field ?? "");
          return allowed.has(field) ? { field } : null;
        })
        .filter(Boolean)
        .slice(0, 20)
    : [];
}

function safeStatusMap(value) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, status]) => [safePolicyToken(key), safeChoice(status, ["enabled", "disabled"], "disabled")])
      .filter(([key]) => key)
      .slice(0, 40),
  );
}

function safeStringList(value) {
  return Array.isArray(value) ? value.map((item) => safePolicyString(item)).filter(Boolean).slice(0, 20) : [];
}

function safeChoice(value, allowed, fallback = allowed[0]) {
  const safe = safePolicyToken(value);
  return allowed.includes(safe) ? safe : fallback;
}

function safePolicyToken(value) {
  return safePolicyString(value).replaceAll(/[^a-z0-9_.:-]/gi, "_").slice(0, 80);
}

function safePolicyString(value) {
  return redactPrivate(String(value ?? "")).text.trim().slice(0, 240);
}

function safeMemoryEditText(value) {
  return redactPrivate(String(value ?? ""))
    .text.replace(/\r\n/g, "\n")
    .trim()
    .slice(0, 4000);
}

function booleanSetting(value, fallback) {
  if (typeof value === "boolean") return value;
  return Boolean(fallback);
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function summarizeSyncActions(actions) {
  return actions.reduce((summary, action) => {
    summary[action.action] = (summary[action.action] ?? 0) + 1;
    return summary;
  }, {});
}

function send(response, status, contentType, body) {
  response.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(body);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.RECALLWEAVE_BRAIN_UI_PORT ?? 4177);
  createBrainUiServer().listen(port, "127.0.0.1", () => {
    console.log(`RecallWeave brain UI listening on http://127.0.0.1:${port}`);
  });
}
