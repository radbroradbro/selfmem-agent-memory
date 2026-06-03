import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const format = String(args.format ?? "json");
const outputPath = args.output ? resolve(String(args.output)) : null;
const markdownOutputPath = args.markdownOutput ? resolve(String(args.markdownOutput)) : null;
const reviewDir = process.env.RECALLWEAVE_REVIEW_DIR ?? (await latestReviewDir());
const repository = "radbroradbro/selfmem-agent-memory";
const pullRequest = 5;
const issueNumber = 6;
const expectedHeadRef = "feat/nucleus-wiki-native-contract";
const githubFetchAttempts = positiveInt(process.env.RECALLWEAVE_GITHUB_FETCH_ATTEMPTS ?? 3, "GitHub fetch attempts");
const githubFetchTimeoutMs = positiveInt(process.env.RECALLWEAVE_GITHUB_FETCH_TIMEOUT_MS ?? 20_000, "GitHub fetch timeout ms");
const githubFetchRetryBaseMs = positiveInt(process.env.RECALLWEAVE_GITHUB_FETCH_RETRY_BASE_MS ?? 1_000, "GitHub fetch retry base ms");

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern =
  /(\/Users\/[^/\s"]+|\/Volumes\/[^/\s"]+|\.hermes\/profiles|\.openclaw[^/\s"]*|memories\.jsonl|raw_events\.jsonl|lossless_context\.jsonl)/i;

const paths = {
  prBodyDraft: join(root, reviewDir, "pr-body-update-draft.md"),
  issueDraft: join(root, reviewDir, "issue-drafts/blocker-fresh-brain-ui-launch-and-release-gate.md"),
};

for (const [name, path] of Object.entries(paths)) {
  assert.ok(existsSync(path), `${name} missing at ${path}`);
  assert.ok(statSync(path).size > 0, `${name} is empty at ${path}`);
}

const prBodyDraftText = readFileSync(paths.prBodyDraft, "utf8");
const issueDraftText = readFileSync(paths.issueDraft, "utf8");
const expectedPrBody = extractFencedMarkdown(prBodyDraftText);
const expectedIssueTitle = extractIssueTitle(issueDraftText);
const expectedIssueBody = issueDraftText.trim();

const [prResponse, issueResponse] = await Promise.all([
  githubJson(`/repos/${repository}/pulls/${pullRequest}`),
  githubJson(`/repos/${repository}/issues/${issueNumber}`),
]);

const livePrBody = String(prResponse.body ?? "").trim();
const liveIssueTitle = String(issueResponse.title ?? "").trim();
const liveIssueBody = String(issueResponse.body ?? "").trim();
const prBodyMatches = livePrBody === expectedPrBody;
const issueTitleMatches = liveIssueTitle === expectedIssueTitle;
const issueBodyMatches = liveIssueBody === expectedIssueBody;
const livePrHeadMatches = prResponse.head?.ref === expectedHeadRef;
const livePrOpen = prResponse.state === "open";
const liveIssueOpen = issueResponse.state === "open";
const localHead = gitStdout(["rev-parse", "HEAD"]);
const localBranch = gitStdout(["rev-parse", "--abbrev-ref", "HEAD"]);
const remoteBranchHead = gitRemoteHead(`refs/heads/${expectedHeadRef}`);
const remotePullRequestHead = gitRemoteHead(`refs/pull/${pullRequest}/head`);
const remotePullRequestMergeRef = gitRemoteHead(`refs/pull/${pullRequest}/merge`);
const livePrHeadSha = String(prResponse.head?.sha ?? "");
const remoteBranchHeadMatchesCurrentHead = remoteBranchHead === localHead;
const remotePullRequestHeadMatchesCurrentHead = remotePullRequestHead === localHead;
const livePrHeadShaMatchesCurrentHead = livePrHeadSha === localHead;

assert.equal(prBodyMatches, true, "live PR body differs from checked-in draft");
assert.equal(issueTitleMatches, true, "live issue title differs from checked-in draft");
assert.equal(issueBodyMatches, true, "live issue body differs from checked-in draft");
assert.equal(livePrHeadMatches, true, "live PR head ref differs from expected release branch");
assert.equal(livePrOpen, true, "PR must remain open for release gating");
assert.equal(liveIssueOpen, true, "blocker issue must remain open for release gating");
assert.equal(localBranch, expectedHeadRef, "local branch differs from expected release branch");
assert.equal(remoteBranchHeadMatchesCurrentHead, true, "remote branch head differs from local current HEAD");
assert.equal(remotePullRequestHeadMatchesCurrentHead, true, "remote PR head differs from local current HEAD");
assert.equal(livePrHeadShaMatchesCurrentHead, true, "GitHub API PR head sha differs from local current HEAD");

const report = {
  ok: true,
  mode: "github-live-sync-check",
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  callsGitHubApi: true,
  repository,
  pullRequest,
  issueNumber,
  reviewDir,
  localHead,
  localBranch,
  livePrOpen,
  liveIssueOpen,
  livePrHeadMatches,
  livePrHeadSha,
  expectedHeadRef,
  remoteBranchHead,
  remotePullRequestHead,
  remotePullRequestMergeRef,
  remoteBranchHeadMatchesCurrentHead,
  remotePullRequestHeadMatchesCurrentHead,
  livePrHeadShaMatchesCurrentHead,
  prBodyMatches,
  issueTitleMatches,
  issueBodyMatches,
  prBodyHash: sha256(expectedPrBody),
  issueTitleHash: sha256(expectedIssueTitle),
  issueBodyHash: sha256(expectedIssueBody),
  liveUpdatedAt: {
    pullRequest: prResponse.updated_at ?? null,
    issue: issueResponse.updated_at ?? null,
  },
  safety: {
    printsBodyText: false,
    printsCredentials: false,
    privateLeakCount: 0,
    hasSecretPattern: false,
    hasPrivatePathPattern: false,
  },
};

const serialized = JSON.stringify(report, null, 2);
assert.doesNotMatch(serialized, secretPattern);
assert.doesNotMatch(serialized, privatePathPattern);
const markdown = markdownReport(report);
assert.doesNotMatch(markdown, secretPattern);
assert.doesNotMatch(markdown, privatePathPattern);

if (format === "markdown") {
  process.stdout.write(markdown);
} else {
  assert.equal(format, "json", "format must be json or markdown");
  console.log(serialized);
}

if (outputPath) writeSafeText(outputPath, `${serialized}\n`);
if (markdownOutputPath) writeSafeText(markdownOutputPath, markdown);

async function githubJson(apiPath) {
  const authHeader = gitCredentialAuthHeader();
  let lastError = null;
  let lastStatus = null;
  for (let attempt = 1; attempt <= githubFetchAttempts; attempt += 1) {
    try {
      const response = await fetch(`https://api.github.com${apiPath}`, {
        headers: {
          accept: "application/vnd.github+json",
          "user-agent": "recallweave-live-sync-check",
          ...(authHeader ? { authorization: authHeader } : {}),
        },
        signal: AbortSignal.timeout(githubFetchTimeoutMs),
      });
      if (response.ok) return response.json();
      lastStatus = response.status;
      if (!retryableGitHubStatus(response.status) || attempt === githubFetchAttempts) {
        assert.equal(response.ok, true, `GitHub API request failed for ${apiPath}: ${response.status}`);
      }
    } catch (error) {
      lastError = error;
      if (attempt === githubFetchAttempts) break;
    }
    await sleep(githubFetchRetryDelayMs(attempt));
  }
  const reason = lastStatus ? `status ${lastStatus}` : `${lastError?.name ?? "Error"}: ${lastError?.message ?? "unknown error"}`;
  assert.fail(`GitHub API request failed for ${apiPath} after ${githubFetchAttempts} attempts: ${reason}`);
}

function gitCredentialAuthHeader() {
  const result = spawnSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
    stdio: ["pipe", "pipe", "ignore"],
  });
  if (result.status !== 0) return null;
  const token = result.stdout.match(/^password=(.+)$/m)?.[1];
  return token ? `Bearer ${token}` : null;
}

function gitStdout(args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, `git ${args.join(" ")} failed\n${result.stderr}`);
  return result.stdout.trim();
}

function gitRemoteHead(ref) {
  const result = spawnSync("git", ["ls-remote", "origin", ref], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, `git ls-remote origin ${ref} failed\n${result.stderr}`);
  const sha = result.stdout.trim().split(/\s+/)[0] ?? "";
  assert.match(sha, /^[a-f0-9]{40}$/, `missing remote sha for ${ref}`);
  return sha;
}

function extractFencedMarkdown(text) {
  const match = text.match(/```markdown\n([\s\S]*?)\n```/);
  assert.ok(match, "PR body draft must contain a fenced markdown body");
  return match[1].trim();
}

function extractIssueTitle(text) {
  const h1 = text.match(/^#\s+(.+)$/m)?.[1]?.trim();
  assert.ok(h1, "issue draft must start with an H1 title");
  return h1.replace(/^Blocking Issue Draft:\s*/i, "").trim();
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function retryableGitHubStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

function githubFetchRetryDelayMs(attempt) {
  return githubFetchRetryBaseMs * attempt;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function positiveInt(value, label) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  assert.ok(Number.isInteger(parsed) && parsed > 0, `${label} must be a positive integer`);
  return parsed;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function writeSafeText(path, text) {
  assert.notEqual(path, "true", "output paths must be explicit file paths");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function markdownReport(report) {
  return `# GitHub Live Sync Current Head

- Repository: \`${report.repository}\`
- Pull request: #${report.pullRequest}
- Issue: #${report.issueNumber}
- Local branch: \`${report.localBranch}\`
- Local head at evidence capture: \`${report.localHead}\`
- PR open: ${report.livePrOpen}
- Issue open: ${report.liveIssueOpen}
- PR head branch matches expected: ${report.livePrHeadMatches}
- Remote branch head matches local head: ${report.remoteBranchHeadMatchesCurrentHead}
- Remote PR head matches local head: ${report.remotePullRequestHeadMatchesCurrentHead}
- GitHub API PR head SHA matches local head: ${report.livePrHeadShaMatchesCurrentHead}
- PR body matches checked-in draft: ${report.prBodyMatches}
- Issue title matches checked-in draft: ${report.issueTitleMatches}
- Issue body matches checked-in draft: ${report.issueBodyMatches}
- Branch head at evidence capture: \`${report.remoteBranchHead}\`
- PR head at evidence capture: \`${report.remotePullRequestHead}\`
- PR merge ref at evidence capture: \`${report.remotePullRequestMergeRef}\`
- Live PR updated at: ${report.liveUpdatedAt.pullRequest}
- Live issue updated at: ${report.liveUpdatedAt.issue}

## Safety

- The checker prints hashes and booleans only; it does not print PR body text, issue body text, credentials, raw memories, or benchmark text.
- PR body hash: \`${report.prBodyHash}\`
- Issue title hash: \`${report.issueTitleHash}\`
- Issue body hash: \`${report.issueBodyHash}\`
`;
}

async function latestReviewDir() {
  const entries = await readdir(join(root, "reviews"), { withFileTypes: true });
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => `reviews/${entry.name}`)
    .sort();
  assert.ok(dirs.length > 0, "no review evidence directories found");
  return dirs.at(-1);
}
