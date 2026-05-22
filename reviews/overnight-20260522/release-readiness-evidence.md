# Release Readiness Evidence

Date: 2026-05-22

Scope:

- Added a repeatable `pnpm release:check` gate.
- Added CI coverage for full smoke and release readiness.
- Updated the PR template so future live-build changes include full smoke,
  release readiness, and UI evidence when relevant.
- Made the review evidence directory dynamic, with `RECALLWEAVE_REVIEW_DIR`
  available for pinned review packets.
- Added Brain UI interaction smoke coverage to the release gate so derived
  model behavior is tested directly, not only through static DOM evidence.
- Added Brain UI Container Health evidence to the release gate so the UI must
  prove fixture-safe local container, hosted read-through, provider mode,
  local-only write mode, leak count, redaction count, and retrieval trace
  visibility.
- Added local-container audit smoke coverage to the release gate so future live
  container work has a read-only preflight that returns counts and health
  reasons without exposing raw contents or root paths.
- Added Brain UI Local Audit Preflight evidence to the release gate so the UI
  must prove it can render audit counts and reasons without exposing raw memory
  content or temporary root paths.
- Added Brain UI selected local-container audit evidence to the release gate so
  a real-path preview remains disabled by default, requires read-only
  confirmation, clears the typed path, and displays only a redacted
  `.../container` label.
- Added Brain UI selected local-container browse evidence to the release gate
  so a real-path browse preview remains disabled by default, requires read-only
  confirmation, clears the typed path, returns bounded redacted snippets, skips
  fully private entries, and writes no files.
- Added Gemini review for selected local-container browse and made that review
  packet a required release-readiness artifact.
- Added Brain UI selected local memory edit overlay coverage so selected memory
  edits remain disabled by default, require
  `RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_EDIT`, require the exact
  `APPLY LOCAL MEMORY EDIT` phrase, reject private/key-shaped edit payloads,
  write append-only local edit overlays plus content-free audit logs, do not
  mutate `memories.jsonl` in place, and return only redacted root labels plus
  relative paths and counts.
- Added Gemini review for selected local memory edit and made that review
  packet a required release-readiness artifact.
- Added Brain UI local edit overlay browse coverage so selected local-container
  browse can show matching append-only edit overlays with redacted previews
  while keeping browse read-only and source memory files unchanged.
- Added Gemini review for local edit overlay browse and made that review packet
  a required release-readiness artifact.
- Added Brain UI selected audit history evidence to the release gate so
  browser-local history is content-free, bounded, and does not expose raw local
  paths or private/key-shaped text.
- Added Brain UI selected vault sync dry-run evidence to the release gate so
  real-path sync previews remain disabled by default, require read-only
  confirmation, clear the typed path, show only a redacted root label, and
  write no wiki files.
- Added Brain UI selected vault sync apply coverage so real-path sync applies
  remain disabled by default, require `RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_APPLY`,
  require the exact `APPLY LOCAL WIKI SYNC` phrase, write content-free audit-log
  entries, and return only redacted root labels plus relative actions and
  counts.
- Added Brain UI lifecycle policy evidence to the release gate so policy
  changes are staged as fixture-only `writesRealFiles: false` draft exports.
- Added Brain UI lifecycle policy apply coverage so selected local policy
  applies remain disabled by default, require
  `RECALLWEAVE_BRAIN_UI_ENABLE_POLICY_APPLY`, require the exact
  `APPLY LOCAL LIFECYCLE POLICY` phrase, reject private/key-shaped policy
  payloads, write only a selected local policy file plus content-free audit log,
  and return only redacted root labels plus relative paths and counts.
- Added Brain UI memory review queue evidence to the release gate so noisy,
  duplicate, and high-value candidate decisions are staged as fixture-only
  `writesRealFiles: false` draft exports.
- Added Brain UI memory review queue apply coverage so selected local review
  applies remain disabled by default, require
  `RECALLWEAVE_BRAIN_UI_ENABLE_REVIEW_APPLY`, require the exact
  `APPLY LOCAL REVIEW QUEUE` phrase, reject private/key-shaped review payloads,
  write only selected local decision metadata plus a content-free audit log,
  and return only redacted root labels plus relative paths and counts.
- Added `release-state.json` to the release gate so the current packet must
  explicitly remain conservative: active goal, `FAIL` launch verdict, green
  verified code baseline, fixture-only safety boundary, unresolved blockers,
  and a guard note that later docs/gate commits still need CI but do not create
  a new runtime evidence claim.
- Added Gemini review for the release-state guard and made that review packet a
  required release-readiness artifact.
- Added Codex Browser DOM evidence to the release gate. This pass
  loaded browser evidence baseline `96ae9cc` in the in-app browser and verifies the main Brain UI
  surfaces without private or key-shaped visible text. Screenshot capture timed
  out and is recorded as such.
- Added Gemini review for the browser evidence gate and made that review packet
  a required release-readiness artifact.
- Reduced aggregate smoke churn by using one build before built-artifact smoke
  commands.
- Kept the gate public-safe and evidence-based.

What `release:check` verifies:

- required docs and review evidence files exist and are non-empty,
- the release readiness evidence file itself exists,
- package scripts for build, tests, smokes, and release check exist,
- Brain UI vault preview DOM evidence is sane,
- Brain UI Container Health DOM evidence is sane,
- Brain UI Local Audit Preflight DOM evidence is sane,
- Brain UI selected local-container audit DOM evidence is sane,
- Brain UI selected local-container browse evidence exists and is covered by
  fresh interaction smoke,
- Brain UI selected local memory edit evidence exists and is covered by fresh
  interaction smoke and Browser DOM evidence,
- Brain UI local edit overlay browse evidence exists and is covered by fresh
  interaction smoke and Browser DOM evidence,
- Brain UI selected audit history DOM evidence is sane,
- Brain UI selected vault sync dry-run DOM evidence is sane,
- Brain UI selected vault sync apply controls are present in Browser DOM
  evidence,
- Brain UI lifecycle policy DOM evidence is sane,
- Brain UI selected lifecycle policy apply evidence exists and is covered by a
  fresh interaction smoke,
- Brain UI memory review queue DOM evidence is sane,
- Brain UI selected memory review queue apply evidence exists and is covered by
  a fresh interaction smoke,
- Codex Browser DOM evidence is sane,
- release-state manifest is conservative and lists required blockers,
- release docs mention current preview surfaces,
- a fresh local-container audit smoke passes against current source,
- a fresh Brain UI smoke passes against the current source,
- a fresh Brain UI interaction smoke passes against the current source,
- `git diff --check` passes,
- remote URL has no embedded token,
- `npm pack --dry-run` passes for `packages/core`,
- forbidden runtime files are absent, including common local auth/config/log
  artifacts,
- secret-pattern scan has zero hits across the public tree.

Boundary:

- The gate does not read real agent homes, raw memory logs, databases, or
  private diagnostics.
- It uses URL-to-path conversion so the checker can run from repos whose parent
  path contains spaces.
- It checks the latest review directory by default and can be pinned with
  `RECALLWEAVE_REVIEW_DIR`.
- It does not replace `pnpm smoke`; release review should run both.

Verification:

- `pnpm release:check`: passed.
- `pnpm smoke`: passed.
- `pnpm test`: 21 tests passed.
- `pnpm container:audit:smoke`: passed.
- `git diff --check`: covered by `release:check`.
- Fresh Brain UI smoke: covered by `release:check`.
- Fresh Brain UI interaction smoke: covered by `release:check`.
- Core package dry-run: covered by `release:check`.
- Broadened secret-pattern scan: covered by `release:check`.
- Broadened forbidden runtime file scan: covered by `release:check`.
- Remote URL token check: covered by `release:check`.

Cold review response:

- First Gemini pass returned concerns about stale evidence, narrow secret
  scanning, runtime artifact gaps, and indirect UI privacy evidence.
- Second Gemini pass returned concerns about hardcoded review paths, redundant
  CI build/smoke cycles, and package dry-run visibility.
- Changes after review: dynamic review directory resolution, broader secret and
  forbidden-artifact patterns, fresh Brain UI smoke inside `release:check`, and
  aggregate smoke scripts that build once.
- Changes after final review: CI now runs `pnpm test`, `pnpm smoke`, and
  `pnpm release:check` instead of repeating build/typecheck/adapter smoke as
  separate steps; the public scanner includes shell, example, SQL, and TOML
  files; the PR checklist no longer asks for core package dry-run separately
  because release readiness already covers it.
- Post-push CI check passed. An attempted move to `actions/checkout@v5` and
  `actions/setup-node@v5` failed because the runner could not locate `pnpm`.
  The workflow returned to the known-good v4 actions plus Corepack path and
  keeps `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` as the interim warning
  mitigation.
- Accepted residual note: `release:check` records every check result before
  exiting, so the core package dry-run is still reported even if another check
  fails.
- Accepted residual note: recorded DOM screenshots remain evidence artifacts,
  while `release:check` performs a fresh Brain UI smoke against current source
  to catch obvious runtime drift.
- Interaction smoke now covers search filtering, retrieval trace visibility,
  private/key-shaped edit rejection, draft export, Nucleus export, research
  lineage, lifecycle policy draft export, memory review queue draft export,
  vault path selection, selected local-container browse, write-confirmed
  selected local memory edit, private/key-shaped local edit rejection, selected
  vault sync dry-run, write-confirmed selected vault sync apply,
  write-confirmed selected lifecycle policy apply, private/key-shaped policy
  rejection, dry-run sync reporting, write-confirmed selected review queue
  apply, private/key-shaped review rejection, audit-log write intent coverage,
  and public-safe serialization.

Known limits:

- Private-name scans remain an operator-side release step because putting
  private names in public source would itself leak them.
- GitHub Actions CI run `26288370812` passed on inspected baseline `2888f91`.
  Reinspect Actions after any later branch push.
- GitHub Actions CI run `26289073223` passed on release-state guard commit
  `dd17f44` after the Gemini guard review became required.
- GitHub Actions CI run `26290534116` passed on guarded selected vault sync
  apply commit `103e7c6`.
- GitHub Actions CI run `26291352800` passed on guarded selected
  local-container browse commit `04f1096`.
- GitHub Actions CI run `26292137539` passed on guarded selected lifecycle
  policy apply commit `3b5e140`.
- GitHub Actions CI run `26292772262` passed on guarded selected review queue
  apply commit `19f2577`.
- GitHub Actions CI run `26293533847` passed on guarded selected local memory
  edit overlay commit `72ab902`.
- GitHub Actions CI run `26294323086` passed on guarded local edit overlay
  browse commit `b5352a0`.
