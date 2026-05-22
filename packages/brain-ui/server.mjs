import { createServer as createHttpServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileNucleusWikiVault, lintCompiledWikiVault, syncCompiledWikiVault } from "../core/dist/index.js";

const root = fileURLToPath(new URL(".", import.meta.url));

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
]);

export function createBrainUiServer() {
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
  if (pathname === "/styles.css") return "src/styles.css";
  if (pathname === "/fixtures/nucleus.fixture.json") return "fixtures/nucleus.fixture.json";
  if (pathname === "/fixtures/wiki-vault.json") return "__wiki_vault_fixture";
  if (pathname === "/fixtures/wiki-sync-report.json") return "__wiki_sync_report_fixture";
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

function resolveUnderRoot(rootDir, relativePath) {
  const target = resolve(rootDir, relativePath);
  const rel = relative(rootDir, target);
  if (rel === "" || rel.startsWith("..") || rel.startsWith("/")) {
    throw new Error("fixture path escaped temp root");
  }
  return target;
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
