import { sanitizeNucleusSnapshot } from "../nucleus/index.js";
export function compileNucleusWikiVault(snapshot, options = {}) {
    const sanitized = sanitizeNucleusSnapshot(snapshot);
    const includeNucleusJson = options.includeNucleusJson ?? true;
    const includeManifest = options.includeManifest ?? true;
    const root = normalizeRoot(options.vaultRoot ?? "");
    const pageNodes = sanitized.nodes.filter(shouldWriteWikiPage);
    const pagePaths = createPagePathMap(pageNodes);
    const files = [];
    files.push({
        path: joinVaultPath(root, "wiki/index.md"),
        kind: "index",
        contents: renderIndexPage(sanitized, pageNodes, pagePaths),
    });
    files.push({
        path: joinVaultPath(root, "wiki/log.md"),
        kind: "log",
        contents: renderLogPage(sanitized),
    });
    files.push({
        path: joinVaultPath(root, "wiki/methodology.md"),
        kind: "methodology",
        contents: renderMethodologyPage(sanitized, pageNodes, pagePaths),
    });
    for (const node of pageNodes) {
        files.push({
            path: joinVaultPath(root, pagePaths.get(node.id)),
            kind: "wiki_page",
            nodeId: node.id,
            contents: renderNodePage(node, sanitized.edges, sanitized.nodes, pagePaths),
        });
    }
    if (includeNucleusJson) {
        files.push({
            path: joinVaultPath(root, "nucleus.json"),
            kind: "nucleus",
            contents: `${JSON.stringify(sanitized, null, 2)}\n`,
        });
    }
    const manifest = {
        schemaVersion: 1,
        generatedAt: sanitized.generatedAt,
        fileCount: files.length + (includeManifest ? 1 : 0),
        nodeCount: sanitized.nodes.length,
        edgeCount: sanitized.edges.length,
        files: [],
    };
    manifest.files = files.map(({ path, kind, nodeId }) => ({ path, kind, ...(nodeId ? { nodeId } : {}) }));
    if (includeManifest) {
        files.push({
            path: joinVaultPath(root, ".manifest.json"),
            kind: "manifest",
            contents: `${JSON.stringify({ ...manifest, files: [...manifest.files, { path: joinVaultPath(root, ".manifest.json"), kind: "manifest" }] }, null, 2)}\n`,
        });
    }
    return {
        snapshot: sanitized,
        manifest: {
            ...manifest,
            files: files.map(({ path, kind, nodeId }) => ({ path, kind, ...(nodeId ? { nodeId } : {}) })),
        },
        files,
    };
}
export function lintCompiledWikiVault(vault) {
    const issues = [];
    const pathCounts = new Map();
    const pageTitles = new Set();
    for (const file of vault.files) {
        pathCounts.set(file.path, (pathCounts.get(file.path) ?? 0) + 1);
        if (!isSafeRelativeVaultPath(file.path)) {
            issues.push({
                code: "unsafe_path",
                path: file.path,
                message: "Vault file path must be relative and stay inside the vault.",
            });
        }
        if (file.kind === "wiki_page" || file.kind === "index" || file.kind === "methodology" || file.kind === "log") {
            if (!file.contents.startsWith("---\n")) {
                issues.push({
                    code: "missing_frontmatter",
                    path: file.path,
                    message: "Markdown wiki files must start with YAML frontmatter.",
                });
            }
            const title = parseFrontmatterString(file.contents, "title");
            if (title)
                pageTitles.add(title);
        }
    }
    for (const [path, count] of pathCounts) {
        if (count > 1) {
            issues.push({
                code: "duplicate_path",
                path,
                message: "Compiled vault contains duplicate output paths.",
            });
        }
    }
    for (const file of vault.files) {
        if (!file.path.endsWith(".md"))
            continue;
        for (const link of file.contents.matchAll(/\[\[([^\]]+)\]\]/g)) {
            const target = link[1]?.split("|")[0]?.trim();
            if (target && !pageTitles.has(target)) {
                issues.push({
                    code: "broken_wikilink",
                    path: file.path,
                    message: `Broken wikilink: ${target}`,
                });
            }
        }
    }
    return issues;
}
function shouldWriteWikiPage(node) {
    return [
        "wiki_page",
        "derived_doc",
        "session_summary",
        "entity",
        "project",
        "decision",
        "contradiction",
        "research_query",
        "source_claim",
        "hypothesis",
        "lifecycle_event",
        "retrieval_trace",
    ].includes(node.kind);
}
function renderIndexPage(snapshot, nodes, pagePaths) {
    const lines = [
        frontmatter({
            title: "RecallWeave Index",
            type: "index",
            category: "nucleus",
            tags: ["wiki", "index", "nucleus"],
            created: snapshot.generatedAt,
            updated: snapshot.generatedAt,
            confidence: 1,
            sources: [],
            provenance: [],
        }),
        "# RecallWeave Index",
        "",
        "This generated index links Nucleus nodes, derived pages, lifecycle events, and research lineage.",
        "",
        "## Pages",
        "",
    ];
    for (const node of [...nodes].sort((a, b) => a.title.localeCompare(b.title))) {
        lines.push(`- [[${wikiTitle(node)}]] - ${node.kind} - ${pagePaths.get(node.id)}`);
    }
    lines.push("", "## Graph", "", `- Nodes: ${snapshot.nodes.length}`, `- Edges: ${snapshot.edges.length}`, "");
    return lines.join("\n");
}
function renderLogPage(snapshot) {
    return [
        frontmatter({
            title: "RecallWeave Log",
            type: "log",
            category: "operations",
            tags: ["log", "sync"],
            created: snapshot.generatedAt,
            updated: snapshot.generatedAt,
            confidence: 1,
            sources: [],
            provenance: [],
        }),
        "# RecallWeave Log",
        "",
        `- ${snapshot.generatedAt}: compiled ${snapshot.nodes.length} Nucleus nodes and ${snapshot.edges.length} edges into wiki files.`,
        "",
    ].join("\n");
}
function renderMethodologyPage(snapshot, nodes, _pagePaths) {
    const researchNodes = nodes.filter((node) => ["research_query", "hypothesis", "source_claim"].includes(node.kind));
    return [
        frontmatter({
            title: "RecallWeave Methodology",
            type: "methodology",
            category: "research",
            tags: ["methodology", "research-lineage"],
            created: snapshot.generatedAt,
            updated: snapshot.generatedAt,
            confidence: 1,
            sources: [],
            provenance: [],
        }),
        "# RecallWeave Methodology",
        "",
        "Research lineage should connect queries, claims, hypotheses, tests, and decisions.",
        "",
        "## Research Nodes",
        "",
        ...researchNodes.map((node) => `- [[${wikiTitle(node)}]] - ${node.kind}`),
        "",
    ].join("\n");
}
function renderNodePage(node, edges, nodes, pagePaths) {
    const body = typeof node.metadata?.body === "string" ? node.metadata.body : defaultNodeBody(node);
    const linkedEdges = edges.filter((edge) => edge.from === node.id || edge.to === node.id);
    const byId = new Map(nodes.map((item) => [item.id, item]));
    const links = linkedEdges
        .map((edge) => {
        const targetId = edge.from === node.id ? edge.to : edge.from;
        const target = byId.get(targetId);
        if (!target || !pagePaths.has(target.id))
            return undefined;
        const direction = edge.from === node.id ? edge.kind : `reverse:${edge.kind}`;
        return `- ${direction}: [[${wikiTitle(target)}]]`;
    })
        .filter(Boolean);
    return [
        frontmatter({
            title: wikiTitle(node),
            type: node.kind,
            category: categoryForNode(node),
            tags: node.tags ?? [],
            aliases: node.aliases ?? [],
            created: node.createdAt,
            updated: node.updatedAt,
            confidence: node.confidence ?? 1,
            sources: sourceRefs(node.provenance ?? []),
            provenance: node.provenance ?? [],
            reviewed: false,
        }),
        `# ${wikiTitle(node)}`,
        "",
        body.trim(),
        "",
        "## Links",
        "",
        ...(links.length > 0 ? links : ["- No linked wiki pages yet."]),
        "",
    ].join("\n");
}
function defaultNodeBody(node) {
    const facts = [
        `- Kind: ${node.kind}`,
        `- Updated: ${node.updatedAt}`,
        ...(node.scope ? [`- Scope: ${node.scope}`] : []),
        ...(node.containerTag ? [`- Container: ${node.containerTag}`] : []),
    ];
    return facts.join("\n");
}
function frontmatter(input) {
    return [
        "---",
        `title: ${quoteYaml(input.title)}`,
        `type: ${quoteYaml(input.type)}`,
        `category: ${quoteYaml(input.category)}`,
        `tags: ${yamlList(input.tags)}`,
        `aliases: ${yamlList(input.aliases ?? [])}`,
        `sources: ${yamlList(input.sources)}`,
        `created: ${quoteYaml(input.created)}`,
        `updated: ${quoteYaml(input.updated)}`,
        `confidence: ${Number(input.confidence.toFixed(3))}`,
        "version: 1",
        "provenance:",
        `  extracted: ${yamlList(sourceRefs(input.provenance))}`,
        "  inferred: []",
        "  ambiguous: []",
        `reviewed: ${input.reviewed ?? false}`,
        "---",
        "",
    ].join("\n");
}
function wikiPathForNode(node) {
    const metadataPath = typeof node.metadata?.path === "string" ? node.metadata.path : undefined;
    if (metadataPath && isSafeRelativeVaultPath(metadataPath) && metadataPath.startsWith("wiki/") && metadataPath.endsWith(".md")) {
        return metadataPath;
    }
    return `wiki/${folderForNode(node)}/${slugify(node.title || node.id)}-${shortId(node.id)}.md`;
}
function createPagePathMap(nodes) {
    const counts = new Map();
    const paths = new Map();
    for (const node of nodes) {
        const basePath = wikiPathForNode(node);
        const count = counts.get(basePath) ?? 0;
        counts.set(basePath, count + 1);
        paths.set(node.id, count === 0 ? basePath : withPathSuffix(basePath, `${shortId(node.id)}-${count + 1}`));
    }
    return paths;
}
function folderForNode(node) {
    const folders = {
        decision: "decisions",
        project: "projects",
        entity: "entities",
        session_summary: "sessions",
        research_query: "research",
        source_claim: "research",
        hypothesis: "research",
        lifecycle_event: "lifecycle",
        retrieval_trace: "retrieval",
        contradiction: "contradictions",
        derived_doc: "docs",
        wiki_page: "pages",
    };
    return folders[node.kind] ?? "nodes";
}
function categoryForNode(node) {
    if (["research_query", "source_claim", "hypothesis"].includes(node.kind))
        return "research";
    if (["lifecycle_event", "retrieval_trace"].includes(node.kind))
        return "operations";
    return node.kind.replace(/_/g, "-");
}
function wikiTitle(node) {
    return cleanDisplayText(node.title) || node.id;
}
function sourceRefs(provenance) {
    return [...new Set(provenance.map((item) => item.sourceId).filter(Boolean))];
}
function quoteYaml(value) {
    return JSON.stringify(value);
}
function yamlList(values) {
    if (values.length === 0)
        return "[]";
    return `[${values.map(quoteYaml).join(", ")}]`;
}
function normalizeRoot(root) {
    const normalized = root.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    if (!normalized || normalized === ".")
        return "";
    if (!isSafeRelativeVaultPath(normalized))
        return "";
    return normalized;
}
function joinVaultPath(root, path) {
    return root ? `${root}/${path}` : path;
}
function isSafeRelativeVaultPath(path) {
    const normalized = path.replace(/\\/g, "/");
    return Boolean(normalized) && !normalized.startsWith("/") && !normalized.includes("..") && !/^[A-Za-z]:\//.test(normalized);
}
function slugify(value) {
    const slug = cleanDisplayText(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 72);
    return slug || "untitled";
}
function cleanDisplayText(value) {
    return value
        .replace(/\[REDACTED_PRIVATE\]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function shortId(value) {
    return value.replace(/^[^:]+:/, "").slice(0, 8) || "00000000";
}
function withPathSuffix(path, suffix) {
    return path.replace(/\.md$/i, `-${suffix}.md`);
}
function parseFrontmatterString(contents, key) {
    const value = contents.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim();
    if (!value)
        return undefined;
    if (value.startsWith("\"")) {
        try {
            const parsed = JSON.parse(value);
            return typeof parsed === "string" ? parsed : undefined;
        }
        catch {
            return undefined;
        }
    }
    return value;
}
//# sourceMappingURL=compiler.js.map