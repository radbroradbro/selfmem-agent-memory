import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { normalizeHybridCandidate } from "./normalize.js";
export function loadSupermemoryExportCache(outDir) {
    const documentsDir = join(outDir, "documents");
    const sourcesDir = join(outDir, "sources");
    if (!existsSync(documentsDir)) {
        throw new Error(`Supermemory export cache documents directory not found: ${documentsDir}`);
    }
    const candidates = [];
    let documentsRead = 0;
    let skipped = 0;
    for (const name of readdirSync(documentsDir).filter((item) => item.endsWith(".json")).sort()) {
        const full = join(documentsDir, name);
        if (statSync(full).size > 1_000_000) {
            skipped += 1;
            continue;
        }
        documentsRead += 1;
        try {
            const doc = JSON.parse(readFileSync(full, "utf8"));
            const id = typeof doc.id === "string" ? doc.id : name.replace(/\.json$/, "");
            const sourcePath = join(sourcesDir, `${name.replace(/\.json$/, "")}.md`);
            const text = existsSync(sourcePath)
                ? readFileSync(sourcePath, "utf8")
                : String(doc.content ?? doc.title ?? "");
            const containerTags = Array.isArray(doc.containerTags) ? doc.containerTags.map(String) : [];
            const candidate = {
                id: `supermemory-export:${id}`,
                text,
                origin: "supermemory-export",
                score: 0.1,
                containerTag: containerTags[0] ?? "supermemory-export-cache",
                remoteSystem: "supermemory",
                remoteId: id,
                sourceKind: "remote-import",
                sourceId: full,
                confidence: 0.8,
                syncEligible: false,
                safeForRemote: false,
                observedAt: new Date(statSync(full).mtimeMs).toISOString(),
                metadata: {
                    containerTags,
                    status: doc.status,
                    createdAt: doc.createdAt,
                    updatedAt: doc.updatedAt,
                },
            };
            if (normalizeHybridCandidate(candidate))
                candidates.push(candidate);
            else
                skipped += 1;
        }
        catch {
            skipped += 1;
        }
    }
    return { candidates, documentsRead, skipped };
}
//# sourceMappingURL=export-cache.js.map