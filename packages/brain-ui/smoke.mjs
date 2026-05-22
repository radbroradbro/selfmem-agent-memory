import assert from "node:assert/strict";
import { createBrainUiServer } from "./server.mjs";

const server = createBrainUiServer();

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

try {
  const address = server.address();
  assert(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const [index, app, styles, fixture, vault, health] = await Promise.all([
    text(`${base}/`),
    text(`${base}/app.js`),
    text(`${base}/styles.css`),
    json(`${base}/fixtures/nucleus.fixture.json`),
    json(`${base}/fixtures/wiki-vault.json`),
    json(`${base}/healthz`),
  ]);

  assert.equal(health.ok, true);
  assert.match(index, /RecallWeave Brain/);
  assert.match(index, /Wiki Vault Preview/);
  assert.match(app, /renderGraph/);
  assert.match(app, /renderVaultPreview/);
  assert.match(styles, /nucleus-shell/);
  assert.match(styles, /vault-preview/);
  assert.equal(fixture.schemaVersion, 1);
  assert.ok(fixture.nodes.length >= 8);
  assert.ok(fixture.edges.length >= 8);
  assert.ok(fixture.nodes.some((node) => node.kind === "retrieval_trace"));
  assert.ok(fixture.nodes.some((node) => node.kind === "hypothesis"));
  assert.ok(fixture.nodes.some((node) => node.editable === true));
  assert.equal(vault.ok, true);
  assert.equal(vault.lint.length, 0);
  assert.ok(vault.vault.files.some((file) => file.path === "wiki/index.md"));
  assert.ok(vault.vault.files.some((file) => file.kind === "wiki_page"));

  const serialized = JSON.stringify({ fixture, vault });
  assert.doesNotMatch(serialized, /<private>|pa-|AIza|sm_|nvapi-|jina_|ghp_|github_pat_/);
  console.log(JSON.stringify({ ok: true, checked: ["index", "app", "styles", "fixture", "wiki-vault", "healthz"] }, null, 2));
} finally {
  await new Promise((resolve) => server.close(resolve));
}

async function text(url) {
  const response = await fetch(url);
  assert.equal(response.status, 200, url);
  return response.text();
}

async function json(url) {
  const response = await fetch(url);
  assert.equal(response.status, 200, url);
  return response.json();
}
