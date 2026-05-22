import { createServer as createHttpServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

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

      const filePath = join(root, path);
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
  if (pathname === "/healthz") return "__healthz";

  const cleaned = normalize(pathname.replace(/^\/+/, ""));
  if (cleaned.startsWith("..")) throw new Error("invalid path");
  if (!cleaned.startsWith("src/") && !cleaned.startsWith("fixtures/")) throw new Error("not found");
  return cleaned;
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
