import type { HybridCandidate } from "./normalize.js";
export interface ExportCacheLoadResult {
    candidates: HybridCandidate[];
    documentsRead: number;
    skipped: number;
}
export declare function loadSupermemoryExportCache(outDir: string): ExportCacheLoadResult;
//# sourceMappingURL=export-cache.d.ts.map