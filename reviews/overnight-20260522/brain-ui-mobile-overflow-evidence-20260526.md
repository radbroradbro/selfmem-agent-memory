# Brain UI Mobile Overflow Evidence

- Initial in-app browser check: `http://127.0.0.1:4189/` rendered `RecallWeave Brain` with no console warnings or errors.
- Initial narrow viewport check: 319 px wide reported horizontal overflow.
- Screenshot captured: `reviews/overnight-20260522/brain-ui-sanity-20260526.png`.
- CSS fix applied: the narrow layout now constrains the shell, graph area, detail panel, and rail to the viewport; the topbar and graph toolbar collapse into single-column controls; page-level horizontal overflow is hidden at the mobile breakpoint.
- Post-fix in-app browser reload: blocked by the browser URL policy, so no browser workaround was attempted and the screenshot remains pre-fix evidence only.
- Repo checks used after the CSS change: `node packages/brain-ui/smoke.mjs`, `node packages/brain-ui/interaction-smoke.mjs`, and `node packages/brain-ui/static-evidence.mjs`.
- Public-safety note: this evidence contains no raw memories, transcripts, prompts, credentials, or private local paths.
