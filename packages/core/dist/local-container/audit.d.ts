export declare const DEFAULT_LOCAL_CONTAINER_AUDIT_FILES: readonly ["memories.jsonl", "raw_events.jsonl", "lossless_context.jsonl", "trace.jsonl"];
export type LocalContainerAuditFileName = (typeof DEFAULT_LOCAL_CONTAINER_AUDIT_FILES)[number];
export declare const DEFAULT_LOCAL_CONTAINER_BROWSE_FILES: readonly ["memories.jsonl", "trace.jsonl", "lossless_context.jsonl"];
export type LocalContainerBrowseFileName = (typeof DEFAULT_LOCAL_CONTAINER_BROWSE_FILES)[number];
export interface LocalContainerAuditInput {
    rootDir: string;
    containerLabel?: string;
    maxFileBytes?: number;
    inspectFiles?: readonly string[];
}
export interface LocalContainerAuditFile {
    name: string;
    exists: boolean;
    bytes?: number;
    lineCount?: number;
    redactionCount?: number;
    skippedReason?: "missing" | "unsafe_name" | "oversize" | "read_error";
}
export interface LocalContainerAuditReport {
    schemaVersion: 1;
    mode: "local-container-audit";
    writesRealFiles: false;
    rootPathRedacted: true;
    containerLabel: string;
    maxFileBytes: number;
    files: LocalContainerAuditFile[];
    totals: {
        existingFiles: number;
        inspectedFiles: number;
        bytes: number;
        lines: number;
        redactionCount: number;
        skippedFiles: number;
    };
    health: {
        status: "healthy" | "needs-review";
        reasons: string[];
    };
}
export interface LocalContainerBrowseInput {
    rootDir: string;
    containerLabel?: string;
    maxFileBytes?: number;
    maxItems?: number;
    inspectFiles?: readonly string[];
}
export interface LocalContainerBrowseItem {
    sourceFile: LocalContainerBrowseFileName;
    line: number;
    kind: string;
    event?: string;
    sourceId?: string;
    summary: string;
    redactionCount: number;
}
export interface LocalContainerBrowseReport {
    schemaVersion: 1;
    mode: "local-container-browse-preview";
    writesRealFiles: false;
    rootPathRedacted: true;
    containerLabel: string;
    maxFileBytes: number;
    maxItems: number;
    files: Array<{
        name: string;
        exists: boolean;
        bytes?: number;
        inspectedLines?: number;
        skippedReason?: "missing" | "unsafe_name" | "oversize" | "read_error";
    }>;
    items: LocalContainerBrowseItem[];
    totals: {
        filesInspected: number;
        linesInspected: number;
        itemsReturned: number;
        skippedPrivate: number;
        redactionCount: number;
    };
}
export declare function auditLocalContainer(input: LocalContainerAuditInput): Promise<LocalContainerAuditReport>;
export declare function browseLocalContainer(input: LocalContainerBrowseInput): Promise<LocalContainerBrowseReport>;
//# sourceMappingURL=audit.d.ts.map